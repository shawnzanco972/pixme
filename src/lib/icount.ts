/**
 * iCount payments client (server-only).
 *
 * Architecture (see docs/icount.md, Phase 1.3): the webhook is only an event
 * trigger — we ALWAYS verify a transaction server-side via the API token before
 * provisioning. Optional HMAC verification is layered on top if iCount signs
 * its callbacks.
 *
 * NOTE: iCount's exact endpoint/field names live behind their authenticated
 * developer portal. Anything not yet confirmed is marked `TODO(icount)` and
 * funneled through a single `icountPost()` helper so it's trivial to finalize
 * once the dashboard details are in hand.
 */
import "server-only";

import crypto from "node:crypto";

// --- Config ---------------------------------------------------------------

const ICOUNT_BASE_URL =
  process.env.ICOUNT_BASE_URL ?? "https://api.icount.co.il/api/v3.php";

function apiToken(): string {
  const t = process.env.ICOUNT_API_TOKEN;
  if (!t) {
    throw new Error(
      "Missing ICOUNT_API_TOKEN. Set it in .env.local / Vercel env before using payments.",
    );
  }
  return t;
}

function webhookSecret(): string | undefined {
  return process.env.ICOUNT_WEBHOOK_SECRET || undefined;
}

// Pass-through field on the hosted checkout that carries our Supabase order id.
// TODO(icount): confirm the actual supported custom-field key in the dashboard.
export const ORDER_ID_FIELD = "custom_client_data" as const;

// --- Types ----------------------------------------------------------------

export type CheckoutTrack = "b2c" | "b2b";

export interface CreateCheckoutParams {
  orderId: string;
  track: CheckoutTrack;
  amount: number; // ILS
  description: string;
  customerEmail: string;
  customerName?: string;
  /** Where iCount redirects the buyer after a successful payment. */
  successUrl: string;
  /** Where iCount POSTs the server-to-server notification. */
  ipnUrl: string;
}

export interface CreateCheckoutResult {
  /** Hosted checkout URL to redirect the buyer to. */
  url: string;
}

export interface VerifiedTransaction {
  paid: boolean;
  /** iCount document/invoice id, persisted as icount_invoice_id. */
  invoiceId: string | null;
  /** Authoritative amount actually paid (ILS), per iCount. */
  amountPaid: number | null;
  /** Our order id, if iCount echoed back the pass-through field. */
  orderId: string | null;
  raw: unknown;
}

// --- Low-level transport --------------------------------------------------

async function icountPost(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${ICOUNT_BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_token: apiToken(), ...body }),
    // Payments must never be cached.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`iCount API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// --- Public API -----------------------------------------------------------

/**
 * Create a hosted checkout session and return the redirect URL.
 * Passes our `orderId` through so the IPN/return can be correlated.
 *
 * TODO(icount): confirm the exact module/action + param names for the hosted
 * payment page. Centralized here so only this block changes once confirmed.
 */
export async function createCheckout(
  params: CreateCheckoutParams,
): Promise<CreateCheckoutResult> {
  const payload = {
    // TODO(icount): real fields — these are placeholders pending dashboard docs.
    sum: params.amount,
    currency: "ILS",
    description: params.description,
    email: params.customerEmail,
    client_name: params.customerName,
    success_url: params.successUrl,
    ipn_url: params.ipnUrl,
    [ORDER_ID_FIELD]: JSON.stringify({
      order_id: params.orderId,
      track: params.track,
    }),
  };

  const data = (await icountPost("cc/checkout", payload)) as {
    url?: string;
    payment_url?: string;
  };

  const url = data.url ?? data.payment_url;
  if (!url) {
    throw new Error("iCount did not return a hosted checkout URL");
  }
  return { url };
}

/**
 * Server-side authoritative verification of a transaction. Called by the
 * webhook BEFORE provisioning, regardless of whether the payload was signed.
 *
 * TODO(icount): confirm the lookup endpoint + response shape; map fields below.
 */
export async function verifyTransaction(args: {
  invoiceId?: string | null;
  orderId?: string | null;
}): Promise<VerifiedTransaction> {
  const data = (await icountPost("doc/info", {
    doc_id: args.invoiceId,
  })) as Record<string, unknown>;

  // Map iCount's response into our normalized shape. Field names TODO(icount).
  const status = String(
    (data.status as string) ?? (data.doc_status as string) ?? "",
  ).toLowerCase();
  const paid = status === "paid" || status === "closed" || data.paid === true;

  return {
    paid,
    invoiceId:
      (data.doc_id as string) ?? (data.invoice_id as string) ?? args.invoiceId ?? null,
    amountPaid:
      typeof data.paid_sum === "number"
        ? data.paid_sum
        : typeof data.sum === "number"
          ? (data.sum as number)
          : null,
    orderId: args.orderId ?? null,
    raw: data,
  };
}

// --- Webhook helpers ------------------------------------------------------

/**
 * Verify an optional HMAC signature on a raw webhook body.
 * Returns true if no secret is configured (i.e. signing not in use) OR the
 * signature matches. The webhook still performs server-side lookup either way.
 *
 * TODO(icount): confirm the signature algorithm + header name. Assumes
 * hex HMAC-SHA256 over the raw request body.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = webhookSecret();
  if (!secret) return true; // signing not configured — rely on lookup instead
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Extract our order id + track from an iCount webhook payload. */
export function extractOrderRef(payload: Record<string, unknown>): {
  orderId: string | null;
  track: CheckoutTrack | null;
  invoiceId: string | null;
} {
  let orderId: string | null = null;
  let track: CheckoutTrack | null = null;

  const passthrough = payload[ORDER_ID_FIELD];
  if (typeof passthrough === "string") {
    try {
      const parsed = JSON.parse(passthrough) as {
        order_id?: string;
        track?: CheckoutTrack;
      };
      orderId = parsed.order_id ?? null;
      track = parsed.track ?? null;
    } catch {
      orderId = passthrough; // bare id fallback
    }
  }

  const invoiceId =
    (payload.doc_id as string) ?? (payload.invoice_id as string) ?? null;

  return { orderId, track, invoiceId };
}

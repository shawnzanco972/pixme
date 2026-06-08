/**
 * POST /api/webhooks/icount
 *
 * iCount server-to-server payment notification (IPN). The payload is treated as
 * a mere TRIGGER: we (optionally) verify its signature, then INDEPENDENTLY
 * verify the transaction via the iCount API before provisioning. Provisioning
 * is idempotent so duplicate deliveries never double-provision.
 *
 * See docs/icount.md for the rationale.
 */
import { NextResponse } from "next/server";

import {
  extractOrderRef,
  verifyTransaction,
  verifyWebhookSignature,
} from "@/lib/icount";
import { provisionB2b, provisionB2c } from "@/lib/provision";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Read the RAW body first so the signature is computed over exact bytes.
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-icount-signature") ??
    request.headers.get("x-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orderId, track, invoiceId } = extractOrderRef(payload);
  if (!orderId) {
    return NextResponse.json(
      { error: "Could not determine order id from payload" },
      { status: 400 },
    );
  }

  // Authoritative server-side verification (does NOT trust the payload amounts).
  const tx = await verifyTransaction({ invoiceId, orderId });
  if (!tx.paid) {
    // Acknowledge so iCount stops retrying, but provision nothing.
    return NextResponse.json({ ok: true, provisioned: false, reason: "unpaid" });
  }

  const admin = createAdminClient();

  try {
    if (track === "b2b") {
      await provisionB2b(admin, orderId, tx.invoiceId, tx.amountPaid);
    } else {
      // Default to B2C when track is absent.
      await provisionB2c(admin, orderId, tx.invoiceId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provisioning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, provisioned: true });
}

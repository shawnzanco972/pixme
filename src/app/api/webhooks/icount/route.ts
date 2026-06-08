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

import { sendOrderConfirmation, sendOwnerWelcome } from "@/lib/email";
import {
  extractOrderRef,
  verifyTransaction,
  verifyWebhookSignature,
} from "@/lib/icount";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// B2B workspaces expire one year after provisioning by default.
const WORKSPACE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

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

type Admin = ReturnType<typeof createAdminClient>;

/** Idempotently mark a B2C order paid. */
async function provisionB2c(
  admin: Admin,
  orderId: string,
  invoiceId: string | null,
) {
  const { data: order, error } = await admin
    .from("b2c_orders")
    .select("id, status, customer_name, contact_email")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error(`B2C order ${orderId} not found`);
  if (order.status === "paid") return; // already provisioned

  const { error: updErr } = await admin
    .from("b2c_orders")
    .update({ status: "paid", icount_invoice_id: invoiceId })
    .eq("id", orderId)
    .neq("status", "paid");
  if (updErr) throw new Error(updErr.message);

  // Best-effort confirmation email (no-op until email is configured).
  await sendOrderConfirmation({
    to: order.contact_email,
    customerName: order.customer_name,
    orderId: order.id,
  });
}

/** Idempotently mark a B2B order paid and create its workspace once. */
async function provisionB2b(
  admin: Admin,
  orderId: string,
  invoiceId: string | null,
  amountPaid: number | null,
) {
  const { data: order, error } = await admin
    .from("b2b_orders")
    .select(
      "id, status, licenses_purchased, contact_email, company_name, project_name, owner_token",
    )
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error(`B2B order ${orderId} not found`);

  if (order.status !== "paid") {
    const { error: updErr } = await admin
      .from("b2b_orders")
      .update({
        status: "paid",
        icount_invoice_id: invoiceId,
        ...(amountPaid != null ? { amount_paid: amountPaid } : {}),
      })
      .eq("id", orderId)
      .neq("status", "paid");
    if (updErr) throw new Error(updErr.message);
  }

  // Idempotency: only create a workspace if none exists for this order.
  const { data: existing } = await admin
    .from("b2b_workspaces")
    .select("id")
    .eq("b2b_order_id", orderId)
    .limit(1);

  if (!existing || existing.length === 0) {
    const { error: wsErr } = await admin.from("b2b_workspaces").insert({
      b2b_order_id: orderId,
      max_slots: order.licenses_purchased,
      active: true,
      expiration_date: new Date(Date.now() + WORKSPACE_TTL_MS).toISOString(),
    });
    if (wsErr) throw new Error(wsErr.message);

    // Email the owner their private dashboard link (best-effort; the link is
    // also shown on the thank-you page, so a failed send is non-fatal). Only
    // sent once, alongside first provisioning, to avoid duplicate emails.
    await sendOwnerWelcome({
      to: order.contact_email,
      companyName: order.company_name,
      projectName: order.project_name,
      ownerToken: order.owner_token,
    });
  }
}

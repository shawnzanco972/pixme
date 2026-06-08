/**
 * Order provisioning — the single authoritative path that turns a PENDING order
 * into a PAID one (and, for B2B, creates its workspace).
 *
 * Extracted from the iCount webhook so BOTH the real payment flow and the admin
 * SANDBOX (test-checkout) run identical logic. The only difference is the
 * trigger: a verified iCount transaction vs. an admin clicking "simulate".
 *
 * Every function here is idempotent — calling twice never double-provisions.
 * Server-only: it uses the service-role client.
 */
import "server-only";

import { sendOrderConfirmation, sendOwnerWelcome } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

// B2B workspaces expire one year after provisioning by default.
export const WORKSPACE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface ProvisionOptions {
  /** Send the customer/owner email. Disabled by the sandbox. Default true. */
  notify?: boolean;
}

/** Idempotently mark a B2C order paid. */
export async function provisionB2c(
  admin: Admin,
  orderId: string,
  invoiceId: string | null,
  opts: ProvisionOptions = {},
): Promise<void> {
  const { notify = true } = opts;
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

  if (notify) {
    // Best-effort confirmation email (no-op until email is configured).
    await sendOrderConfirmation({
      to: order.contact_email,
      customerName: order.customer_name,
      orderId: order.id,
    });
  }
}

/** Idempotently mark a B2B order paid and create its workspace once. */
export async function provisionB2b(
  admin: Admin,
  orderId: string,
  invoiceId: string | null,
  amountPaid: number | null,
  opts: ProvisionOptions = {},
): Promise<void> {
  const { notify = true } = opts;
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

    if (notify) {
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
}

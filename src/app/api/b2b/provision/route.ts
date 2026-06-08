/**
 * POST /api/b2b/provision  { orderId }
 *
 * Admin-only manual provisioning — mirrors what the iCount webhook does on a
 * real payment (mark paid + create the workspace once + email the owner their
 * dashboard link). This is the way to exercise the whole B2B flow WITHOUT a
 * real transaction. Idempotent: re-running won't duplicate the workspace.
 */
import { NextResponse } from "next/server";

import { sendOwnerWelcome } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WORKSPACE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  // Gate on an authenticated admin session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("b2b_orders")
    .select(
      "id, status, licenses_purchased, contact_email, company_name, project_name, owner_token",
    )
    .eq("id", body.orderId)
    .single();
  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "paid") {
    await admin
      .from("b2b_orders")
      .update({ status: "paid" })
      .eq("id", order.id)
      .neq("status", "paid");
  }

  // Create the workspace only if none exists yet (idempotent).
  const { data: existing } = await admin
    .from("b2b_workspaces")
    .select("id")
    .eq("b2b_order_id", order.id)
    .limit(1);

  let emailed = false;
  if (!existing || existing.length === 0) {
    const { error: wsErr } = await admin.from("b2b_workspaces").insert({
      b2b_order_id: order.id,
      max_slots: order.licenses_purchased,
      active: true,
      expiration_date: new Date(Date.now() + WORKSPACE_TTL_MS).toISOString(),
    });
    if (wsErr) {
      return NextResponse.json({ error: wsErr.message }, { status: 500 });
    }
    emailed = await sendOwnerWelcome({
      to: order.contact_email,
      companyName: order.company_name,
      projectName: order.project_name,
      ownerToken: order.owner_token,
    });
  }

  return NextResponse.json({ ok: true, ownerToken: order.owner_token, emailed });
}

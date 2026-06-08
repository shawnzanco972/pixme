/**
 * POST /api/b2b/invite  { ownerToken, rosterId }
 *
 * (Re)send one employee's personalized seat-link email. Owner-gated via the
 * secret owner_token; we verify the roster seat actually belongs to that
 * owner's workspace before sending.
 */
import { NextResponse } from "next/server";

import { isEmailConfigured, sendSeatInvite } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { ownerToken?: string; rosterId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.ownerToken || !body.rosterId) {
    return NextResponse.json(
      { error: "Missing ownerToken or rosterId" },
      { status: 400 },
    );
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  // Resolve the owner's workspace, then confirm the seat belongs to it.
  const { data: order } = await admin
    .from("b2b_orders")
    .select("id, project_name, company_name")
    .eq("owner_token", body.ownerToken)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const { data: ws } = await admin
    .from("b2b_workspaces")
    .select("id")
    .eq("b2b_order_id", order.id)
    .maybeSingle();

  const { data: seat } = await admin
    .from("employee_roster")
    .select("name, email, invite_token, workspace_id")
    .eq("id", body.rosterId)
    .maybeSingle();
  if (!seat || !ws || seat.workspace_id !== ws.id) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }
  if (!seat.email) {
    return NextResponse.json(
      { error: "This employee has no email on file" },
      { status: 422 },
    );
  }

  const ok = await sendSeatInvite({
    to: seat.email,
    employeeName: seat.name,
    projectLabel: order.project_name || order.company_name,
    inviteToken: seat.invite_token,
  });
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Failed to send" }, { status: 502 });
}

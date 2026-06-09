/**
 * POST /api/b2b/owner/action
 *   review : { ownerToken, submissionId, action: approve|reject|reopen|schedule, scheduledFor? }
 *   pool   : { ownerToken, rosterId, action: "allocate", plates }
 *            { ownerToken, action: "buy_credits", plates }
 *
 * Project-owner actions, gated by the secret owner_token (no login), served with
 * the service-role key. Reviews drive a submission's status/date; pool actions
 * redistribute or grow the project's plate capacity. Everything is validated
 * against the order the owner_token resolves to — the ids are never trusted.
 */
import { NextResponse } from "next/server";

import { defaultAllocation, totalPlateCredits } from "@/lib/b2b";
import { createAdminClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/types";

export const runtime = "nodejs";

type Action =
  | "approve"
  | "reject"
  | "reopen"
  | "schedule"
  | "allocate"
  | "buy_credits";

export async function POST(request: Request) {
  let body: {
    ownerToken?: string;
    submissionId?: string;
    rosterId?: string;
    action?: Action;
    scheduledFor?: string | null;
    plates?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ownerToken, action } = body;
  if (!ownerToken || !action) {
    return NextResponse.json(
      { error: "Missing ownerToken or action" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("b2b_orders")
    .select(
      "id, plates_x, plates_y, licenses_purchased, extra_plate_credits",
    )
    .eq("owner_token", ownerToken)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: workspaces } = await admin
    .from("b2b_workspaces")
    .select("id")
    .eq("b2b_order_id", order.id);
  const wsIds = (workspaces ?? []).map((w) => w.id);

  // --- Pool: grow total capacity ------------------------------------------
  if (action === "buy_credits") {
    const add = Math.max(0, Math.floor(body.plates ?? 0));
    if (add <= 0) {
      return NextResponse.json({ error: "Invalid plates" }, { status: 400 });
    }
    const { error } = await admin
      .from("b2b_orders")
      .update({ extra_plate_credits: order.extra_plate_credits + add })
      .eq("id", order.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Pool: reallocate plates to one seat --------------------------------
  if (action === "allocate") {
    const plates = Math.max(1, Math.floor(body.plates ?? 0));
    if (!body.rosterId) {
      return NextResponse.json({ error: "Missing rosterId" }, { status: 400 });
    }
    // The seat must belong to this project.
    const { data: seat } = await admin
      .from("employee_roster")
      .select("id, workspace_id")
      .eq("id", body.rosterId)
      .maybeSingle();
    if (!seat || !wsIds.includes(seat.workspace_id)) {
      return NextResponse.json(
        { error: "Seat not part of this project" },
        { status: 403 },
      );
    }
    // Validate against the pool: others' effective allocations + new ≤ total.
    const { data: allSeats } = await admin
      .from("employee_roster")
      .select("id, plates_allocated")
      .in("workspace_id", wsIds);
    const dflt = defaultAllocation(order);
    const usedByOthers = (allSeats ?? [])
      .filter((s) => s.id !== seat.id)
      .reduce((sum, s) => sum + (s.plates_allocated ?? dflt), 0);
    if (usedByOthers + plates > totalPlateCredits(order)) {
      return NextResponse.json(
        { error: "Exceeds the project's plate pool" },
        { status: 409 },
      );
    }
    const { error } = await admin
      .from("employee_roster")
      .update({ plates_allocated: plates })
      .eq("id", seat.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Review a submission -------------------------------------------------
  const { submissionId } = body;
  if (!submissionId) {
    return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
  }
  const { data: sub } = await admin
    .from("employee_submissions")
    .select("id, workspace_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub || !wsIds.includes(sub.workspace_id)) {
    return NextResponse.json(
      { error: "Submission not part of this project" },
      { status: 403 },
    );
  }

  const scheduledFor =
    typeof body.scheduledFor === "string" && body.scheduledFor
      ? new Date(body.scheduledFor).toISOString()
      : null;

  let patch: TablesUpdate<"employee_submissions">;
  switch (action) {
    case "approve":
      patch = {
        status: "ready",
        approved_at: new Date().toISOString(),
        scheduled_for: scheduledFor,
      };
      break;
    case "reject":
      patch = { status: "rejected", approved_at: null };
      break;
    case "reopen":
      patch = { status: "pending", approved_at: null };
      break;
    case "schedule":
      patch = { scheduled_for: scheduledFor };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error: updErr } = await admin
    .from("employee_submissions")
    .update(patch)
    .eq("id", submissionId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

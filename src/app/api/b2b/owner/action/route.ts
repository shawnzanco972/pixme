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
  | "buy_credits"
  | "rename"
  | "remove"
  | "ship";

export async function POST(request: Request) {
  let body: {
    ownerToken?: string;
    submissionId?: string;
    /** Batch review: approve/reject/release several seats in one request. */
    submissionIds?: string[];
    rosterId?: string;
    action?: Action;
    scheduledFor?: string | null;
    plates?: number;
    name?: string;
    email?: string | null;
    note?: string | null;
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

  // --- Roster: fix a name / email ------------------------------------------
  if (action === "rename") {
    if (!body.rosterId) {
      return NextResponse.json({ error: "Missing rosterId" }, { status: 400 });
    }
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const email = body.email?.trim() ? body.email.trim() : null;
    const { data: seat } = await admin
      .from("employee_roster")
      .select("id, workspace_id")
      .eq("id", body.rosterId)
      .maybeSingle();
    if (!seat || !wsIds.includes(seat.workspace_id)) {
      return NextResponse.json({ error: "Seat not in project" }, { status: 403 });
    }
    const { error } = await admin
      .from("employee_roster")
      .update({ name, email })
      .eq("id", seat.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Roster: remove a seat ------------------------------------------------
  //
  // Only a seat with no submission can go. A seat that already holds a design
  // must be reopened/rejected first — deleting it would silently destroy work
  // the employee did and drop a slot the company paid for.
  if (action === "remove") {
    if (!body.rosterId) {
      return NextResponse.json({ error: "Missing rosterId" }, { status: 400 });
    }
    const { data: seat } = await admin
      .from("employee_roster")
      .select("id, workspace_id")
      .eq("id", body.rosterId)
      .maybeSingle();
    if (!seat || !wsIds.includes(seat.workspace_id)) {
      return NextResponse.json({ error: "Seat not in project" }, { status: 403 });
    }
    const { count } = await admin
      .from("employee_submissions")
      .select("id", { count: "exact", head: true })
      .eq("roster_id", seat.id);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "לעובד הזה כבר יש עיצוב — בטלו אותו לפני ההסרה." },
        { status: 409 },
      );
    }
    const { error } = await admin
      .from("employee_roster")
      .delete()
      .eq("id", seat.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Fulfillment: release approved seats as one shipment -----------------
  //
  // The owner picks WHICH approved seats go out now. Everything ships in bulk
  // to the company, so a shipment carries no address — just the set of seats
  // and an optional note.
  if (action === "ship") {
    const ids = (body.submissionIds ?? []).filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (ids.length === 0) {
      return NextResponse.json({ error: "No seats selected" }, { status: 400 });
    }
    // Every id must be an approved, not-yet-released seat in THIS project.
    const { data: subs } = await admin
      .from("employee_submissions")
      .select("id, workspace_id, status, shipment_id")
      .in("id", ids);
    const eligible = (subs ?? []).filter(
      (s) =>
        wsIds.includes(s.workspace_id) &&
        s.status === "ready" &&
        !s.shipment_id,
    );
    if (eligible.length === 0) {
      return NextResponse.json(
        { error: "אין עיצובים מאושרים וזמינים לשליחה." },
        { status: 409 },
      );
    }
    const { data: shipment, error: shipErr } = await admin
      .from("b2b_shipments")
      .insert({
        b2b_order_id: order.id,
        note: body.note?.trim() || null,
      })
      .select("id")
      .single();
    if (shipErr || !shipment) {
      return NextResponse.json(
        { error: shipErr?.message ?? "Could not create shipment" },
        { status: 500 },
      );
    }
    const { error: linkErr } = await admin
      .from("employee_submissions")
      .update({ shipment_id: shipment.id })
      .in(
        "id",
        eligible.map((s) => s.id),
      );
    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      shipmentId: shipment.id,
      released: eligible.length,
    });
  }

  // --- Review one or many submissions --------------------------------------
  //
  // `submissionIds` is the batch form (approve-all); `submissionId` the single.
  // Batching matters: the old dashboard fired one request per seat in a loop,
  // so approving 40 designs meant 40 round-trips and any mid-loop failure left
  // the roster half-approved with no report.
  const ids = (
    body.submissionIds?.length ? body.submissionIds : [body.submissionId]
  ).filter((v): v is string => typeof v === "string" && v.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
  }
  const { data: subs } = await admin
    .from("employee_submissions")
    .select("id, workspace_id, shipment_id")
    .in("id", ids);
  const owned = (subs ?? []).filter((s) => wsIds.includes(s.workspace_id));
  if (owned.length !== ids.length) {
    return NextResponse.json(
      { error: "Submission not part of this project" },
      { status: 403 },
    );
  }
  // A released seat is already in production — reopening or rejecting it here
  // would desync us from what's physically being packed.
  if (
    (action === "reopen" || action === "reject") &&
    owned.some((s) => s.shipment_id)
  ) {
    return NextResponse.json(
      { error: "עיצוב שכבר נשלח לייצור לא ניתן לשינוי." },
      { status: 409 },
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
    .in("id", ids);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: ids.length });
}

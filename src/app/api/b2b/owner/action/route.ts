/**
 * POST /api/b2b/owner/action
 *   { ownerToken, submissionId, action, scheduledFor? }
 *
 * Project-owner review actions, gated by the secret owner_token (no login),
 * served with the service-role key. The owner approves an employee's design
 * (→ "ready", which queues it for production), asks for a redo ("rejected"),
 * reopens an approval, or sets a per-employee fulfillment date.
 *
 * action ∈ "approve" | "reject" | "reopen" | "schedule"
 *  - approve  → status "ready", approved_at = now, scheduled_for = scheduledFor
 *  - reject   → status "rejected" (employee can edit + resubmit)
 *  - reopen   → status "pending"  (back to awaiting review)
 *  - schedule → only updates scheduled_for (keeps current status)
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/types";

export const runtime = "nodejs";

type Action = "approve" | "reject" | "reopen" | "schedule";

export async function POST(request: Request) {
  let body: {
    ownerToken?: string;
    submissionId?: string;
    action?: Action;
    scheduledFor?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ownerToken, submissionId, action } = body;
  if (!ownerToken || !submissionId || !action) {
    return NextResponse.json(
      { error: "Missing ownerToken, submissionId, or action" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Resolve the owner's order → its workspaces, so we can verify the submission
  // actually belongs to this project (never trust the submissionId alone).
  const { data: order } = await admin
    .from("b2b_orders")
    .select("id")
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

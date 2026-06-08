/**
 * POST /api/b2b/roster  { ownerToken, entries: [{ name, email? }] }
 *
 * Owner adds employees to their project roster. Gated by the secret owner_token
 * (not a login) and served with the service-role key. Capped at the purchased
 * seat count so a project can never over-issue invites.
 */
import { NextResponse } from "next/server";

import { sendSeatInvite } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Entry {
  name?: unknown;
  email?: unknown;
}

export async function POST(request: Request) {
  let body: { ownerToken?: string; entries?: Entry[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ownerToken = body.ownerToken;
  const entries = (body.entries ?? [])
    .map((e) => ({
      name: typeof e.name === "string" ? e.name.trim() : "",
      email: typeof e.email === "string" && e.email.trim() ? e.email.trim() : null,
    }))
    .filter((e) => e.name);

  if (!ownerToken || entries.length === 0) {
    return NextResponse.json(
      { error: "Missing ownerToken or entries" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("b2b_orders")
    .select("id, licenses_purchased, project_name, company_name")
    .eq("owner_token", ownerToken)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: ws } = await admin
    .from("b2b_workspaces")
    .select("id, max_slots")
    .eq("b2b_order_id", order.id)
    .maybeSingle();
  if (!ws) {
    return NextResponse.json(
      { error: "Project not provisioned yet (payment pending)" },
      { status: 409 },
    );
  }

  // Enforce the seat cap against the existing roster size.
  const { count } = await admin
    .from("employee_roster")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws.id);
  const used = count ?? 0;
  const seatsLeft = order.licenses_purchased - used;
  if (entries.length > seatsLeft) {
    return NextResponse.json(
      { error: `Only ${Math.max(0, seatsLeft)} seats remaining` },
      { status: 409 },
    );
  }

  const { data: inserted, error: insErr } = await admin
    .from("employee_roster")
    .insert(
      entries.map((e) => ({
        workspace_id: ws.id,
        name: e.name,
        email: e.email,
      })),
    )
    .select("name, email, invite_token");
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Best-effort: email a personalized seat link to everyone we have an address
  // for. No-ops when email isn't configured; never fails the request.
  const projectLabel = order.project_name || order.company_name;
  let invited = 0;
  await Promise.all(
    (inserted ?? []).map(async (r) => {
      if (!r.email) return;
      const ok = await sendSeatInvite({
        to: r.email,
        employeeName: r.name,
        projectLabel,
        inviteToken: r.invite_token,
      });
      if (ok) invited++;
    }),
  );

  return NextResponse.json({ ok: true, added: entries.length, invited });
}

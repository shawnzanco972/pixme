/**
 * POST /api/b2b/submit  { inviteToken, imagePath, pixelMap }
 *
 * Records one employee's mosaic submission. Gated by the roster invite_token
 * (not a login). Runs with the service-role key so it can link the submission
 * back to the roster seat — which is how the owner dashboard knows who's done.
 * Idempotent per seat: a seat that already submitted is rejected.
 *
 * The DB trigger on employee_submissions still enforces that the workspace is
 * active, not expired, and has a free slot (and increments slots_used).
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

function isPixelMap(v: unknown): v is number[][] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((row) => Array.isArray(row) && row.every((n) => typeof n === "number"))
  );
}

export async function POST(request: Request) {
  let body: { inviteToken?: string; imagePath?: string; pixelMap?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.inviteToken || !isPixelMap(body.pixelMap)) {
    return NextResponse.json(
      { error: "Missing inviteToken or a valid pixelMap" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: seat } = await admin
    .from("employee_roster")
    .select("id, name, workspace_id, submission_id")
    .eq("invite_token", body.inviteToken)
    .maybeSingle();
  if (!seat) {
    return NextResponse.json({ error: "Invalid seat link" }, { status: 404 });
  }
  if (seat.submission_id) {
    return NextResponse.json(
      { error: "This seat has already submitted" },
      { status: 409 },
    );
  }

  // Insert the submission (trigger validates workspace + increments slots).
  const { data: sub, error: insErr } = await admin
    .from("employee_submissions")
    .insert({
      workspace_id: seat.workspace_id,
      employee_name: seat.name,
      image_url: body.imagePath ?? null,
      pixel_map: body.pixelMap as Json,
      roster_id: seat.id,
    })
    .select("id")
    .single();

  if (insErr || !sub) {
    return NextResponse.json(
      { error: "Project is full or inactive" },
      { status: 409 },
    );
  }

  // Link the seat to its submission so the owner dashboard reflects it.
  await admin
    .from("employee_roster")
    .update({ submission_id: sub.id })
    .eq("id", seat.id);

  return NextResponse.json({ ok: true, submissionId: sub.id });
}

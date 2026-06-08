/**
 * POST /api/admin/client-notes  { email, notes }  — admin-only.
 *
 * Upserts a CRM note on a client (by email). Creates the client row if it
 * doesn't exist yet, so notes can be added even before the first paid order.
 */
import { NextResponse } from "next/server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("clients")
    .upsert(
      { email, notes: body.notes ?? null },
      { onConflict: "email", ignoreDuplicates: false },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

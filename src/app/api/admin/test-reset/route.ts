/**
 * POST /api/admin/test-reset  — delete ALL sandbox data (admin-only).
 *
 * Removes every `is_test = true` B2C and B2B order. B2B deletes cascade to the
 * workspace → roster → submissions (FKs declared `on delete cascade`), so one
 * delete per order is enough. Real orders are never touched.
 */
import { NextResponse } from "next/server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: b2c, error: e1 } = await admin
    .from("b2c_orders")
    .delete()
    .eq("is_test", true)
    .select("id");
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  const { data: b2b, error: e2 } = await admin
    .from("b2b_orders")
    .delete()
    .eq("is_test", true)
    .select("id");
  if (e2) {
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: { b2c: b2c?.length ?? 0, b2b: b2b?.length ?? 0 },
  });
}

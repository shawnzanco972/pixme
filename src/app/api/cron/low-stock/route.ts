/**
 * GET /api/cron/low-stock — daily low-stock digest (Vercel Cron).
 *
 * Computes alerts via the shared inventory engine (service-role client, since
 * there's no admin session in a cron) and emails the operator a digest. No-ops
 * cleanly when email isn't configured or nothing is below threshold.
 *
 * Guarded by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`.
 * When CRON_SECRET is unset (local dev) the guard is open so it can be tested.
 */
import { NextResponse } from "next/server";

import { sendLowStockDigest } from "@/lib/email";
import { loadInventory } from "@/lib/inventory-data";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const { alerts } = await loadInventory(admin);

  const sent = await sendLowStockDigest({
    alerts: alerts.map((a) => ({
      name: a.name,
      category: a.category,
      unit: a.unit,
      available: a.available,
      threshold: a.threshold,
      shortfall: a.shortfall,
    })),
  });

  return NextResponse.json({ ok: true, alerts: alerts.length, emailed: sent });
}

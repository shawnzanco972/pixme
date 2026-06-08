/**
 * POST /api/admin/test-checkout  — SANDBOX purchase (admin-only).
 *
 * Runs the REAL order→provision path but skips iCount entirely: it creates an
 * `is_test = true` order and immediately provisions it via the same
 * `provisionB2c` / `provisionB2b` functions the live webhook calls. This lets
 * the operator exercise the full B2C and B2B flows (owner dashboard + employee
 * seat link) before real payments are switched on — with zero rework when they
 * are, since production checkout is untouched.
 *
 * Gated by the signed-in admin session (same auth as /admin pages). Emails are
 * suppressed (notify:false) so test runs never spam real inboxes.
 *
 * Body (B2C): { track:"b2c", customer_name?, contact_email?, fulfillment_type?,
 *               preset_id? }
 * Body (B2B): { track:"b2b", company_name?, contact_email?, preset_id?,
 *               employees?, managed?, seat_name? }
 */
import { NextResponse } from "next/server";

import { CATALOG, isCore } from "@/lib/brick-engine/palette";
import { computeB2bQuote } from "@/lib/b2b-pricing";
import { provisionB2b, provisionB2c } from "@/lib/provision";
import { computePrice, presetById, presetStuds } from "@/lib/pricing";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { FulfillmentType } from "@/lib/supabase/types.helpers";

export const runtime = "nodejs";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

// Core color ids only — a sandbox map should never reference out-of-stock boost
// colors. Deterministic so the same preset always yields the same sample.
const CORE_COLOR_IDS = CATALOG.filter((c) => isCore(c.id)).map((c) => c.id);

/** Build a deterministic, vaguely picture-like sample pixel_map (core colors). */
function samplePixelMap(cols: number, rows: number): number[][] {
  const palette = CORE_COLOR_IDS;
  const map: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols; x++) {
      // Coarse 6×6 blocks cycling through the core palette → realistic part mix.
      const block = (Math.floor(x / 6) + Math.floor(y / 6)) % palette.length;
      row.push(palette[block]);
    }
    map.push(row);
  }
  return map;
}

export async function POST(request: Request) {
  // Admin gate: act as the cookie-bound session, exactly like the /admin pages.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const track = body.track;

  try {
    if (track === "b2c") {
      const customerName =
        (body.customer_name as string)?.trim() || "בדיקה — לקוח";
      const contactEmail =
        (body.contact_email as string)?.trim() || "test@pixipic.test";
      const fulfillment: FulfillmentType =
        body.fulfillment_type === "physical" ? "physical" : "digital";
      const preset = presetById(String(body.preset_id ?? "2x2")) ??
        presetById("2x2")!;
      const { cols, rows } = presetStuds(preset);
      const pixelMap = samplePixelMap(cols, rows);
      const totalPrice = computePrice(cols, rows, fulfillment).total;

      const { data, error } = await admin
        .from("b2c_orders")
        .insert({
          customer_name: customerName,
          contact_email: contactEmail,
          total_price: totalPrice,
          fulfillment_type: fulfillment,
          pixel_map: pixelMap as Json,
          intent: "self",
          status: "pending",
          is_test: true,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create test B2C order");
      }

      // Same provisioning the webhook would run on a verified payment.
      await provisionB2c(admin, data.id, "TEST-INVOICE", { notify: false });

      return NextResponse.json({
        ok: true,
        track: "b2c",
        orderId: data.id,
        totalPrice,
        size: `${cols}×${rows}`,
        links: {
          order: `${siteUrl()}/order/${data.id}`,
          admin: `${siteUrl()}/admin/orders/${data.id}`,
        },
      });
    }

    if (track === "b2b") {
      const companyName =
        (body.company_name as string)?.trim() || "בדיקה — חברה";
      const contactEmail =
        (body.contact_email as string)?.trim() || "owner@pixipic.test";
      const seatName = (body.seat_name as string)?.trim() || "עובד לדוגמה";
      const preset = presetById(String(body.preset_id ?? "2x2")) ??
        presetById("2x2")!;
      const employees = Math.max(1, Number(body.employees ?? 3));
      const managed = body.managed === true;

      const quote = computeB2bQuote(employees, preset.id, managed);
      if (quote.requiresQuote) {
        return NextResponse.json(
          { error: "Employee count exceeds the self-serve limit" },
          { status: 422 },
        );
      }

      const { data, error } = await admin
        .from("b2b_orders")
        .insert({
          company_name: companyName,
          contact_email: contactEmail,
          project_name: "פרויקט בדיקה",
          plates_x: preset.platesX,
          plates_y: preset.platesY,
          licenses_purchased: quote.employees,
          managed,
          amount_paid: 0,
          status: "pending",
          is_test: true,
        })
        .select("id, owner_token")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create test B2B order");
      }

      // Mark paid + create the workspace, exactly like the webhook.
      await provisionB2b(admin, data.id, "TEST-INVOICE", quote.total, {
        notify: false,
      });

      // Seed one roster seat so the employee upload link is testable end-to-end.
      const { data: ws } = await admin
        .from("b2b_workspaces")
        .select("id")
        .eq("b2b_order_id", data.id)
        .single();
      let seatUrl: string | null = null;
      if (ws) {
        const { data: seat } = await admin
          .from("employee_roster")
          .insert({ workspace_id: ws.id, name: seatName, email: null })
          .select("invite_token")
          .single();
        if (seat) seatUrl = `${siteUrl()}/seat/${seat.invite_token}`;
      }

      return NextResponse.json({
        ok: true,
        track: "b2b",
        orderId: data.id,
        amount: quote.total,
        employees: quote.employees,
        size: `${quote.cols}×${quote.rows}`,
        links: {
          owner: `${siteUrl()}/b2b/project/${data.owner_token}`,
          seat: seatUrl,
          admin: `${siteUrl()}/admin/b2b/${data.id}`,
        },
      });
    }

    return NextResponse.json(
      { error: "Unknown or missing 'track' (expected 'b2c' or 'b2b')" },
      { status: 400 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Test checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

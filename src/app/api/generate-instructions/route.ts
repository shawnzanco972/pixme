/**
 * POST /api/generate-instructions
 *
 * Returns a printable PDF build manual for a mosaic. TRUSTS the pixel_map
 * (CLAUDE.md): it never re-runs image processing — it only renders.
 *
 * Body (either form):
 *   { pixelMap: number[][] }            — render an ad-hoc map
 *   { orderId: string, track?: "b2c" }  — fetch the stored map for an order
 */
import { NextResponse } from "next/server";

import { buildInstructionsPdf } from "@/lib/pdf/instructions";
import { HEEBO_TTF_BASE64 } from "@/lib/pdf/heebo-font";
import { createAdminClient } from "@/lib/supabase/server";
import type { PixelMap } from "@/lib/supabase/types.helpers";

export const runtime = "nodejs";

function isPixelMap(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (row) => Array.isArray(row) && row.every((n) => typeof n === "number"),
    )
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    let pixelMap: number[][] | null = null;

    if (isPixelMap(body.pixelMap)) {
      pixelMap = body.pixelMap;
    } else if (typeof body.orderId === "string") {
      // Fetch the stored map for a paid order (service-role; trusted context).
      const admin = createAdminClient();
      const table =
        body.track === "b2b" ? "employee_submissions" : "b2c_orders";
      const { data, error } = await admin
        .from(table)
        .select("pixel_map")
        .eq("id", body.orderId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: `Order ${body.orderId} not found` },
          { status: 404 },
        );
      }
      const stored = (data as { pixel_map: PixelMap | null }).pixel_map;
      if (!isPixelMap(stored)) {
        return NextResponse.json(
          { error: "Order has no pixel_map yet" },
          { status: 422 },
        );
      }
      pixelMap = stored;
    } else {
      return NextResponse.json(
        { error: "Provide either pixelMap or orderId" },
        { status: 400 },
      );
    }

    const pdf = buildInstructionsPdf(pixelMap, {
      title: typeof body.title === "string" ? body.title : undefined,
      hebrewFontBase64: HEEBO_TTF_BASE64,
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="pixme-instructions.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

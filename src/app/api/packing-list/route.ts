/**
 * POST /api/packing-list  { orderId, track? }
 *
 * Admin-only weigh-and-pack sheet (PDF). Requires an authenticated admin
 * session — unlike the customer instructions, this is internal fulfillment data.
 */
import { NextResponse } from "next/server";

import { buildPackingListPdf } from "@/lib/pdf/packing";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { PixelMap } from "@/lib/supabase/types.helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Gate on an admin session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderId?: string };
  try {
    body = (await request.json()) as { orderId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("b2c_orders")
    .select("pixel_map, customer_name")
    .eq("id", body.orderId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const pixelMap = (data as { pixel_map: PixelMap | null }).pixel_map;
  if (!Array.isArray(pixelMap)) {
    return NextResponse.json(
      { error: "Order has no pixel_map" },
      { status: 422 },
    );
  }

  const pdf = buildPackingListPdf(pixelMap, {
    orderId: body.orderId,
    customerName: (data as { customer_name?: string }).customer_name,
  });

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pixme-packing-${body.orderId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * POST /api/checkout
 *
 * Creates a PENDING order (server-side, service-role) and returns an iCount
 * hosted-checkout URL. The browser then redirects the buyer to that URL.
 * Money becomes authoritative only when the iCount webhook confirms payment.
 *
 * Body (B2C): { track: "b2c", customer_name, contact_email, total_price,
 *               fulfillment_type?, image_url?, pixel_map?, shipping_address? }
 * Body (B2B): { track: "b2b", company_name, contact_email, licenses_purchased,
 *               amount }
 */
import { NextResponse } from "next/server";

import { computeB2bQuoteByPlates } from "@/lib/b2b-pricing";
import { createCheckout } from "@/lib/icount";
import { computePrice, GIFT_WRAP_FEE, presetById } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { FulfillmentType } from "@/lib/supabase/types.helpers";

/** Minimal pixel_map shape guard (row-major 2D number array). */
function isPixelMap(v: unknown): v is number[][] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((row) => Array.isArray(row) && row.every((n) => typeof n === "number"))
  );
}

export const runtime = "nodejs";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** iCount is considered configured once an API token is present. */
function paymentsConfigured(): boolean {
  return Boolean(process.env.ICOUNT_API_TOKEN);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const track = body.track;
  const admin = createAdminClient();

  try {
    if (track === "b2c") {
      const contactEmail = String(body.contact_email ?? "");
      const customerName = String(body.customer_name ?? "");
      const fulfillment: FulfillmentType =
        body.fulfillment_type === "physical" ? "physical" : "digital";
      const intent = body.intent === "gift" ? "gift" : "self";
      const giftWrap = intent === "gift" && body.gift_wrap === true;
      const deliverTo =
        intent === "gift" && body.deliver_to === "recipient"
          ? "recipient"
          : "buyer";

      // Price is authoritative here: derived from the pixel_map's size, never
      // trusted from the client. Falls back to total_price only if no map.
      const pixelMap = isPixelMap(body.pixel_map) ? body.pixel_map : null;
      let totalPrice: number;
      if (pixelMap) {
        const rows = pixelMap.length;
        const cols = rows > 0 ? pixelMap[0].length : 0;
        totalPrice =
          computePrice(cols, rows, fulfillment).total +
          (giftWrap ? GIFT_WRAP_FEE : 0);
      } else {
        totalPrice = Number(body.total_price ?? 0);
      }
      if (!contactEmail || !customerName || !(totalPrice > 0)) {
        return NextResponse.json(
          { error: "Missing customer_name, contact_email, or a priced design" },
          { status: 400 },
        );
      }

      const { data, error } = await admin
        .from("b2c_orders")
        .insert({
          customer_name: customerName,
          contact_email: contactEmail,
          total_price: totalPrice,
          fulfillment_type: fulfillment,
          image_url: (body.image_url as string) ?? null,
          pixel_map: (body.pixel_map as Json) ?? null,
          shipping_address: (body.shipping_address as Json) ?? null,
          intent,
          gift_message:
            typeof body.gift_message === "string" ? body.gift_message : null,
          gift_wrap: giftWrap,
          deliver_to: deliverTo,
          recipient_name:
            typeof body.recipient_name === "string"
              ? body.recipient_name
              : null,
          recipient_address: (body.recipient_address as Json) ?? null,
          status: "pending",
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create B2C order");
      }

      // If iCount isn't configured yet, return the order page so the full
      // upload→order flow works; payment activates once creds are set.
      if (!paymentsConfigured()) {
        return NextResponse.json({
          orderId: data.id,
          url: `${siteUrl()}/order/${data.id}`,
          paymentConfigured: false,
        });
      }

      const checkout = await createCheckout({
        orderId: data.id,
        track: "b2c",
        amount: totalPrice,
        description: "Pixipic — הזמנת פסיפס",
        customerEmail: contactEmail,
        customerName,
        successUrl: `${siteUrl()}/order/${data.id}`,
        ipnUrl: `${siteUrl()}/api/webhooks/icount`,
      });

      return NextResponse.json({ orderId: data.id, url: checkout.url });
    }

    if (track === "b2b") {
      const contactEmail = String(body.contact_email ?? "");
      const companyName = String(body.company_name ?? "");
      const projectName = body.project_name
        ? String(body.project_name)
        : null;
      // Size (width × height plates) + employee count + upsell are the inputs;
      // the price is recomputed authoritatively here (never trusted from the
      // body) so it always equals employees × the regular physical mosaic price
      // (+ managed fee). Falls back to a named preset for older callers.
      const employees = Number(body.employees ?? 0);
      const managed = body.managed === true;
      let platesX = Math.floor(Number(body.plates_x));
      let platesY = Math.floor(Number(body.plates_y));
      if (!(platesX > 0) || !(platesY > 0)) {
        const preset = presetById(String(body.preset_id ?? ""));
        if (preset) {
          platesX = preset.platesX;
          platesY = preset.platesY;
        }
      }
      if (
        !contactEmail ||
        !companyName ||
        !(platesX > 0) ||
        !(platesY > 0) ||
        !(employees > 0)
      ) {
        return NextResponse.json(
          {
            error:
              "Missing company_name, contact_email, a valid size, or employees",
          },
          { status: 400 },
        );
      }

      const quote = computeB2bQuoteByPlates(employees, platesX, platesY, managed);
      if (quote.requiresQuote) {
        return NextResponse.json(
          { error: "Order exceeds self-serve limit — request a quote instead" },
          { status: 422 },
        );
      }

      const { data, error } = await admin
        .from("b2b_orders")
        .insert({
          company_name: companyName,
          contact_email: contactEmail,
          project_name: projectName,
          plates_x: platesX,
          plates_y: platesY,
          licenses_purchased: quote.employees,
          managed,
          amount_paid: 0, // set authoritatively on payment confirmation
          status: "pending",
        })
        .select("id, owner_token")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create B2B order");
      }

      const ownerUrl = `${siteUrl()}/b2b/project/${data.owner_token}`;

      if (!paymentsConfigured()) {
        return NextResponse.json({
          orderId: data.id,
          ownerToken: data.owner_token,
          url: `${siteUrl()}/b2b/thank-you?order=${data.id}`,
          paymentConfigured: false,
        });
      }

      const checkout = await createCheckout({
        orderId: data.id,
        track: "b2b",
        amount: quote.total,
        description: `Pixipic — ${quote.employees} מתנות לעובדים (${quote.cols}×${quote.rows})`,
        customerEmail: contactEmail,
        customerName: companyName,
        successUrl: `${siteUrl()}/b2b/thank-you?order=${data.id}`,
        ipnUrl: `${siteUrl()}/api/webhooks/icount`,
      });

      return NextResponse.json({
        orderId: data.id,
        ownerToken: data.owner_token,
        ownerUrl,
        url: checkout.url,
      });
    }

    return NextResponse.json(
      { error: "Unknown or missing 'track' (expected 'b2c' or 'b2b')" },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

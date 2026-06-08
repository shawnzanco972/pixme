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

import { computeB2bQuote } from "@/lib/b2b-pricing";
import { createCheckout } from "@/lib/icount";
import { presetById } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

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
      const totalPrice = Number(body.total_price ?? 0);
      if (!contactEmail || !customerName || !(totalPrice > 0)) {
        return NextResponse.json(
          { error: "Missing customer_name, contact_email, or total_price" },
          { status: 400 },
        );
      }

      const { data, error } = await admin
        .from("b2c_orders")
        .insert({
          customer_name: customerName,
          contact_email: contactEmail,
          total_price: totalPrice,
          fulfillment_type:
            body.fulfillment_type === "physical" ? "physical" : "digital",
          image_url: (body.image_url as string) ?? null,
          pixel_map: (body.pixel_map as Json) ?? null,
          shipping_address: (body.shipping_address as Json) ?? null,
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
      // Size + employee count + upsell are the inputs; the price is recomputed
      // authoritatively here (never trusted from the body) so it always equals
      // employees × the regular physical mosaic price (+ managed fee).
      const preset = presetById(String(body.preset_id ?? ""));
      const employees = Number(body.employees ?? 0);
      const managed = body.managed === true;
      if (!contactEmail || !companyName || !preset || !(employees > 0)) {
        return NextResponse.json(
          {
            error:
              "Missing company_name, contact_email, a valid preset_id, or employees",
          },
          { status: 400 },
        );
      }

      const quote = computeB2bQuote(employees, preset.id, managed);
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
          plates_x: preset.platesX,
          plates_y: preset.platesY,
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

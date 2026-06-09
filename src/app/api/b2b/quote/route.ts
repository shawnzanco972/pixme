/**
 * POST /api/b2b/quote
 *   { company_name, contact_email, employees, preset_id, managed?, message? }
 *
 * Large-order (over the self-serve cap) price-quote request. Emails the team a
 * summary. Always acknowledges the buyer (200) so the UX completes even if
 * email isn't configured yet — but reports `emailed` so we know to follow up.
 */
import { NextResponse } from "next/server";

import { computeB2bQuoteByPlates } from "@/lib/b2b-pricing";
import { sendQuoteRequest } from "@/lib/email";
import { presetById } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyName = String(body.company_name ?? "").trim();
  const contactEmail = String(body.contact_email ?? "").trim();
  const employees = Number(body.employees ?? 0);
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
    !companyName ||
    !contactEmail ||
    !(employees > 0) ||
    !(platesX > 0) ||
    !(platesY > 0)
  ) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const quote = computeB2bQuoteByPlates(
    employees,
    platesX,
    platesY,
    body.managed === true,
  );
  const emailed = await sendQuoteRequest({
    companyName,
    contactEmail,
    employees: quote.employees,
    size: `${quote.cols}×${quote.rows}`,
    managed: quote.managed,
    message: body.message ? String(body.message) : undefined,
  });

  return NextResponse.json({ ok: true, emailed });
}

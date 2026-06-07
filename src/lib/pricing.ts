/**
 * Pricing for Pixme mosaics. Pure + deterministic so it can run on both the
 * client (live price) and server (authoritative order amount). All prices in
 * ILS (₪), rounded to whole shekels.
 *
 * NOTE: the server still treats the iCount transaction as the source of truth
 * for what was actually paid; this just proposes the order amount.
 */
import type { FulfillmentType } from "@/lib/supabase/types.helpers";

/**
 * Supported square mosaic sizes (studs per side), aligned to the modular
 * 24×24 baseplate model from the Strategic Blueprint:
 *   24 = Mini   (1×1 baseplate)
 *   48 = Regular(2×2 baseplates)  → ~₪290 physical
 *   72 = Big    (3×3 baseplates)  → ~₪450 physical
 */
export const SIZES = [24, 48, 72] as const;
export type MosaicSize = (typeof SIZES)[number];

/** Number of 24×24 baseplates a size tiles into (e.g. 48 → 2×2 = 4). */
export function baseplateCount(size: MosaicSize): number {
  const perSide = size / 24;
  return perSide * perSide;
}

export interface PriceBreakdown {
  studs: number;
  base: number;
  /** Physical-only: bricks + packing + shipping surcharge. */
  physicalSurcharge: number;
  total: number;
  currency: "ILS";
}

// Calibrated so Regular(48)→₪290 and Big(72)→₪450 physical, with digital ~half.
const DIGITAL_FIXED = 85;
const DIGITAL_PER_STUD = 0.02778;
const PHYSICAL_FIXED = 162;
const PHYSICAL_PER_STUD = 0.05556;

const round5 = (n: number) => Math.round(n / 5) * 5;

export function computePrice(
  size: MosaicSize,
  fulfillment: FulfillmentType,
): PriceBreakdown {
  const studs = size * size;

  const base = round5(DIGITAL_FIXED + studs * DIGITAL_PER_STUD);

  if (fulfillment !== "physical") {
    return { studs, base, physicalSurcharge: 0, total: base, currency: "ILS" };
  }

  const physicalTotal = round5(PHYSICAL_FIXED + studs * PHYSICAL_PER_STUD);
  return {
    studs,
    base,
    physicalSurcharge: physicalTotal - base,
    total: physicalTotal,
    currency: "ILS",
  };
}

/** Format an ILS amount for display (Hebrew locale, ₪ suffix). */
export function formatILS(amount: number): string {
  return `${amount.toLocaleString("he-IL")} ₪`;
}

// --- B2B (license batches) -------------------------------------------------

const B2B_PER_LICENSE = 35; // base per digital license
/** Volume discount tiers: [minLicenses, perLicensePrice]. */
const B2B_TIERS: ReadonlyArray<readonly [number, number]> = [
  [100, 25],
  [50, 29],
  [20, 32],
  [1, B2B_PER_LICENSE],
];

export interface B2bPrice {
  licenses: number;
  perLicense: number;
  total: number;
  currency: "ILS";
}

/** Price a B2B license batch with simple volume discounts. */
export function computeB2bPrice(licenses: number): B2bPrice {
  const n = Math.max(0, Math.floor(licenses));
  const perLicense =
    B2B_TIERS.find(([min]) => n >= min)?.[1] ?? B2B_PER_LICENSE;
  return {
    licenses: n,
    perLicense,
    total: n * perLicense,
    currency: "ILS",
  };
}

/**
 * Pricing for Pixme mosaics. Pure + deterministic so it can run on both the
 * client (live price) and server (authoritative order amount). All prices in
 * ILS (₪), rounded to whole shekels.
 *
 * NOTE: the server still treats the iCount transaction as the source of truth
 * for what was actually paid; this just proposes the order amount.
 */
import type { FulfillmentType } from "@/lib/supabase/types.helpers";

/** Supported square mosaic sizes (studs per side). */
export const SIZES = [32, 48, 64] as const;
export type MosaicSize = (typeof SIZES)[number];

export interface PriceBreakdown {
  studs: number;
  base: number;
  /** Physical-only: bricks + packing + shipping surcharge. */
  physicalSurcharge: number;
  total: number;
  currency: "ILS";
}

const DIGITAL_BASE = 39; // base for the smallest (digital manual + parts list)
const PRICE_PER_100_STUDS = 6; // digital scaling by area
const PHYSICAL_PER_100_STUDS = 9; // bricks + packing (by weight)
const PHYSICAL_SHIPPING = 29; // flat local logistics (HFD/Chita)

export function computePrice(
  size: MosaicSize,
  fulfillment: FulfillmentType,
): PriceBreakdown {
  const studs = size * size;
  const hundreds = studs / 100;

  const base = Math.round(DIGITAL_BASE + hundreds * PRICE_PER_100_STUDS);

  const physicalSurcharge =
    fulfillment === "physical"
      ? Math.round(hundreds * PHYSICAL_PER_100_STUDS + PHYSICAL_SHIPPING)
      : 0;

  return {
    studs,
    base,
    physicalSurcharge,
    total: base + physicalSurcharge,
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

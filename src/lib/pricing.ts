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
 * Modular sizing — everything is built from 24×24 baseplates (the Strategic
 * Blueprint "unit"). A mosaic is `platesX × platesY` plates, so it can be square
 * or rectangular (wide/panoramic/tall).
 */
export const PLATE_STUDS = 24;

export type SizeGroup = "square" | "pano";

export interface SizePreset {
  id: string;
  platesX: number;
  platesY: number;
  group: SizeGroup;
  /** Hebrew label for the UI. */
  labelHe: string;
}

/** Studs per side for a preset. */
export function presetStuds(p: { platesX: number; platesY: number }): {
  cols: number;
  rows: number;
} {
  return { cols: p.platesX * PLATE_STUDS, rows: p.platesY * PLATE_STUDS };
}

/** Total 24×24 baseplates for a grid. */
export function baseplateCount(platesX: number, platesY: number): number {
  return platesX * platesY;
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  // Squares
  { id: "1x1", platesX: 1, platesY: 1, group: "square", labelHe: "מיני" },
  { id: "2x2", platesX: 2, platesY: 2, group: "square", labelHe: "רגיל" },
  { id: "3x3", platesX: 3, platesY: 3, group: "square", labelHe: "גדול" },
  { id: "4x4", platesX: 4, platesY: 4, group: "square", labelHe: "ענק" },
  { id: "5x5", platesX: 5, platesY: 5, group: "square", labelHe: "פרימיום" },
  // Rectangular / panoramic (X = horizontal plates, Y = vertical plates)
  { id: "3x2", platesX: 3, platesY: 2, group: "pano", labelHe: "רוחב" },
  { id: "2x3", platesX: 2, platesY: 3, group: "pano", labelHe: "פורטרט" },
  { id: "4x2", platesX: 4, platesY: 2, group: "pano", labelHe: "פנורמה" },
  { id: "2x4", platesX: 2, platesY: 4, group: "pano", labelHe: "גובה" },
  { id: "5x3", platesX: 5, platesY: 3, group: "pano", labelHe: "פנורמה רחבה" },
  { id: "3x5", platesX: 3, platesY: 5, group: "pano", labelHe: "פוסטר" },
] as const;

export function presetById(id: string): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.id === id);
}

export interface PriceBreakdown {
  studs: number;
  base: number;
  /** Physical-only: bricks + packing + shipping surcharge. */
  physicalSurcharge: number;
  total: number;
  currency: "ILS";
}

// Calibrated so Regular(48²)→₪290 and Big(72²)→₪450 physical, digital ~half.
const DIGITAL_FIXED = 85;
const DIGITAL_PER_STUD = 0.02778;
const PHYSICAL_FIXED = 162;
const PHYSICAL_PER_STUD = 0.05556;

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Price from the total stud count (cols × rows). */
export function computePrice(
  cols: number,
  rows: number,
  fulfillment: FulfillmentType,
): PriceBreakdown {
  const studs = cols * rows;

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

/** Optional gift-wrap add-on (festive box + ribbon + card insert), ILS. */
export const GIFT_WRAP_FEE = 25;

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

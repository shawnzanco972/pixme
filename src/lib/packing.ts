/**
 * Weight-based packing helper.
 *
 * Pixme packs physical kits by WEIGHT on a digital scale (not by counting
 * bricks). This estimates the target weight for an order so packing can be
 * verified on the scale, and so shipping can be quoted.
 *
 * Pure + deterministic; unit-tested. Tune the constants as real GoBricks 1x1
 * plate weights are measured.
 */

/** Mass of a single generic 1x1 plate, grams. (~measure & refine.) */
export const GRAMS_PER_STUD = 0.16;
/** Fixed packaging weight (bag/box + insert), grams. */
export const PACKAGING_GRAMS = 25;
/**
 * Proportional spare allowance so kits are never short (extra studs by weight).
 * Applied on top of an absolute per-color floor — see {@link packCount}.
 */
export const SPARE_RATIO = 0.05;
/**
 * Minimum spare pieces added to EVERY color, regardless of how few are needed.
 * Tiny loose 1x1 plates are easily lost in packing/building, so even a 1-piece
 * color ships with a comfortable cushion. (5% alone would round a 62-piece
 * color up to just +4, which is too risky.)
 */
export const MIN_SPARE_PIECES = 5;

/**
 * Pieces to actually pack for a color that needs `pieces`: the design count
 * plus a spare cushion = max(5% proportional, a 5-piece floor). Generous on
 * purpose — a short kit is far worse than a few extra plates.
 */
export function packCount(pieces: number): number {
  if (pieces <= 0) return 0;
  return pieces + Math.max(Math.ceil(pieces * SPARE_RATIO), MIN_SPARE_PIECES);
}

export interface PackingEstimate {
  studs: number;
  bricksGrams: number;
  /** Bricks + spare allowance. */
  bricksWithSpareGrams: number;
  packagingGrams: number;
  totalGrams: number;
  /** Convenience: scale target the packer weighs to (bricks + spare). */
  scaleTargetGrams: number;
}

/** Estimate packing weight from a stud count. */
export function estimateWeight(studs: number): PackingEstimate {
  const bricksGrams = studs * GRAMS_PER_STUD;
  const bricksWithSpareGrams = bricksGrams * (1 + SPARE_RATIO);
  return {
    studs,
    bricksGrams: round1(bricksGrams),
    bricksWithSpareGrams: round1(bricksWithSpareGrams),
    packagingGrams: PACKAGING_GRAMS,
    totalGrams: round1(bricksWithSpareGrams + PACKAGING_GRAMS),
    scaleTargetGrams: round1(bricksWithSpareGrams),
  };
}

/** Count studs in a pixel_map and estimate its packing weight. */
export function estimateWeightFromPixelMap(
  pixelMap: number[][],
): PackingEstimate {
  const studs = pixelMap.reduce((sum, row) => sum + row.length, 0);
  return estimateWeight(studs);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Format grams for display (≥1000 g → kg). Hebrew units — for the web UI. */
export function formatWeight(grams: number): string {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג`
    : `${grams.toLocaleString("he-IL", { maximumFractionDigits: 1 })} גרם`;
}

/**
 * ASCII weight formatter (g / kg) for the PDF. jsPDF has no bidi shaping, so
 * Hebrew units + Western digits get mangled (the number gets bidi-reordered);
 * the packing sheet uses plain Latin units instead.
 */
export function formatWeightAscii(grams: number): string {
  return grams >= 1000
    ? `${(Math.round(grams / 100) / 10).toFixed(2)} kg`
    : `${grams.toFixed(1)} g`;
}

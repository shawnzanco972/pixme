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
/** Spare allowance so kits are never short (extra studs by weight). */
export const SPARE_RATIO = 0.03;

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

/** Format grams for display (≥1000 g → kg). */
export function formatWeight(grams: number): string {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג`
    : `${grams.toLocaleString("he-IL", { maximumFractionDigits: 1 })} גרם`;
}

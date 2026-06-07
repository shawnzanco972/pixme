/**
 * Nearest-color matching in OKLab with a material-mismatch penalty.
 *
 * Rule (CLAUDE.md): distance = Euclidean distance in OKLab + a penalty term
 * when a candidate's material differs from the preferred material. By default
 * we prefer "solid" bricks, so transparent/metallic colors are only chosen
 * when they are *dramatically* closer — this keeps mosaics buildable from
 * standard stock and avoids odd material swaps.
 */
import { oklabDistanceSq, type OKLab } from "./color";
import type { BrickColor, BrickMaterial } from "./palette";

export interface MatchOptions {
  /** Preferred material; mismatches get penalized. Default "solid". */
  preferredMaterial?: BrickMaterial;
  /**
   * Penalty added (in OKLab distance units) to candidates whose material
   * differs from `preferredMaterial`. Default 0.15 — comparable to a sizable
   * perceptual gap, so material is respected but not absolute.
   */
  materialPenalty?: number;
}

const DEFAULT_PENALTY = 0.15;

/**
 * Effective squared distance from a target OKLab color to a palette entry,
 * including the material penalty (penalty applied in linear distance space,
 * then squared for comparison consistency).
 */
export function effectiveDistanceSq(
  target: OKLab,
  candidate: BrickColor,
  opts: MatchOptions = {},
): number {
  const preferred = opts.preferredMaterial ?? "solid";
  const penalty = opts.materialPenalty ?? DEFAULT_PENALTY;

  const baseSq = oklabDistanceSq(target, candidate.oklab);
  if (candidate.material === preferred) return baseSq;

  // Add penalty in distance (not squared) space, then re-square.
  const base = Math.sqrt(baseSq);
  const eff = base + penalty;
  return eff * eff;
}

/** Return the palette index of the nearest color to `target`. */
export function nearestColorIndex(
  target: OKLab,
  palette: BrickColor[],
  opts: MatchOptions = {},
): number {
  let bestId = palette[0]?.id ?? 0;
  let bestSq = Infinity;

  for (const candidate of palette) {
    const d = effectiveDistanceSq(target, candidate, opts);
    if (d < bestSq) {
      bestSq = d;
      bestId = candidate.id;
    }
  }
  return bestId;
}

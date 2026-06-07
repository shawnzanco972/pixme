/**
 * Nearest-color matching in OKLab with a material-mismatch penalty.
 *
 * Rule (CLAUDE.md): distance = Euclidean distance in OKLab + a penalty term
 * when a candidate's material differs from the preferred material. By default
 * we prefer "solid" bricks, so transparent/metallic colors are only chosen
 * when they are *dramatically* closer — this keeps mosaics buildable from
 * standard stock and avoids odd material swaps.
 */
import { type OKLab } from "./color";
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
  /**
   * Weight on the chroma (a,b) axes relative to lightness (L) in the distance.
   * >1 makes hue/saturation matter MORE than lightness, so a saturated target
   * (e.g. a red logo) won't collapse to gray — gray has ~0 chroma and is thus
   * far away. Default 1.6.
   */
  chromaWeight?: number;
}

const DEFAULT_PENALTY = 0.15;
const DEFAULT_CHROMA_WEIGHT = 1.6;

/** Chroma-weighted squared OKLab distance. */
function weightedDistanceSq(x: OKLab, y: OKLab, chromaWeight: number): number {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return dL * dL + chromaWeight * (da * da + db * db);
}

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
  const chromaWeight = opts.chromaWeight ?? DEFAULT_CHROMA_WEIGHT;

  const baseSq = weightedDistanceSq(target, candidate.oklab, chromaWeight);
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

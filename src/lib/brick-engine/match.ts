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
  /**
   * Neutral-avoidance: when the TARGET is clearly tinted but a candidate is a
   * near-neutral (white/gray/black ≈ 0 chroma), add this × (target chroma) to
   * the distance. Stops pale tints (a cyan sky, pale-blue eyeshadow) from
   * collapsing to white/gray.
   *
   * Default 0 (OFF): only useful when the palette actually contains a
   * hue-compatible colored brick — otherwise it forces wrong-hue matches (e.g.
   * a pale cyan → warm Tan when no cool light color is stocked). Turn on once
   * cool light colors (light blue / azure) are in the active palette.
   */
  neutralPenalty?: number;
}

const DEFAULT_PENALTY = 0.15;
const DEFAULT_CHROMA_WEIGHT = 1.6;
const DEFAULT_NEUTRAL_PENALTY = 0;
/** Below this OKLab chroma a color counts as "neutral" (gray/white/black). */
const NEUTRAL_CHROMA = 0.04;

const chromaOf = (c: OKLab) => Math.hypot(c.a, c.b);

/** Chroma-weighted squared OKLab distance. */
function weightedDistanceSq(x: OKLab, y: OKLab, chromaWeight: number): number {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return dL * dL + chromaWeight * (da * da + db * db);
}

/**
 * Effective squared distance from a target OKLab color to a palette entry,
 * including chroma weighting, neutral-avoidance, and the material penalty (all
 * applied in linear distance space, then squared for comparison consistency).
 */
export function effectiveDistanceSq(
  target: OKLab,
  candidate: BrickColor,
  opts: MatchOptions = {},
): number {
  const preferred = opts.preferredMaterial ?? "solid";
  const materialPenalty = opts.materialPenalty ?? DEFAULT_PENALTY;
  const chromaWeight = opts.chromaWeight ?? DEFAULT_CHROMA_WEIGHT;
  const neutralPenalty = opts.neutralPenalty ?? DEFAULT_NEUTRAL_PENALTY;

  let dist = Math.sqrt(weightedDistanceSq(target, candidate.oklab, chromaWeight));

  // Push clearly-tinted targets away from neutral (gray/white/black) bricks.
  const targetChroma = chromaOf(target);
  if (
    targetChroma > NEUTRAL_CHROMA &&
    chromaOf(candidate.oklab) < NEUTRAL_CHROMA
  ) {
    dist += neutralPenalty * (targetChroma - NEUTRAL_CHROMA);
  }

  if (candidate.material !== preferred) dist += materialPenalty;

  return dist * dist;
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

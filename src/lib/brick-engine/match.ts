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
   * Extra weight on the HUE component of the chromatic error (the part of the
   * a,b error perpendicular to the chroma axis). Hue mismatches are far more
   * objectionable than saturation mismatches — a slightly-warm gray must never
   * jump to green just because green has similar chroma magnitude. Default 2.4.
   */
  hueWeight?: number;
  /**
   * Neutral-avoidance: when the TARGET is clearly tinted but a candidate is a
   * near-neutral (white/gray/black ≈ 0 chroma), add this × (target chroma) to
   * the distance. Stops pale tints (a cyan sky, pale-blue eyeshadow) from
   * collapsing to white/gray. Enabled now that the core palette has cool light
   * colors (Bright Light Blue, Medium Azure) so tints have somewhere to go.
   */
  neutralPenalty?: number;
}

const DEFAULT_PENALTY = 0.15;
const DEFAULT_CHROMA_WEIGHT = 1.6;
const DEFAULT_HUE_WEIGHT = 2.4;
const DEFAULT_NEUTRAL_PENALTY = 1.2;
/** Below this OKLab chroma a color counts as "neutral" (gray/white/black). */
const NEUTRAL_CHROMA = 0.04;
/** Target chroma above this gets no ADDITIONAL neutral penalty (capped). */
const NEUTRAL_CHROMA_CAP = 0.1;
/** Below this lightness the neutral penalty fades out — tint in deep shadow is
 *  mostly sensor noise, and forcing it chromatic plants random colored studs. */
const NEUTRAL_FADE_LO = 0.22;
const NEUTRAL_FADE_HI = 0.38;

const chromaOf = (c: OKLab) => Math.hypot(c.a, c.b);

/**
 * Perceptually weighted squared OKLab distance. The chromatic (a,b) error is
 * split into a chroma-magnitude component and a hue component (à la CIEDE's
 * dC/dH split); hue gets extra weight so "right hue, slightly-off saturation"
 * always beats "wrong hue, similar saturation".
 */
function weightedDistanceSq(
  x: OKLab,
  y: OKLab,
  chromaWeight: number,
  hueWeight: number,
): number {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  const chromaErrSq = da * da + db * db;
  const dC = chromaOf(x) - chromaOf(y);
  const dCSq = dC * dC;
  const dHSq = Math.max(0, chromaErrSq - dCSq);
  return dL * dL + chromaWeight * dCSq + hueWeight * dHSq;
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
  const hueWeight = opts.hueWeight ?? DEFAULT_HUE_WEIGHT;
  const neutralPenalty = opts.neutralPenalty ?? DEFAULT_NEUTRAL_PENALTY;

  let dist = Math.sqrt(
    weightedDistanceSq(target, candidate.oklab, chromaWeight, hueWeight),
  );

  // Push clearly-tinted targets away from neutral (gray/white/black) bricks.
  // Capped (a vivid red doesn't need an unbounded shove) and faded out in deep
  // shadow, where a faint tint is noise and the honest match IS black/gray.
  const targetChroma = chromaOf(target);
  if (
    targetChroma > NEUTRAL_CHROMA &&
    chromaOf(candidate.oklab) < NEUTRAL_CHROMA
  ) {
    const excess = Math.min(targetChroma, NEUTRAL_CHROMA_CAP) - NEUTRAL_CHROMA;
    const lightFade = clamp01(
      (target.L - NEUTRAL_FADE_LO) / (NEUTRAL_FADE_HI - NEUTRAL_FADE_LO),
    );
    dist += neutralPenalty * excess * lightFade;
  }

  if (candidate.material !== preferred) dist += materialPenalty;

  return dist * dist;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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

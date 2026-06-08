/**
 * Face-aware contrast bias (no ML model — a lightweight skin-tone heuristic).
 *
 * A portrait turned into ~48–120 coarse studs tends to flatten the face into one
 * or two near-identical skin bricks, losing the eyes, nose shadow and mouth that
 * make it read as a person. We can't ship a face-detection model into a Web
 * Worker cheaply, so instead we:
 *
 *   1. Estimate a per-pixel "skin" weight from a fast RGB/chroma heuristic.
 *   2. Find the luma range the skin actually occupies.
 *   3. Expand contrast *around the skin midtone*, weighted by skin membership —
 *      so facial midtones spread across more palette steps (eyes/shadows/
 *      highlights separate) while the rest of the image is barely touched.
 *
 * It degrades gracefully: photos with little skin get almost no change, so it's
 * safe to leave on. Operates in gamma sRGB like the rest of preprocessing.
 */
import type { RGBAImage } from "./quantize";

const REC601 = { r: 0.299, g: 0.587, b: 0.114 };

/**
 * Skin-likeness in [0,1] for one sRGB pixel. Based on Kovac et al.'s daylight
 * rule, softened to a weight (rather than a hard mask) so the contrast bias
 * fades in/out smoothly and doesn't create a hard skin boundary.
 */
export function skinWeight(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  // Hard disqualifiers (too dark, too gray, wrong ordering for skin).
  if (r < 60 || g < 30 || b < 15) return 0;
  if (mx - mn < 12) return 0; // near-gray: not skin
  if (r <= g || r <= b) return 0; // skin is red-dominant
  // Score how strongly red dominates and how "warm" the pixel is.
  const redOverGreen = (r - g) / 255; // ~0.06..0.3 for skin
  const warmth = (r - b) / 255;
  const s = Math.min(1, redOverGreen * 3) * Math.min(1, warmth * 2.5);
  return s;
}

export interface SkinStats {
  /** Per-pixel skin weight, same order as image (length = w*h). */
  weight: Float32Array;
  /** Weighted-mean luma (0..1) of skin pixels, or null if ~no skin found. */
  skinLuma: number | null;
  /** Total skin weight (≈ number of skin pixels). */
  total: number;
}

/** Compute the skin weight map and the mean luma of skin regions. */
export function skinStats(image: RGBAImage): SkinStats {
  const src = image.data;
  const n = (src.length / 4) | 0;
  const weight = new Float32Array(n);
  let total = 0;
  let lumaAcc = 0;

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (src[i + 3] === 0) continue;
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const w = skinWeight(r, g, b);
    if (w <= 0) continue;
    weight[p] = w;
    total += w;
    lumaAcc += w * (REC601.r * r + REC601.g * g + REC601.b * b);
  }

  return {
    weight,
    total,
    skinLuma: total > 0 ? lumaAcc / total / 255 : null,
  };
}

/**
 * Apply face-aware contrast: expand contrast around the skin midtone, blended
 * per pixel by skin membership. Returns a NEW image; returns the input
 * unchanged when there isn't enough skin to matter.
 *
 * @param strength extra contrast at full skin weight (e.g. 0.6 → up to ×1.6).
 */
export function faceAwareContrast(
  image: RGBAImage,
  strength = 0.6,
): RGBAImage {
  const stats = skinStats(image);
  const minSkin = (image.width * image.height) * 0.01; // need ≥1% skin
  if (stats.skinLuma === null || stats.total < minSkin) return image;

  const pivot = stats.skinLuma; // expand contrast around the face's own midtone
  const src = image.data;
  const out = new Uint8ClampedArray(src.length);

  for (let p = 0, i = 0; i < src.length; p++, i += 4) {
    const w = stats.weight[p];
    if (w <= 0 || src[i + 3] === 0) {
      out[i] = src[i];
      out[i + 1] = src[i + 1];
      out[i + 2] = src[i + 2];
      out[i + 3] = src[i + 3];
      continue;
    }
    const contrast = 1 + strength * w;
    for (let c = 0; c < 3; c++) {
      const v = src[i + c] / 255;
      out[i + c] = clamp255(((v - pivot) * contrast + pivot) * 255);
    }
    out[i + 3] = src[i + 3];
  }

  return { data: out, width: image.width, height: image.height };
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

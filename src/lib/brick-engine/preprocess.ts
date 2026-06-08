/**
 * User pre-processing — brightness, contrast, saturation.
 *
 * Applied to the FULL-RESOLUTION image BEFORE block quantization. Boosting
 * contrast here is what keeps edges crisp through downsampling (CLAUDE.md goal:
 * avoid muddy results); saturation keeps colors vivid so they don't all collapse
 * toward gray after matching.
 *
 * Operates in gamma sRGB (perceptual), the space users expect these controls in.
 */
import { faceAwareContrast } from "./face";
import type { RGBAImage } from "./quantize";
import { unsharpMask } from "./unsharp";

export interface PreprocessOptions {
  /** 1 = unchanged. >1 brighter, <1 darker. */
  brightness?: number;
  /** 1 = unchanged. >1 more contrast (sharper edges). */
  contrast?: number;
  /** 1 = unchanged. 0 = grayscale, >1 more vivid. */
  saturation?: number;
  /** Auto-levels: stretch tonal range (1st–99th pct) so flat photos pop. */
  autoLevels?: boolean;
  /**
   * Face-aware contrast: expand contrast around detected skin midtones so
   * portraits keep their facial features instead of flattening to one skin
   * brick. No-op on images with little skin. Default off.
   */
  faceAware?: boolean;
  /**
   * Line-art / text mode: an unsharp mask that crisps edges BEFORE downsampling,
   * so logos, lettering and line drawings stay legible at stud resolution.
   * Default off.
   */
  lineArt?: boolean;
}

const REC601 = { r: 0.299, g: 0.587, b: 0.114 };

function isPixelOpsIdentity(o: PreprocessOptions): boolean {
  return (
    !o.autoLevels &&
    (o.brightness ?? 1) === 1 &&
    (o.contrast ?? 1) === 1 &&
    (o.saturation ?? 1) === 1
  );
}

/**
 * Compute auto-levels black/white points (0..1) from the luma histogram at the
 * 1st/99th percentiles. Returns null if the range is too small to bother.
 */
function computeLevels(
  src: Uint8ClampedArray,
): { lo: number; hi: number } | null {
  const hist = new Uint32Array(256);
  let count = 0;
  // Sample every 4th pixel for speed (16 bytes).
  for (let i = 0; i < src.length; i += 16) {
    if (src[i + 3] === 0) continue;
    const y = (REC601.r * src[i] + REC601.g * src[i + 1] + REC601.b * src[i + 2]) | 0;
    hist[y]++;
    count++;
  }
  if (count === 0) return null;
  const lowCut = count * 0.01;
  const highCut = count * 0.01;
  let acc = 0;
  let lo = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= lowCut) {
      lo = v;
      break;
    }
  }
  acc = 0;
  let hi = 255;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= highCut) {
      hi = v;
      break;
    }
  }
  if (hi - lo < 24) return null; // already full-range; skip
  return { lo: lo / 255, hi: hi / 255 };
}

/**
 * Return a new RGBAImage with auto-levels + brightness/contrast/saturation
 * applied. Returns the input unchanged when all controls are neutral.
 */
export function preprocessImage(
  image: RGBAImage,
  options: PreprocessOptions = {},
): RGBAImage {
  // Spatial passes first (they read neighborhoods), on the full-res image.
  let work = image;
  if (options.lineArt) work = unsharpMask(work);
  if (options.faceAware) work = faceAwareContrast(work);

  // Per-pixel tone ops can short-circuit if neutral.
  if (isPixelOpsIdentity(options)) return work;

  const brightness = options.brightness ?? 1;
  const contrast = options.contrast ?? 1;
  const saturation = options.saturation ?? 1;

  const src = work.data;
  const levels = options.autoLevels ? computeLevels(src) : null;
  const span = levels ? levels.hi - levels.lo : 1;
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    let r = src[i] / 255;
    let g = src[i + 1] / 255;
    let b = src[i + 2] / 255;

    // 0) Auto-levels: stretch [lo,hi] → [0,1] equally per channel (keeps hue).
    if (levels) {
      r = (r - levels.lo) / span;
      g = (g - levels.lo) / span;
      b = (b - levels.lo) / span;
    }

    // 1) Brightness (multiplicative).
    r *= brightness;
    g *= brightness;
    b *= brightness;

    // 2) Contrast around mid-gray.
    r = (r - 0.5) * contrast + 0.5;
    g = (g - 0.5) * contrast + 0.5;
    b = (b - 0.5) * contrast + 0.5;

    // 3) Saturation around perceptual luma.
    const luma = REC601.r * r + REC601.g * g + REC601.b * b;
    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;

    out[i] = clamp255(r * 255);
    out[i + 1] = clamp255(g * 255);
    out[i + 2] = clamp255(b * 255);
    out[i + 3] = src[i + 3];
  }

  return { data: out, width: image.width, height: image.height };
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

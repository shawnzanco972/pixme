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
import type { RGBAImage } from "./quantize";

export interface PreprocessOptions {
  /** 1 = unchanged. >1 brighter, <1 darker. */
  brightness?: number;
  /** 1 = unchanged. >1 more contrast (sharper edges). */
  contrast?: number;
  /** 1 = unchanged. 0 = grayscale, >1 more vivid. */
  saturation?: number;
}

const REC601 = { r: 0.299, g: 0.587, b: 0.114 };

function isIdentity(o: PreprocessOptions): boolean {
  return (
    (o.brightness ?? 1) === 1 &&
    (o.contrast ?? 1) === 1 &&
    (o.saturation ?? 1) === 1
  );
}

/**
 * Return a new RGBAImage with brightness/contrast/saturation applied.
 * Returns the input unchanged when all controls are neutral.
 */
export function preprocessImage(
  image: RGBAImage,
  options: PreprocessOptions = {},
): RGBAImage {
  if (isIdentity(options)) return image;

  const brightness = options.brightness ?? 1;
  const contrast = options.contrast ?? 1;
  const saturation = options.saturation ?? 1;

  const src = image.data;
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    let r = src[i] / 255;
    let g = src[i + 1] / 255;
    let b = src[i + 2] / 255;

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

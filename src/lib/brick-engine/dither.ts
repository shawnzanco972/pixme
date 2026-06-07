/**
 * Dithering via noise.
 *
 * Injects a very small amount of random noise into each cell's color (in sRGB,
 * before OKLab conversion). This breaks ties when a cell sits almost exactly
 * between two palette colors, scattering the choice instead of snapping a whole
 * flat region to one color — which removes visible banding without blurring.
 */
import {
  linearRgbToOklab,
  linearToSrgbChannel,
  srgbChannelToLinear,
  type OKLab,
} from "./color";
import type { LinearRGB } from "./quantize";
import { signedNoise, type Rng } from "./rng";

export interface DitherOptions {
  /** Noise magnitude in sRGB units [0,1]. ~0.012 ≈ 3/255. Default 0.012. */
  amount?: number;
}

const DEFAULT_AMOUNT = 0.012;

/**
 * Convert a linear-RGB cell average to OKLab, adding sRGB-space noise first.
 * With `amount <= 0` this is a plain (noise-free) conversion.
 */
export function ditherLinearToOklab(
  lin: LinearRGB,
  amount: number,
  rng: Rng,
): OKLab {
  if (amount <= 0) {
    return linearRgbToOklab(lin[0], lin[1], lin[2]);
  }

  const noisy: LinearRGB = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    // linear → sRGB(0..1) → + noise → clamp → linear
    const srgb = linearToSrgbChannel(lin[c]) / 255;
    const jittered = clamp01(srgb + signedNoise(rng, amount));
    noisy[c] = srgbChannelToLinear(jittered * 255);
  }
  return linearRgbToOklab(noisy[0], noisy[1], noisy[2]);
}

export { DEFAULT_AMOUNT as DEFAULT_DITHER_AMOUNT };

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

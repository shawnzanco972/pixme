/**
 * Coarse block quantization.
 *
 * Downsamples a full-resolution image to a `cols × rows` grid of average
 * colors. Averaging is done in LINEAR-LIGHT sRGB (gamma-correct) — averaging
 * raw sRGB bytes would darken/muddy the result. Each block average is returned
 * as OKLab, ready for matching.
 */
import { linearRgbToOklab, srgbChannelToLinear, type OKLab } from "./color";

/** Structural image type (DOM ImageData satisfies this; also test-friendly). */
export interface RGBAImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Reduce an image to a grid of average OKLab colors.
 * Returns a row-major array of length `rows * cols`.
 */
export function quantizeToGrid(
  image: RGBAImage,
  cols: number,
  rows: number,
): OKLab[] {
  const { data, width, height } = image;
  const out: OKLab[] = new Array(cols * rows);

  for (let gy = 0; gy < rows; gy++) {
    // Pixel-space bounds of this grid row.
    const y0 = Math.floor((gy * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / rows));

    for (let gx = 0; gx < cols; gx++) {
      const x0 = Math.floor((gx * width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / cols));

      let rl = 0;
      let gl = 0;
      let bl = 0;
      let wsum = 0; // alpha-weighted sample count

      for (let y = y0; y < y1; y++) {
        let idx = (y * width + x0) * 4;
        for (let x = x0; x < x1; x++) {
          const a = data[idx + 3] / 255;
          if (a > 0) {
            rl += srgbChannelToLinear(data[idx]) * a;
            gl += srgbChannelToLinear(data[idx + 1]) * a;
            bl += srgbChannelToLinear(data[idx + 2]) * a;
            wsum += a;
          }
          idx += 4;
        }
      }

      const inv = wsum > 0 ? 1 / wsum : 0;
      out[gy * cols + gx] = linearRgbToOklab(rl * inv, gl * inv, bl * inv);
    }
  }

  return out;
}

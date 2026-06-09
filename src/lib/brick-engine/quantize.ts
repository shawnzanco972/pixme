/**
 * Coarse block quantization.
 *
 * Downsamples a full-resolution image to a `cols × rows` grid of average colors.
 * Averaging is done in LINEAR-LIGHT sRGB (gamma-correct) — averaging raw sRGB
 * bytes would darken/muddy the result.
 *
 * `quantizeToLinearGrid` returns the per-cell average as linear RGB, so the
 * pipeline can inject dithering noise BEFORE the OKLab conversion. The older
 * `quantizeToGrid` (returns OKLab directly) is kept as a convenience wrapper.
 */
import { linearRgbToOklab, srgbChannelToLinear, type OKLab } from "./color";

/** Structural image type (DOM ImageData satisfies this; also test-friendly). */
export interface RGBAImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Linear-light RGB triple, each channel in [0,1]. */
export type LinearRGB = [number, number, number];

export interface QuantizeOptions {
  /**
   * Detail preservation (0..1). Plain averaging turns a black letter on a white
   * shirt into mid-gray mush that then matches a random midtone. For
   * high-contrast cells (an edge/stroke runs through them) we split the cell's
   * pixels into a dark and a light cluster by luma and pull the result toward
   * the DOMINANT cluster's mean instead of the overall mean — so the cell
   * commits to "letter" or "shirt" and text stays legible. 0 = pure averaging.
   */
  detail?: number;
  /**
   * Linear-luma spread (max − min) above which a cell counts as high-contrast
   * and the dominant-cluster pull kicks in. Default 0.18.
   */
  detailThreshold?: number;
}

/** Rec.709 linear luma. */
const lumaOf = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Reduce an image to a grid of average LINEAR RGB colors (row-major,
 * length `rows * cols`). With `detail > 0`, high-contrast cells are pulled
 * toward their dominant luma cluster (see QuantizeOptions.detail).
 */
export function quantizeToLinearGrid(
  image: RGBAImage,
  cols: number,
  rows: number,
  options: QuantizeOptions = {},
): LinearRGB[] {
  const { data, width, height } = image;
  const detail = options.detail ?? 0;
  const detailThreshold = options.detailThreshold ?? 0.18;
  const out: LinearRGB[] = new Array(cols * rows);

  for (let gy = 0; gy < rows; gy++) {
    const y0 = Math.floor((gy * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / rows));

    for (let gx = 0; gx < cols; gx++) {
      const x0 = Math.floor((gx * width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / cols));

      let rl = 0;
      let gl = 0;
      let bl = 0;
      let wsum = 0; // alpha-weighted sample count
      let lumMin = Infinity;
      let lumMax = -Infinity;

      for (let y = y0; y < y1; y++) {
        let idx = (y * width + x0) * 4;
        for (let x = x0; x < x1; x++) {
          const a = data[idx + 3] / 255;
          if (a > 0) {
            const r = srgbChannelToLinear(data[idx]);
            const g = srgbChannelToLinear(data[idx + 1]);
            const b = srgbChannelToLinear(data[idx + 2]);
            rl += r * a;
            gl += g * a;
            bl += b * a;
            wsum += a;
            const lum = lumaOf(r, g, b);
            if (lum < lumMin) lumMin = lum;
            if (lum > lumMax) lumMax = lum;
          }
          idx += 4;
        }
      }

      const inv = wsum > 0 ? 1 / wsum : 0;
      let cell: LinearRGB = [rl * inv, gl * inv, bl * inv];

      // Detail preservation: re-scan the cell, split pixels into dark/light
      // clusters around the luma midpoint, and blend the mean toward the
      // dominant cluster. Second pass over a small block — cheap, and keeps
      // the function allocation-free and deterministic.
      if (detail > 0 && wsum > 0 && lumMax - lumMin > detailThreshold) {
        const mid = (lumMin + lumMax) / 2;
        let r0 = 0, g0 = 0, b0 = 0, w0 = 0; // dark cluster
        let r1 = 0, g1 = 0, b1 = 0, w1 = 0; // light cluster
        for (let y = y0; y < y1; y++) {
          let idx = (y * width + x0) * 4;
          for (let x = x0; x < x1; x++) {
            const a = data[idx + 3] / 255;
            if (a > 0) {
              const r = srgbChannelToLinear(data[idx]);
              const g = srgbChannelToLinear(data[idx + 1]);
              const b = srgbChannelToLinear(data[idx + 2]);
              if (lumaOf(r, g, b) < mid) {
                r0 += r * a; g0 += g * a; b0 += b * a; w0 += a;
              } else {
                r1 += r * a; g1 += g * a; b1 += b * a; w1 += a;
              }
            }
            idx += 4;
          }
        }
        const darkWins = w0 >= w1;
        const dw = darkWins ? w0 : w1;
        if (dw > 0) {
          const di = 1 / dw;
          const dom: LinearRGB = darkWins
            ? [r0 * di, g0 * di, b0 * di]
            : [r1 * di, g1 * di, b1 * di];
          // Scale the pull by how decisive the majority is (50/50 → no pull,
          // ≥65/35 → full), so soft gradients aren't posterized — only real
          // strokes commit.
          const dominance = Math.min(1, (Math.abs(w0 - w1) / wsum) / 0.3);
          const t = detail * dominance;
          cell = [
            cell[0] + (dom[0] - cell[0]) * t,
            cell[1] + (dom[1] - cell[1]) * t,
            cell[2] + (dom[2] - cell[2]) * t,
          ];
        }
      }

      out[gy * cols + gx] = cell;
    }
  }

  return out;
}

/** Reduce an image to a grid of average OKLab colors (no dithering). */
export function quantizeToGrid(
  image: RGBAImage,
  cols: number,
  rows: number,
): OKLab[] {
  return quantizeToLinearGrid(image, cols, rows).map(([r, g, b]) =>
    linearRgbToOklab(r, g, b),
  );
}

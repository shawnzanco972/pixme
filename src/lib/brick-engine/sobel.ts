/**
 * Sobel edge detection over the quantized luminance grid.
 *
 * Used by the despeckle step for EDGE PRESERVATION: cells sitting on a strong
 * gradient (an outline) are flagged so the smoothing pass skips them, keeping
 * crisp edges instead of rounding them off into mush.
 */

/** Sample with clamp-to-edge so borders don't read as false edges. */
function at(grid: number[], cols: number, rows: number, x: number, y: number) {
  const cx = x < 0 ? 0 : x >= cols ? cols - 1 : x;
  const cy = y < 0 ? 0 : y >= rows ? rows - 1 : y;
  return grid[cy * cols + cx];
}

/** Per-cell Sobel gradient magnitude over a luminance grid (row-major). */
export function sobelMagnitude(
  lum: number[],
  cols: number,
  rows: number,
): number[] {
  const mag = new Array<number>(cols * rows);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tl = at(lum, cols, rows, x - 1, y - 1);
      const tc = at(lum, cols, rows, x, y - 1);
      const tr = at(lum, cols, rows, x + 1, y - 1);
      const ml = at(lum, cols, rows, x - 1, y);
      const mr = at(lum, cols, rows, x + 1, y);
      const bl = at(lum, cols, rows, x - 1, y + 1);
      const bc = at(lum, cols, rows, x, y + 1);
      const br = at(lum, cols, rows, x + 1, y + 1);

      const gx = tl + 2 * ml + bl - (tr + 2 * mr + br);
      const gy = tl + 2 * tc + tr - (bl + 2 * bc + br);

      mag[y * cols + x] = Math.hypot(gx, gy);
    }
  }

  return mag;
}

/**
 * Boolean edge mask: true where the Sobel magnitude exceeds `threshold`.
 * `lum` should be roughly normalized (e.g. OKLab L in [0,1]); threshold ~0.06–0.12.
 */
export function computeEdgeMask(
  lum: number[],
  cols: number,
  rows: number,
  threshold: number,
): boolean[] {
  const mag = sobelMagnitude(lum, cols, rows);
  return mag.map((m) => m >= threshold);
}

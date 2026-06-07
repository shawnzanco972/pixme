/**
 * Despeckling — removes isolated noise pixels from a quantized index grid.
 *
 * After matching, single stray studs that differ from their surroundings make
 * mosaics look noisy and are annoying to build. For each cell we look at its
 * 8-neighborhood; if too few neighbors share the cell's color, we replace it
 * with the most common neighboring color (majority vote).
 */

export interface DespeckleOptions {
  /**
   * Minimum number of 8-neighbors that must share the center's color for it to
   * be kept. If fewer match, the center is replaced by the neighbor mode.
   * Default 2 — only genuinely isolated/near-isolated studs are removed.
   */
  minSameNeighbors?: number;
  /** Number of passes. Default 1. */
  passes?: number;
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/**
 * Despeckle a row-major index grid in place-safe manner (returns a new grid).
 */
export function despeckleGrid(
  grid: number[],
  cols: number,
  rows: number,
  options: DespeckleOptions = {},
): number[] {
  const minSame = options.minSameNeighbors ?? 2;
  const passes = options.passes ?? 1;

  let current = grid.slice();

  for (let p = 0; p < passes; p++) {
    const next = current.slice();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const center = current[y * cols + x];

        let sameCount = 0;
        const counts = new Map<number, number>();

        for (const [dx, dy] of NEIGHBORS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const v = current[ny * cols + nx];
          counts.set(v, (counts.get(v) ?? 0) + 1);
          if (v === center) sameCount++;
        }

        if (sameCount < minSame) {
          // Replace with the most common neighbor color.
          let bestVal = center;
          let bestCount = -1;
          for (const [val, count] of counts) {
            if (count > bestCount) {
              bestCount = count;
              bestVal = val;
            }
          }
          next[y * cols + x] = bestVal;
        }
      }
    }

    current = next;
  }

  return current;
}

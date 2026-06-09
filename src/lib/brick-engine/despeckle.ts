/**
 * Despeckling with Sobel edge preservation.
 *
 * Removes isolated noise studs (majority vote over the 8-neighborhood) WITHOUT
 * rounding off crisp outlines: cells flagged on a strong Sobel edge are skipped
 * entirely, so edges stay sharp while flat regions get cleaned up.
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
  /**
   * Optional edge mask (row-major, same length as the grid). Cells where this is
   * `true` are treated as edges and left untouched (edge preservation).
   */
  edgeMask?: boolean[] | null;
  /**
   * Optional perceptual cost guard: cost(cell, paletteId) — the same squared
   * OKLab metric the matcher minimizes. When set, a speckle is only replaced by
   * a neighbor color whose cost is within `maxCostIncrease` of the current one.
   * Without this, majority vote can plant a perceptually FAR color (e.g. a
   * green stud in a face) just because it happens to surround the cell.
   */
  cost?: (cell: number, id: number) => number;
  /**
   * Max allowed cost increase (squared-distance units) for a despeckle
   * replacement when `cost` is provided. Default 0.035 (≈0.19 OKLab distance).
   */
  maxCostIncrease?: number;
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
 * Despeckle a row-major index grid (returns a new grid).
 */
export function despeckleGrid(
  grid: number[],
  cols: number,
  rows: number,
  options: DespeckleOptions = {},
): number[] {
  const minSame = options.minSameNeighbors ?? 2;
  const passes = options.passes ?? 1;
  const edgeMask = options.edgeMask ?? null;
  const cost = options.cost ?? null;
  const maxCostIncrease = options.maxCostIncrease ?? 0.035;

  let current = grid.slice();

  for (let p = 0; p < passes; p++) {
    const next = current.slice();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = y * cols + x;

        // Edge preservation: never smooth a cell on a sharp edge.
        if (edgeMask && edgeMask[cell]) continue;

        const center = current[cell];
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
          // Candidates by neighbor count (desc); take the most common one that
          // passes the perceptual cost guard, else leave the cell alone.
          const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
          const budget = cost ? cost(cell, center) + maxCostIncrease : Infinity;
          for (const [val] of ranked) {
            if (val === center) break; // keeping the center is always allowed
            if (!cost || cost(cell, val) <= budget) {
              next[cell] = val;
              break;
            }
          }
        }
      }
    }

    current = next;
  }

  return current;
}

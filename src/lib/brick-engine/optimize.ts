/**
 * Phase 2 — swap optimization.
 *
 * After the greedy per-cell assignment (phase 1), the despeckle pass nudges some
 * cells away from their ideal color to reduce noise. This pass repairs accuracy
 * lost that way: it repeatedly proposes swapping the assigned colors of two
 * cells and keeps the swap only if it lowers the TOTAL cost.
 *
 * The cost function is injected so it matches the greedy matcher EXACTLY
 * (chroma weighting, neutral-avoidance, material penalty). If they disagreed,
 * swap could undo the matcher's choices.
 */
import { mulberry32, type Rng } from "./rng";

export interface SwapOptions {
  /** Number of candidate swaps to evaluate. Default ~6× the cell count. */
  iterations?: number;
  /** Seeded RNG for deterministic results. */
  rng?: Rng;
}

/**
 * @param indices greedy/despeckled palette index per cell (row-major)
 * @param cost    cost(cell, paletteId) — same metric the matcher minimizes
 */
export function swapOptimize(
  indices: number[],
  cost: (cell: number, id: number) => number,
  options: SwapOptions = {},
): number[] {
  const n = indices.length;
  if (n < 2) return indices.slice();

  const rng = options.rng ?? mulberry32(0x5eed);
  const iterations = options.iterations ?? n * 6;
  const out = indices.slice();

  for (let k = 0; k < iterations; k++) {
    const i = (rng() * n) | 0;
    const j = (rng() * n) | 0;
    if (i === j) continue;

    const idI = out[i];
    const idJ = out[j];
    if (idI === idJ) continue;

    const current = cost(i, idI) + cost(j, idJ);
    const swapped = cost(i, idJ) + cost(j, idI);

    if (swapped < current) {
      out[i] = idJ;
      out[j] = idI;
    }
  }

  return out;
}

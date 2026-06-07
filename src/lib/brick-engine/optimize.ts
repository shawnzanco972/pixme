/**
 * Phase 2 — swap optimization.
 *
 * After the greedy per-cell assignment (phase 1), the despeckle pass nudges some
 * cells away from their ideal color to reduce noise. This pass repairs accuracy
 * lost that way: it repeatedly proposes swapping the assigned colors of two
 * cells and keeps the swap only if it lowers the TOTAL OKLab error against each
 * cell's original target color. Errors never increase, so it's safe to leave on.
 *
 * (For a pure greedy assignment with no constraints, greedy is already optimal
 * and swaps are no-ops — the value appears once despeckle/dither perturb things,
 * and it generalizes to count-constrained palettes later.)
 */
import { oklabDistanceSq, type OKLab } from "./color";
import { mulberry32, type Rng } from "./rng";

export interface SwapOptions {
  /** Number of candidate swaps to evaluate. Default ~6× the cell count. */
  iterations?: number;
  /** Seeded RNG for deterministic results. */
  rng?: Rng;
}

/**
 * @param indices   greedy/despeckled palette index per cell (row-major)
 * @param targets   each cell's desired OKLab color (the averaged+dithered color)
 * @param oklabById map palette index → its OKLab color
 */
export function swapOptimize(
  indices: number[],
  targets: OKLab[],
  oklabById: Map<number, OKLab>,
  options: SwapOptions = {},
): number[] {
  const n = indices.length;
  if (n < 2) return indices.slice();

  const rng = options.rng ?? mulberry32(0x5eed);
  const iterations = options.iterations ?? n * 6;
  const out = indices.slice();

  const errAt = (cell: number, id: number): number => {
    const c = oklabById.get(id);
    return c ? oklabDistanceSq(targets[cell], c) : 0;
  };

  for (let k = 0; k < iterations; k++) {
    const i = (rng() * n) | 0;
    const j = (rng() * n) | 0;
    if (i === j) continue;

    const idI = out[i];
    const idJ = out[j];
    if (idI === idJ) continue;

    const current = errAt(i, idI) + errAt(j, idJ);
    const swapped = errAt(i, idJ) + errAt(j, idI);

    if (swapped < current) {
      out[i] = idJ;
      out[j] = idI;
    }
  }

  return out;
}

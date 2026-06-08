/**
 * Floyd–Steinberg error-diffusion matching (OKLab space).
 *
 * The default pipeline matches each cell to its nearest palette color
 * independently. For smooth photographic gradients (skies, skin, soft shadows)
 * that snaps whole bands to one brick and looks posterized. Error diffusion
 * instead pushes each cell's quantization error onto not-yet-visited neighbors,
 * so the *average* color over a region tracks the original — trading a little
 * per-cell accuracy for a perceptually smoother gradient.
 *
 * Done perceptually (in OKLab, the project's matching space) rather than sRGB,
 * and with a serpentine scan so the error doesn't streak in one direction.
 *
 * This REPLACES the greedy phase-1 match when enabled. Because it deliberately
 * scatters colors, despeckle + swap-optimize would erase the texture, so the
 * orchestrator turns them off in this mode.
 */
import { type OKLab } from "./color";
import { effectiveDistanceSq, type MatchOptions } from "./match";
import { type BrickColor } from "./palette";

export interface FloydSteinbergOptions extends MatchOptions {
  /**
   * Fraction of the quantization error to diffuse (0..1). 1 = classic FS;
   * lower values keep more of each cell's true match (less noise) while still
   * dissolving bands. Default 0.9 — bricks are coarse, so full diffusion can
   * look gritty.
   */
  strength?: number;
  /** Serpentine (boustrophedon) scan to avoid directional streaks. Default true. */
  serpentine?: boolean;
}

const DEFAULT_STRENGTH = 0.9;

/** Nearest palette entry to an OKLab target (returns the BrickColor). */
function nearest(
  target: OKLab,
  palette: BrickColor[],
  opts: MatchOptions,
): BrickColor {
  let best = palette[0];
  let bestSq = Infinity;
  for (const c of palette) {
    const d = effectiveDistanceSq(target, c, opts);
    if (d < bestSq) {
      bestSq = d;
      best = c;
    }
  }
  return best;
}

/**
 * Error-diffuse `targets` (row-major OKLab grid) against `palette`, returning a
 * row-major array of palette **ids** (matching `nearestColorIndex`).
 */
export function floydSteinbergMatch(
  targets: OKLab[],
  cols: number,
  rows: number,
  palette: BrickColor[],
  options: FloydSteinbergOptions = {},
): number[] {
  const strength = options.strength ?? DEFAULT_STRENGTH;
  const serpentine = options.serpentine ?? true;
  if (palette.length === 0) return targets.map(() => 0);

  // Mutable working copy of the channels so we can add diffused error in place.
  const L = new Float64Array(targets.length);
  const a = new Float64Array(targets.length);
  const b = new Float64Array(targets.length);
  for (let i = 0; i < targets.length; i++) {
    L[i] = targets[i].L;
    a[i] = targets[i].a;
    b[i] = targets[i].b;
  }

  const out = new Array<number>(targets.length);
  // Standard FS kernel weights (right, below-left, below, below-right) / 16.
  const W = { right: 7 / 16, blDown: 3 / 16, down: 5 / 16, brDown: 1 / 16 };

  for (let y = 0; y < rows; y++) {
    const ltr = !serpentine || y % 2 === 0;
    const xStart = ltr ? 0 : cols - 1;
    const xEnd = ltr ? cols : -1;
    const step = ltr ? 1 : -1;
    // Mirror the kernel's horizontal direction on right-to-left rows.
    const fwd = ltr ? 1 : -1;

    for (let x = xStart; x !== xEnd; x += step) {
      const i = y * cols + x;
      const cell: OKLab = { L: L[i], a: a[i], b: b[i] };
      const chosen = nearest(cell, palette, options);
      out[i] = chosen.id;

      const eL = (cell.L - chosen.oklab.L) * strength;
      const ea = (cell.a - chosen.oklab.a) * strength;
      const eb = (cell.b - chosen.oklab.b) * strength;

      const diffuse = (nx: number, ny: number, w: number) => {
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return;
        const j = ny * cols + nx;
        L[j] += eL * w;
        a[j] += ea * w;
        b[j] += eb * w;
      };

      diffuse(x + fwd, y, W.right);
      diffuse(x - fwd, y + 1, W.blDown);
      diffuse(x, y + 1, W.down);
      diffuse(x + fwd, y + 1, W.brDown);
    }
  }

  return out;
}

/**
 * Brick Engine — orchestration.
 *
 * Pipeline (CLAUDE.md):
 *   image → coarse block quantization (gamma-correct averaging, in OKLab)
 *         → nearest-color match in OKLab (+ material penalty)
 *         → despeckle
 *         → pixel_map (2D array of palette indexes, row-major)
 *
 * Runs entirely client-side (Web Worker). The resulting pixel_map is persisted
 * to the DB and later trusted by the PDF route — image math never re-runs.
 */
import { type OKLab } from "./color";
import { despeckleGrid, type DespeckleOptions } from "./despeckle";
import { nearestColorIndex, type MatchOptions } from "./match";
import { DEFAULT_PALETTE, type BrickColor } from "./palette";
import { quantizeToGrid, type RGBAImage } from "./quantize";

export interface BrickifyOptions {
  /** Grid width in studs. Default 48 (3 × 16-stud modules). */
  cols?: number;
  /** Grid height in studs. Default 48. */
  rows?: number;
  /** Palette to match against. Default DEFAULT_PALETTE. */
  palette?: BrickColor[];
  /** Matching options (material preference/penalty). */
  match?: MatchOptions;
  /** Despeckle options; pass `null` to disable despeckling. */
  despeckle?: DespeckleOptions | null;
}

export interface BrickifyResult {
  /** 2D array of palette indexes (row-major: pixelMap[row][col]). */
  pixelMap: number[][];
  cols: number;
  rows: number;
}

/** Flatten a 2D pixel_map to a row-major 1D array. */
export function flatten(pixelMap: number[][]): number[] {
  return pixelMap.flat();
}

/** Inflate a row-major 1D array back into a 2D pixel_map. */
export function inflate(flat: number[], cols: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < flat.length; i += cols) out.push(flat.slice(i, i + cols));
  return out;
}

/** Core transform: an image to a brick pixel_map. */
export function brickifyImage(
  image: RGBAImage,
  options: BrickifyOptions = {},
): BrickifyResult {
  const cols = options.cols ?? 48;
  const rows = options.rows ?? 48;
  const palette = options.palette ?? DEFAULT_PALETTE;

  // 1) Coarse block quantization → grid of average OKLab colors.
  const avgGrid: OKLab[] = quantizeToGrid(image, cols, rows);

  // 2) Nearest-color match each cell.
  let indices: number[] = avgGrid.map((lab) =>
    nearestColorIndex(lab, palette, options.match),
  );

  // 3) Despeckle (unless disabled).
  if (options.despeckle !== null) {
    indices = despeckleGrid(indices, cols, rows, options.despeckle ?? {});
  }

  return { pixelMap: inflate(indices, cols), cols, rows };
}

/**
 * Render a pixel_map to an RGBA buffer at a given studs-to-pixels scale, for
 * preview canvases. Pure (no DOM) so it's usable in workers and tests.
 */
export function renderPreviewRGBA(
  pixelMap: number[][],
  palette: BrickColor[] = DEFAULT_PALETTE,
  scale = 1,
): { data: Uint8ClampedArray; width: number; height: number } {
  const rows = pixelMap.length;
  const cols = rows > 0 ? pixelMap[0].length : 0;
  const width = cols * scale;
  const height = rows * scale;
  const data = new Uint8ClampedArray(width * height * 4);

  const byId = new Map<number, BrickColor>(palette.map((c) => [c.id, c]));

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const color = byId.get(pixelMap[gy][gx]);
      const [r, g, b] = color?.rgb ?? [0, 0, 0];
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = (gy * scale + sy) * width + (gx * scale + sx);
          const o = px * 4;
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = 255;
        }
      }
    }
  }

  return { data, width, height };
}

/** Count how many studs of each palette index a pixel_map uses. */
export function countParts(pixelMap: number[][]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of pixelMap) {
    for (const id of row) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export { DEFAULT_PALETTE } from "./palette";
export type { BrickColor } from "./palette";
export type { RGBAImage } from "./quantize";

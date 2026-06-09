/**
 * Brick Engine — orchestration.
 *
 * Pipeline (CLAUDE.md + crispness refactor):
 *   image
 *     → user pre-processing (brightness / contrast / saturation)   [crisp edges]
 *     → coarse block quantization (gamma-correct linear averaging)
 *     → dither: tiny noise in sRGB before OKLab conversion           [no banding]
 *     → nearest-color match in OKLab (+ material penalty)  — phase 1 greedy
 *     → despeckle with Sobel edge preservation                      [keep edges]
 *     → swap optimization                                  — phase 2 refine
 *     → pixel_map (2D array of palette indexes, row-major)
 *
 * Runs entirely client-side (Web Worker). The result is DETERMINISTIC for a
 * given image+options (seeded RNG), since the pixel_map is persisted and later
 * trusted by the PDF route — image math never re-runs.
 */
import { type OKLab } from "./color";
import { despeckleGrid, type DespeckleOptions } from "./despeckle";
import {
  ditherLinearToOklab,
  DEFAULT_DITHER_AMOUNT,
  type DitherOptions,
} from "./dither";
import {
  floydSteinbergMatch,
  type FloydSteinbergOptions,
} from "./fsdither";
import { effectiveDistanceSq, nearestColorIndex, type MatchOptions } from "./match";
import { swapOptimize, type SwapOptions } from "./optimize";
import { DEFAULT_PALETTE, type BrickColor } from "./palette";
import { preprocessImage, type PreprocessOptions } from "./preprocess";
import {
  quantizeToLinearGrid,
  type QuantizeOptions,
  type RGBAImage,
} from "./quantize";
import { mulberry32 } from "./rng";
import { computeEdgeMask } from "./sobel";

export interface EdgePreservationOptions {
  /** Enable Sobel edge preservation in despeckle. Default true. */
  enabled?: boolean;
  /** Sobel magnitude (on OKLab L) above which a cell counts as an edge. */
  threshold?: number;
}

export interface OptimizeOptions extends SwapOptions {
  /** Enable phase-2 swap optimization. Default true. */
  enabled?: boolean;
}

export interface BrickifyOptions {
  /** Grid width in studs. Default 48 (3 × 16-stud modules). */
  cols?: number;
  /** Grid height in studs. Default 48. */
  rows?: number;
  /** Palette to match against. Default DEFAULT_PALETTE. */
  palette?: BrickColor[];
  /** Matching options (material preference/penalty). */
  match?: MatchOptions;
  /** User pre-processing (brightness/contrast/saturation). */
  preprocess?: PreprocessOptions;
  /**
   * Detail preservation during downsampling (0..1): high-contrast cells commit
   * to their dominant luma cluster instead of averaging to mush, keeping text
   * and thin outlines legible. Default 0.35 (0.7 in line-art mode).
   */
  detail?: QuantizeOptions["detail"];
  /** Dithering options; pass `null` to disable noise dithering. */
  dither?: DitherOptions | null;
  /**
   * Floyd–Steinberg error-diffusion matching for smooth photographic
   * gradients. `true` for defaults, or an options object. When on, the noise
   * dither, despeckle and swap-optimize passes default OFF (they'd erase the
   * diffusion texture). Default off (greedy nearest-color match).
   */
  fsDither?: FloydSteinbergOptions | boolean;
  /** Despeckle options; pass `null` to disable despeckling. */
  despeckle?: DespeckleOptions | null;
  /** Sobel edge-preservation options for despeckle. */
  edgePreservation?: EdgePreservationOptions;
  /** Phase-2 swap optimization options. */
  optimize?: OptimizeOptions;
  /** Seed for the deterministic RNG (dither + swap). Default 1337. */
  seed?: number;
}

const DEFAULT_EDGE_THRESHOLD = 0.1;

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
  const rng = mulberry32(options.seed ?? 1337);

  // 0) User pre-processing on the full-res image (contrast keeps edges sharp).
  const src = preprocessImage(image, options.preprocess ?? {});

  // 1) Coarse block quantization → grid of average LINEAR-RGB colors, with
  //    dominant-cluster detail preservation so strokes/text survive.
  const detail = options.detail ?? (options.preprocess?.lineArt ? 0.7 : 0.35);
  const linGrid = quantizeToLinearGrid(src, cols, rows, { detail });

  // Floyd–Steinberg mode diffuses error itself, so noise dither would only add
  // grit; force it off when FS is on (unless the caller explicitly asked).
  const fs = options.fsDither;
  const ditherAmount =
    options.dither && !(fs && options.dither === undefined)
      ? (options.dither.amount ?? DEFAULT_DITHER_AMOUNT)
      : 0;
  const targets: OKLab[] = linGrid.map((lin) =>
    ditherLinearToOklab(lin, ditherAmount, rng),
  );

  // 3) Phase 1 — either greedy nearest-color match or FS error diffusion.
  let indices: number[];
  if (fs) {
    const fsOpts: FloydSteinbergOptions = {
      ...options.match,
      ...(typeof fs === "object" ? fs : {}),
    };
    indices = floydSteinbergMatch(targets, cols, rows, palette, fsOpts);
  } else {
    indices = targets.map((lab) =>
      nearestColorIndex(lab, palette, options.match),
    );
  }

  // Shared perceptual cost — the SAME metric the greedy matcher minimizes
  // (chroma/hue weighting, neutral-avoidance, material penalty). Used by the
  // despeckle guard and swap optimization so neither can undo matching choices.
  const byId = new Map<number, BrickColor>(palette.map((c) => [c.id, c]));
  const cost = (cell: number, id: number): number => {
    const c = byId.get(id);
    return c ? effectiveDistanceSq(targets[cell], c, options.match) : Infinity;
  };

  // 4) Despeckle with Sobel edge preservation. Defaults OFF under FS (it would
  //    flatten the deliberate diffusion texture) unless the caller opts in.
  const despeckleOn =
    options.despeckle === null
      ? false
      : fs
        ? options.despeckle !== undefined
        : true;
  if (despeckleOn) {
    const edgeEnabled = options.edgePreservation?.enabled ?? true;
    // Line-art/text wants MORE edges preserved → a lower Sobel threshold.
    const edgeThreshold =
      options.edgePreservation?.threshold ??
      (options.preprocess?.lineArt ? 0.06 : DEFAULT_EDGE_THRESHOLD);
    const edgeMask = edgeEnabled
      ? computeEdgeMask(targets.map((t) => t.L), cols, rows, edgeThreshold)
      : null;
    indices = despeckleGrid(indices, cols, rows, {
      // Stronger defaults clean flat-area noise; edge mask keeps faces crisp;
      // cost guard stops majority vote from planting a far-off color.
      minSameNeighbors: 3,
      passes: 2,
      cost,
      ...options.despeckle,
      edgeMask,
    });
  }

  // 5) Phase 2 — swap optimization, using the SAME cost as the greedy matcher
  //    (chroma weight + neutral-avoidance + material penalty) so it can't undo
  //    the matcher's choices. Off by default under FS (would undo diffusion).
  if (options.optimize?.enabled ?? !fs) {
    indices = swapOptimize(indices, cost, {
      iterations: options.optimize?.iterations,
      rng,
    });
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

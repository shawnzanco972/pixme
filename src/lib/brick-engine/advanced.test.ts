import { describe, expect, it } from "vitest";

import { linearRgbToOklab, oklabDistanceSq } from "./color";
import { ditherLinearToOklab } from "./dither";
import { brickifyImage } from "./index";
import { swapOptimize } from "./optimize";
import { despeckleGrid } from "./despeckle";
import { preprocessImage } from "./preprocess";
import { DEFAULT_PALETTE } from "./palette";
import type { RGBAImage, LinearRGB } from "./quantize";
import { mulberry32 } from "./rng";
import { computeEdgeMask, sobelMagnitude } from "./sobel";

function img(w: number, h: number, px: [number, number, number][]): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = px[i][0];
    data[i * 4 + 1] = px[i][1];
    data[i * 4 + 2] = px[i][2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("preprocessImage", () => {
  it("is identity when all controls are neutral (returns same ref)", () => {
    const image = img(1, 1, [[100, 120, 140]]);
    expect(preprocessImage(image, {})).toBe(image);
  });

  it("contrast increases the spread between dark and light", () => {
    const image = img(2, 1, [
      [100, 100, 100],
      [150, 150, 150],
    ]);
    const out = preprocessImage(image, { contrast: 2 });
    expect(out.data[0]).toBeLessThan(100); // dark gets darker
    expect(out.data[4]).toBeGreaterThan(150); // light gets lighter
  });

  it("saturation 0 produces grayscale (channels equal)", () => {
    const out = preprocessImage(img(1, 1, [[200, 50, 50]]), { saturation: 0 });
    expect(out.data[0]).toBe(out.data[1]);
    expect(out.data[1]).toBe(out.data[2]);
  });
});

describe("dither", () => {
  it("amount 0 equals a plain OKLab conversion", () => {
    const lin: LinearRGB = [0.2, 0.5, 0.8];
    const plain = linearRgbToOklab(...lin);
    const d = ditherLinearToOklab(lin, 0, mulberry32(1));
    expect(d).toEqual(plain);
  });

  it("is deterministic for a given seed and varies with noise", () => {
    const lin: LinearRGB = [0.3, 0.3, 0.3];
    const a = ditherLinearToOklab(lin, 0.05, mulberry32(42));
    const b = ditherLinearToOklab(lin, 0.05, mulberry32(42));
    expect(a).toEqual(b); // same seed → same result
    const plain = linearRgbToOklab(...lin);
    expect(a.L === plain.L && a.a === plain.a && a.b === plain.b).toBe(false);
  });
});

describe("sobel", () => {
  it("detects a vertical edge and ignores flat areas", () => {
    // 4×4: left two columns 0, right two columns 1.
    const cols = 4;
    const rows = 4;
    const lum: number[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) lum.push(x < 2 ? 0 : 1);

    const mag = sobelMagnitude(lum, cols, rows);
    expect(mag[0]).toBeCloseTo(0, 5); // flat far-left
    expect(mag[1 * cols + 1]).toBeGreaterThan(1); // at the boundary

    const mask = computeEdgeMask(lum, cols, rows, 0.5);
    expect(mask[0]).toBe(false);
    expect(mask[1 * cols + 2]).toBe(true);
  });
});

describe("despeckle edge preservation", () => {
  it("removes a flat speckle but preserves one marked as an edge", () => {
    const cols = 5;
    const rows = 5;
    const grid = new Array(cols * rows).fill(0);
    const center = 2 * cols + 2;
    grid[center] = 9;

    // No edge mask → speckle removed.
    expect(despeckleGrid(grid, cols, rows)[center]).toBe(0);

    // Marked as an edge → preserved.
    const mask = new Array(cols * rows).fill(false);
    mask[center] = true;
    expect(despeckleGrid(grid, cols, rows, { edgeMask: mask })[center]).toBe(9);
  });
});

describe("swapOptimize", () => {
  const A = linearRgbToOklab(0.8, 0.1, 0.1);
  const B = linearRgbToOklab(0.1, 0.1, 0.8);
  const oklabById = new Map([
    [0, A],
    [1, B],
  ]);

  it("fixes a beneficial swap and lowers total error", () => {
    const targets = [A, B];
    const wrong = [1, 0]; // each cell assigned the other's color
    const err = (idx: number[]) =>
      oklabDistanceSq(targets[0], oklabById.get(idx[0])!) +
      oklabDistanceSq(targets[1], oklabById.get(idx[1])!);

    const fixed = swapOptimize(wrong, targets, oklabById, {
      iterations: 50,
      rng: mulberry32(7),
    });
    expect(fixed).toEqual([0, 1]);
    expect(err(fixed)).toBeLessThan(err(wrong));
  });

  it("never increases error on an already-optimal assignment", () => {
    const targets = [A, B];
    const optimal = [0, 1];
    const out = swapOptimize(optimal, targets, oklabById, {
      iterations: 50,
      rng: mulberry32(7),
    });
    expect(out).toEqual([0, 1]);
  });
});

describe("brickifyImage (refactored)", () => {
  it("is deterministic for the same image + seed", () => {
    const px: [number, number, number][] = [];
    for (let i = 0; i < 16 * 16; i++) px.push([i % 256, (i * 3) % 256, 100]);
    const image = img(16, 16, px);
    const a = brickifyImage(image, { cols: 16, rows: 16, seed: 99 });
    const b = brickifyImage(image, { cols: 16, rows: 16, seed: 99 });
    expect(a.pixelMap).toEqual(b.pixelMap);
  });

  it("keeps a hard black/white edge crisp (no muddy middle)", () => {
    // 16px wide: left half black, right half white → clean column boundary.
    const px: [number, number, number][] = [];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        px.push(x < 8 ? [0, 0, 0] : [255, 255, 255]);
    const image = img(16, 16, px);

    const black = DEFAULT_PALETTE.find((c) => c.name === "Black")!.id;
    const white = DEFAULT_PALETTE.find((c) => c.name === "White")!.id;

    const { pixelMap } = brickifyImage(image, {
      cols: 16,
      rows: 16,
      preprocess: { contrast: 1.3 },
    });

    for (const row of pixelMap) {
      expect(row.slice(0, 8).every((id) => id === black)).toBe(true);
      expect(row.slice(8).every((id) => id === white)).toBe(true);
    }
  });
});

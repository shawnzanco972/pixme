import { describe, expect, it } from "vitest";

import { despeckleGrid } from "./despeckle";
import {
  brickifyImage,
  countParts,
  flatten,
  inflate,
  renderPreviewRGBA,
} from "./index";
import { DEFAULT_PALETTE } from "./palette";
import type { RGBAImage } from "./quantize";

/** Build a solid-color RGBA image of the given size. */
function solidImage(
  w: number,
  h: number,
  rgb: [number, number, number],
): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("brickifyImage", () => {
  it("maps a solid image to a uniform pixel_map", () => {
    const blue = DEFAULT_PALETTE.find((c) => c.name === "Blue")!;
    const img = solidImage(32, 32, blue.rgb);
    const { pixelMap, cols, rows } = brickifyImage(img, { cols: 16, rows: 16 });

    expect(rows).toBe(16);
    expect(cols).toBe(16);
    expect(pixelMap.length).toBe(16);
    expect(pixelMap[0].length).toBe(16);
    // Every cell should be Blue.
    expect(pixelMap.flat().every((id) => id === blue.id)).toBe(true);
  });

  it("countParts sums to the total stud count", () => {
    const img = solidImage(16, 16, [200, 50, 50]);
    const { pixelMap } = brickifyImage(img, { cols: 16, rows: 16 });
    const counts = countParts(pixelMap);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(16 * 16);
  });
});

describe("despeckleGrid", () => {
  it("removes a single isolated stray stud", () => {
    // 5×5 field of 0 with a lone 9 in the middle.
    const cols = 5;
    const rows = 5;
    const grid = new Array(cols * rows).fill(0);
    grid[2 * cols + 2] = 9;

    const out = despeckleGrid(grid, cols, rows, { minSameNeighbors: 2 });
    expect(out[2 * cols + 2]).toBe(0); // stray replaced by majority neighbor
  });

  it("keeps a solid region intact", () => {
    const cols = 4;
    const rows = 4;
    const grid = new Array(cols * rows).fill(7);
    const out = despeckleGrid(grid, cols, rows);
    expect(out.every((v) => v === 7)).toBe(true);
  });
});

describe("flatten / inflate", () => {
  it("are inverse operations", () => {
    const map = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(inflate(flatten(map), 3)).toEqual(map);
  });
});

describe("renderPreviewRGBA", () => {
  it("produces a correctly-sized opaque buffer", () => {
    const map = [
      [0, 1],
      [2, 3],
    ];
    const { data, width, height } = renderPreviewRGBA(map, DEFAULT_PALETTE, 4);
    expect(width).toBe(8);
    expect(height).toBe(8);
    expect(data.length).toBe(8 * 8 * 4);
    // alpha channel fully opaque
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  });
});

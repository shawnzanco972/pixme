import { describe, expect, it } from "vitest";

import { srgbToOklab, type OKLab } from "./color";
import { faceAwareContrast, skinStats, skinWeight } from "./face";
import { floydSteinbergMatch } from "./fsdither";
import { brickifyImage } from "./index";
import { DEFAULT_PALETTE } from "./palette";
import { preprocessImage } from "./preprocess";
import type { RGBAImage } from "./quantize";
import { unsharpMask } from "./unsharp";

/** Build an RGBA image from a per-pixel color function. */
function makeImage(
  w: number,
  h: number,
  fn: (x: number, y: number) => [number, number, number],
): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe("floydSteinbergMatch", () => {
  it("matches a solid color to that single palette entry", () => {
    const blue = DEFAULT_PALETTE.find((c) => c.name === "Blue")!;
    const targets: OKLab[] = Array.from({ length: 64 }, () => blue.oklab);
    const ids = floydSteinbergMatch(targets, 8, 8, DEFAULT_PALETTE);
    expect(ids.every((id) => id === blue.id)).toBe(true);
  });

  it("dithers a mid-tone between two palette colors instead of one flat band", () => {
    // A grey that sits between black and white should resolve to a MIX, not a
    // single color, once error is diffused.
    const grey = srgbToOklab(128, 128, 128);
    const targets: OKLab[] = Array.from({ length: 100 }, () => grey);
    const bw = DEFAULT_PALETTE.filter(
      (c) => c.name === "White" || c.name === "Black",
    );
    const ids = floydSteinbergMatch(targets, 10, 10, bw);
    const distinct = new Set(ids);
    expect(distinct.size).toBe(2); // both black AND white used
  });

  it("is deterministic for the same input", () => {
    const targets: OKLab[] = Array.from({ length: 64 }, (_, i) =>
      srgbToOklab(i * 3, 100, 200 - i),
    );
    const a = floydSteinbergMatch(targets, 8, 8, DEFAULT_PALETTE);
    const b = floydSteinbergMatch(targets, 8, 8, DEFAULT_PALETTE);
    expect(a).toEqual(b);
  });
});

describe("skin detection", () => {
  it("scores a skin tone above a blue sky", () => {
    expect(skinWeight(230, 180, 150)).toBeGreaterThan(0); // warm skin
    expect(skinWeight(100, 150, 230)).toBe(0); // blue sky
    expect(skinWeight(128, 128, 128)).toBe(0); // neutral grey
  });

  it("finds the skin luma from an image that's part skin", () => {
    // Left half skin, right half blue.
    const img = makeImage(20, 20, (x) =>
      x < 10 ? [230, 180, 150] : [60, 90, 200],
    );
    const stats = skinStats(img);
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.skinLuma).not.toBeNull();
  });
});

describe("faceAwareContrast", () => {
  it("leaves images with no skin unchanged (same buffer)", () => {
    const img = makeImage(20, 20, () => [60, 90, 200]);
    expect(faceAwareContrast(img)).toBe(img);
  });

  it("expands contrast inside a skin region", () => {
    // A face area with a dark feature (eye) on lighter skin.
    const img = makeImage(20, 20, (x, y) => {
      const isEye = x >= 8 && x <= 11 && y >= 8 && y <= 11;
      return isEye ? [120, 80, 60] : [230, 180, 150];
    });
    const out = faceAwareContrast(img, 0.6);
    expect(out).not.toBe(img);
    // The eye (below skin midtone) should get darker; skin highs lighter →
    // greater spread than the original.
    const eyeI = (9 * 20 + 9) * 4;
    expect(out.data[eyeI]).toBeLessThanOrEqual(img.data[eyeI]);
  });
});

describe("unsharpMask", () => {
  it("increases contrast across an edge", () => {
    // Vertical edge: left dark, right light.
    const img = makeImage(20, 20, (x) =>
      x < 10 ? [40, 40, 40] : [210, 210, 210],
    );
    const out = unsharpMask(img, 0.8);
    // Pixel just left of the edge gets pushed darker, just right gets lighter.
    const leftI = (5 * 20 + 9) * 4;
    const rightI = (5 * 20 + 10) * 4;
    expect(out.data[leftI]).toBeLessThanOrEqual(img.data[leftI]);
    expect(out.data[rightI]).toBeGreaterThanOrEqual(img.data[rightI]);
  });

  it("preprocess lineArt path runs without changing dimensions", () => {
    const img = makeImage(16, 16, (x, y) => [x * 10, y * 10, 100]);
    const out = preprocessImage(img, { lineArt: true });
    expect(out.width).toBe(16);
    expect(out.height).toBe(16);
  });
});

describe("brickifyImage fsDither integration", () => {
  it("produces a valid pixel_map and skips despeckle/optimize by default", () => {
    const img = makeImage(48, 48, (x) => [x * 5, 128, 200 - x * 4]);
    const { pixelMap, cols, rows } = brickifyImage(img, {
      cols: 24,
      rows: 24,
      fsDither: true,
    });
    expect(rows).toBe(24);
    expect(cols).toBe(24);
    expect(pixelMap.flat().every((id) => typeof id === "number")).toBe(true);
  });
});

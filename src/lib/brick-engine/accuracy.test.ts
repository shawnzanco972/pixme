import { describe, expect, it } from "vitest";

import { srgbToOklab } from "./color";
import { despeckleGrid } from "./despeckle";
import { nearestColorIndex } from "./match";
import { buildPalette, DEFAULT_PALETTE, type BrickColorDef } from "./palette";
import { quantizeToLinearGrid, type RGBAImage } from "./quantize";

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

describe("matching accuracy (green-square regression)", () => {
  const greens = DEFAULT_PALETTE.filter((c) => c.name.includes("Green")).map(
    (c) => c.id,
  );
  const darkNeutralish = DEFAULT_PALETTE.filter((c) =>
    ["Black", "Dark Bluish Gray", "Dark Brown"].includes(c.name),
  ).map((c) => c.id);

  it("dark, faintly tinted pixels stay dark/neutral instead of going green", () => {
    // Shadow pixels with slight green/teal sensor tint — the classic source of
    // the "random green stud". Neutral-avoidance must fade out in shadow.
    for (const rgb of [
      [38, 48, 40],
      [50, 62, 52],
      [30, 42, 38],
    ] as const) {
      const idx = nearestColorIndex(
        srgbToOklab(rgb[0], rgb[1], rgb[2]),
        DEFAULT_PALETTE,
      );
      expect(greens).not.toContain(idx);
      expect(darkNeutralish).toContain(idx);
    }
  });

  it("hue weighting: a desaturated warm tone never lands on a green brick", () => {
    for (const rgb of [
      [150, 130, 110], // warm gray
      [120, 105, 95], // dull brown
    ] as const) {
      const idx = nearestColorIndex(
        srgbToOklab(rgb[0], rgb[1], rgb[2]),
        DEFAULT_PALETTE,
      );
      expect(greens).not.toContain(idx);
    }
  });

  it("still keeps saturated colors saturated (no collapse to gray)", () => {
    const red = DEFAULT_PALETTE.find((c) => c.name === "Red")!;
    expect(nearestColorIndex(srgbToOklab(180, 40, 30), DEFAULT_PALETTE)).toBe(
      red.id,
    );
  });
});

describe("detail-preserving quantization (text legibility)", () => {
  it("a majority-dark cell commits toward the stroke color instead of gray", () => {
    // One 4×4 block: 10 black "letter" pixels on 6 white background pixels.
    const px: [number, number, number][] = [];
    for (let i = 0; i < 16; i++) px.push(i < 10 ? [0, 0, 0] : [255, 255, 255]);
    const image = img(4, 4, px);

    const [avg] = quantizeToLinearGrid(image, 1, 1);
    const [crisp] = quantizeToLinearGrid(image, 1, 1, { detail: 1 });
    // Pulled toward the dominant (dark) cluster → darker than the plain mean.
    expect(crisp[0]).toBeLessThan(avg[0]);
    expect(crisp[0]).toBeLessThan(0.1);
  });

  it("leaves low-contrast cells untouched (no posterized gradients)", () => {
    const px: [number, number, number][] = Array.from({ length: 16 }, (_, i) => {
      const v = 120 + i; // gentle ramp, spread below threshold
      return [v, v, v] as [number, number, number];
    });
    const image = img(4, 4, px);
    expect(quantizeToLinearGrid(image, 1, 1, { detail: 1 })).toEqual(
      quantizeToLinearGrid(image, 1, 1),
    );
  });
});

describe("despeckle cost guard", () => {
  it("refuses a majority replacement that is perceptually far off", () => {
    const cols = 5;
    const rows = 5;
    const grid = new Array(cols * rows).fill(0);
    const center = 2 * cols + 2;
    grid[center] = 9;

    // cost says color 0 is terrible for the center cell, fine elsewhere.
    const cost = (cell: number, id: number) =>
      cell === center ? (id === 9 ? 0 : 1) : 0;
    const out = despeckleGrid(grid, cols, rows, { cost });
    expect(out[center]).toBe(9); // kept — replacement would cost too much

    // Without the guard the speckle is replaced as before.
    expect(despeckleGrid(grid, cols, rows)[center]).toBe(0);
  });
});

describe("buildPalette sanity for new defs", () => {
  it("builds with Hebrew names present", () => {
    const defs: BrickColorDef[] = [
      {
        id: 0,
        name: "White",
        nameHe: "לבן",
        hex: "#f2f3f2",
        material: "solid",
        core: true,
      },
    ];
    expect(buildPalette(defs)[0].oklab.L).toBeGreaterThan(0.9);
  });
});

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
  it("dark, faintly tinted pixels stay dark/neutral instead of going green", () => {
    // Shadow pixels with slight green/teal sensor tint — the classic source of
    // the "random green stud". Neutral-avoidance must fade out in shadow.
    //
    // Asserted by PROPERTY (dark + low chroma) rather than an allowlist of
    // brick names: the palette gains colours over time, and a new dark brick
    // that matches better should pass, not fail. (Coffee, added with the skin
    // ramp, is a closer match for mid-shadows than Black — raw OKLab 0.053 vs
    // 0.130 — because its lightness actually lines up.)
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

      const picked = DEFAULT_PALETTE.find((c) => c.id === idx)!;
      expect(picked.oklab.L, `${picked.name} too light`).toBeLessThan(0.45);
      expect(
        Math.hypot(picked.oklab.a, picked.oklab.b),
        `${picked.name} too saturated`,
      ).toBeLessThan(0.09);
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

describe("random green studs (mid-grey lightness hole)", () => {
  // Our greys used to jump from L 0.535 to L 0.719. A mid-tone grey had no
  // brick at its own lightness, so it landed on Sand Green (L 0.663) — the
  // "random green stud" customers reported. The grey ramp (N8-N10) closes it.
  const greens = new Set(["bright-green", "dark-green", "olive-green", "sand-green"]);
  const chroma = (c: { a: number; b: number }) => Math.hypot(c.a, c.b);

  it("keeps genuinely neutral pixels off green bricks", () => {
    const slugOf = new Map(DEFAULT_PALETTE.map((c) => [c.id, c.colorId]));
    const bad: string[] = [];
    for (let r = 0; r < 256; r += 11)
      for (let g = 0; g < 256; g += 11)
        for (let b = 0; b < 256; b += 11) {
          const lab = srgbToOklab(r, g, b);
          if (chroma(lab) > 0.028) continue; // genuinely neutral only
          const slug = slugOf.get(nearestColorIndex(lab, DEFAULT_PALETTE))!;
          if (greens.has(slug)) bad.push(`rgb(${r},${g},${b})->${slug}`);
        }
    expect(bad, `neutral pixels went green: ${bad.join(", ")}`).toEqual([]);
  });

  it("has no big lightness gap in the MID neutral ramp", () => {
    // Scoped to L 0.35–0.85, where the bug actually lived: a mid grey with no
    // neutral at its lightness defects to a tinted brick. The extremes are
    // deliberately sparser (black→charcoal, pale-grey→white) — vision
    // compresses there and extra near-black/near-white bricks buy little.
    const ls = DEFAULT_PALETTE.filter(
      (c) => chroma(c.oklab) < 0.03 && c.oklab.L >= 0.35 && c.oklab.L <= 0.85,
    )
      .map((c) => c.oklab.L)
      .sort((a, b) => a - b);
    expect(ls.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i] - ls[i - 1], `gap at L=${ls[i - 1].toFixed(3)}`).toBeLessThan(0.12);
    }
  });
});

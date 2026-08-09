/**
 * Skin-tone fidelity regression tests.
 *
 * The "red face" bug: with the old vivid defaults (contrast 1.2 / saturation
 * 1.1 / autoLevels on) warm skin gained chroma on every pre-processing pass and
 * the matcher happily picked Red / Dark Red, because nothing penalized choosing
 * a brick MORE saturated than the source. These tests pin both halves of the
 * fix: neutral defaults, and the chroma-overshoot guard in match.ts.
 */
import { describe, expect, it } from "vitest";

import { srgbToOklab } from "./color";
import { brickifyImage } from "./index";
import { nearestColorIndex } from "./match";
import { CATALOG, getActivePalette, slugForId } from "./palette";
import { DEFAULT_ENGINE_SETTINGS } from "@/lib/design-settings";
import type { RGBAImage } from "./quantize";

/** The colours actually stocked for launch (all 31 are orderable). */
const PALETTE = getActivePalette(CATALOG.map((c) => c.colorId));

/** Realistic skin tones across the Fitzpatrick range (sRGB, unfiltered). */
const SKIN: [number, number, number, string][] = [
  [255, 224, 196, "very light"],
  [241, 194, 156, "light"],
  [236, 188, 180, "light pink-ish"],
  [224, 172, 135, "light-medium"],
  [210, 161, 140, "medium rosy"],
  [198, 134, 96, "medium"],
  [172, 112, 80, "medium-deep"],
  [141, 85, 56, "deep"],
  [101, 63, 43, "very deep"],
];

/** Colours a face must never be built from. */
const FORBIDDEN = new Set([
  "red",
  "dark-red",
  "orange",
  "dark-pink",
  "bright-green",
  "dark-green",
  "blue",
  "medium-azure",
]);

describe("skin tones never match to saturated accents", () => {
  for (const [r, g, b, label] of SKIN) {
    it(`${label} (${r},${g},${b}) maps to a skin/neutral brick`, () => {
      const id = nearestColorIndex(srgbToOklab(r, g, b), PALETTE);
      const slug = slugForId(id);
      expect(FORBIDDEN.has(slug), `got ${slug}`).toBe(false);
    });
  }

  it("resolves the mid-deep ramp into DISTINCT bricks (no flat faces)", () => {
    // The realism defect: these four tones all used to match Medium Nougat, so
    // a face lost every bit of modelling through its mid-tones. They must now
    // land on at least 3 different bricks.
    const ramp: [number, number, number][] = [
      [180, 138, 120],
      [172, 112, 80],
      [152, 104, 80],
      [141, 85, 56],
    ];
    const picked = ramp.map(([r, g, b]) =>
      slugForId(nearestColorIndex(srgbToOklab(r, g, b), PALETTE)),
    );
    expect(new Set(picked).size, `got ${picked.join(", ")}`).toBeGreaterThanOrEqual(3);
  });

  it("keeps a genuinely saturated red target on Red (no over-correction)", () => {
    // The overshoot guard must not make vivid logos go muddy.
    const id = nearestColorIndex(srgbToOklab(0xc9, 0x1a, 0x09), PALETTE);
    expect(slugForId(id)).toBe("red");
  });

  it("still matches a saturated blue and green exactly", () => {
    expect(slugForId(nearestColorIndex(srgbToOklab(0, 0x55, 0xbf), PALETTE))).toBe("blue");
    expect(slugForId(nearestColorIndex(srgbToOklab(0x4b, 0x9f, 0x4a), PALETTE))).toBe(
      "bright-green",
    );
  });
});

describe("default engine settings stay fidelity-safe", () => {
  it("never boosts per-channel contrast or auto-levels by default", () => {
    // These two are what inflated skin chroma into Red. Contrast is applied
    // per channel around mid-gray, and auto-levels stretches the histogram —
    // both push R away from B on warm subjects. They must stay neutral.
    expect(DEFAULT_ENGINE_SETTINGS.contrast).toBe(1);
    expect(DEFAULT_ENGINE_SETTINGS.autoLevels).toBe(false);
  });

  it("keeps the saturation lift small and bounded", () => {
    // A modest lift is deliberate: snapping to ~20 bricks desaturates, so 1.0
    // renders greyer than the source. Saturation scales around luma and does
    // not reorder channels, and the overshoot guard covers the rest — but it
    // must not creep up unchecked.
    expect(DEFAULT_ENGINE_SETTINGS.saturation).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_ENGINE_SETTINGS.saturation).toBeLessThanOrEqual(1.2);
  });

  it("ships dithering off (it speckles photos at stud resolution)", () => {
    expect(DEFAULT_ENGINE_SETTINGS.smoothGradients).toBe(false);
  });
});

/** Solid-colour image helper. */
function solid(w: number, h: number, rgb: [number, number, number]): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("full pipeline with default settings", () => {
  it("renders a flat skin-tone image without any red bricks", () => {
    const img = solid(64, 64, [224, 172, 135]);
    const { pixelMap } = brickifyImage(img, {
      cols: 24,
      rows: 24,
      palette: PALETTE,
      preprocess: {
        contrast: DEFAULT_ENGINE_SETTINGS.contrast,
        saturation: DEFAULT_ENGINE_SETTINGS.saturation,
        autoLevels: DEFAULT_ENGINE_SETTINGS.autoLevels,
      },
      detail: DEFAULT_ENGINE_SETTINGS.detail,
      dither: null,
    });
    const slugs = new Set(pixelMap.flat().map(slugForId));
    for (const forbidden of ["red", "dark-red", "orange"]) {
      expect(slugs.has(forbidden), `used ${forbidden}`).toBe(false);
    }
  });
});

describe("saturation lift is safe for skin", () => {
  // The default lifts saturation to 1.15 to counter the desaturation inherent
  // in snapping every pixel to ~20 bricks. That is only acceptable while the
  // chroma-overshoot guard holds skin off the warm accents — this pins it.
  it("a skin-toned image stays on skin bricks at the default saturation", () => {
    const img = solid(96, 96, [224, 172, 135]);
    const { pixelMap } = brickifyImage(img, {
      cols: 32,
      rows: 32,
      palette: PALETTE,
      preprocess: {
        contrast: DEFAULT_ENGINE_SETTINGS.contrast,
        saturation: DEFAULT_ENGINE_SETTINGS.saturation,
        autoLevels: DEFAULT_ENGINE_SETTINGS.autoLevels,
      },
      dither: null,
    });
    const slugs = new Set(pixelMap.flat().map(slugForId));
    for (const bad of ["red", "dark-red", "orange", "dark-pink"]) {
      expect(slugs.has(bad), `used ${bad}`).toBe(false);
    }
  });

  it("stays safe even one step above the default", () => {
    const img = solid(96, 96, [198, 134, 96]);
    const { pixelMap } = brickifyImage(img, {
      cols: 32, rows: 32, palette: PALETTE,
      preprocess: { contrast: 1, saturation: 1.3, autoLevels: false },
      dither: null,
    });
    const slugs = new Set(pixelMap.flat().map(slugForId));
    expect(slugs.has("red"), "used red").toBe(false);
  });
});

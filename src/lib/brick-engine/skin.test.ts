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

describe("default engine settings are fidelity-neutral", () => {
  it("does not boost contrast/saturation or auto-level by default", () => {
    expect(DEFAULT_ENGINE_SETTINGS.contrast).toBe(1);
    expect(DEFAULT_ENGINE_SETTINGS.saturation).toBe(1);
    expect(DEFAULT_ENGINE_SETTINGS.autoLevels).toBe(false);
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

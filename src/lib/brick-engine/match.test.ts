import { describe, expect, it } from "vitest";

import { srgbToOklab } from "./color";
import { nearestColorIndex } from "./match";
import { buildPalette, DEFAULT_PALETTE, type BrickColorDef } from "./palette";

describe("nearestColorIndex", () => {
  it("does NOT match skin tones to green (the core failure mode)", () => {
    // Small palette: a green, a skin/nougat tone, plus anchors.
    const GREEN_ID = 2;
    const NOUGAT_ID = 3;
    const defs: BrickColorDef[] = [
      { id: 0, name: "White", hex: "#f4f4f4", material: "solid", core: true },
      { id: 1, name: "Black", hex: "#1b1b1b", material: "solid", core: true },
      { id: GREEN_ID, name: "Bright Green", hex: "#4b9f4a", material: "solid", core: true },
      { id: NOUGAT_ID, name: "Nougat", hex: "#cc8e69", material: "solid", core: true },
    ];
    const palette = buildPalette(defs);

    // A mid skin tone close to nougat should pick nougat.
    expect(nearestColorIndex(srgbToOklab(198, 134, 96), palette)).toBe(
      NOUGAT_ID,
    );

    // A range of skin tones must NEVER come out green — the muddy-OKLab guard.
    for (const skin of [
      [241, 194, 156], // light
      [224, 172, 135], // medium-light
      [198, 134, 96], // medium
      [141, 85, 56], // deep
    ] as const) {
      expect(nearestColorIndex(srgbToOklab(...skin), palette)).not.toBe(
        GREEN_ID,
      );
    }
  });

  it("matches an exact palette color to itself", () => {
    const blue = DEFAULT_PALETTE.find((c) => c.name === "Blue")!;
    const target = srgbToOklab(...blue.rgb);
    expect(nearestColorIndex(target, DEFAULT_PALETTE)).toBe(blue.id);
  });

  it("keeps a saturated target colorful instead of collapsing to gray", () => {
    const defs: BrickColorDef[] = [
      { id: 0, name: "Red", hex: "#c91a09", material: "solid", core: true },
      { id: 1, name: "Gray", hex: "#8a8a8a", material: "solid", core: true },
    ];
    const palette = buildPalette(defs);
    // A muted/darkish red whose lightness is close to mid-gray.
    const mutedRed = srgbToOklab(150, 70, 60);
    expect(nearestColorIndex(mutedRed, palette)).toBe(0); // Red, not Gray
  });

  it("penalizes material mismatches", () => {
    // Two near-identical reds: one solid, one transparent. Prefer solid.
    const defs: BrickColorDef[] = [
      { id: 0, name: "Solid Red", hex: "#c4151c", material: "solid", core: true },
      { id: 1, name: "Trans Red", hex: "#c4151c", material: "transparent", core: true },
    ];
    const palette = buildPalette(defs);
    const target = srgbToOklab(0xc4, 0x15, 0x1c);

    // With solid preferred, the solid one wins despite identical color.
    expect(
      nearestColorIndex(target, palette, { preferredMaterial: "solid" }),
    ).toBe(0);
    // Prefer transparent → transparent wins.
    expect(
      nearestColorIndex(target, palette, { preferredMaterial: "transparent" }),
    ).toBe(1);
  });
});

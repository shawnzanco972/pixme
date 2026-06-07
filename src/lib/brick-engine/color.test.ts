import { describe, expect, it } from "vitest";

import {
  hexToRgb,
  oklabToSrgb,
  srgbToOklab,
  oklabDistance,
} from "./color";

describe("sRGB ↔ OKLab", () => {
  it("maps white to L≈1, a≈0, b≈0", () => {
    const w = srgbToOklab(255, 255, 255);
    expect(w.L).toBeCloseTo(1.0, 2);
    expect(w.a).toBeCloseTo(0, 3);
    expect(w.b).toBeCloseTo(0, 3);
  });

  it("maps black to L≈0", () => {
    const k = srgbToOklab(0, 0, 0);
    expect(k.L).toBeCloseTo(0, 4);
  });

  it("matches Ottosson reference for pure red", () => {
    // Reference OKLab for sRGB #ff0000 ≈ (0.6279, 0.2249, 0.1258)
    const r = srgbToOklab(255, 0, 0);
    expect(r.L).toBeCloseTo(0.6279, 2);
    expect(r.a).toBeCloseTo(0.2249, 2);
    expect(r.b).toBeCloseTo(0.1258, 2);
  });

  it("round-trips sRGB → OKLab → sRGB within ±1 LSB", () => {
    for (const rgb of [
      [123, 45, 200],
      [10, 220, 130],
      [240, 200, 150],
    ] as const) {
      const back = oklabToSrgb(srgbToOklab(...rgb));
      expect(Math.abs(back[0] - rgb[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(back[1] - rgb[1])).toBeLessThanOrEqual(1);
      expect(Math.abs(back[2] - rgb[2])).toBeLessThanOrEqual(1);
    }
  });

  it("parses hex correctly", () => {
    expect(hexToRgb("#0055bf")).toEqual([0, 0x55, 0xbf]);
  });

  it("distance is zero for identical colors and positive otherwise", () => {
    const a = srgbToOklab(100, 150, 200);
    expect(oklabDistance(a, a)).toBe(0);
    expect(oklabDistance(a, srgbToOklab(200, 150, 100))).toBeGreaterThan(0);
  });
});

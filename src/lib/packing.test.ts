import { describe, expect, it } from "vitest";

import {
  estimateWeight,
  estimateWeightFromPixelMap,
  GRAMS_PER_STUD,
  PACKAGING_GRAMS,
  formatWeight,
} from "./packing";

describe("estimateWeight", () => {
  it("scales bricks weight with stud count", () => {
    const e = estimateWeight(1000);
    expect(e.bricksGrams).toBeCloseTo(1000 * GRAMS_PER_STUD, 1);
    expect(e.bricksWithSpareGrams).toBeGreaterThan(e.bricksGrams);
    expect(e.totalGrams).toBeCloseTo(
      e.bricksWithSpareGrams + PACKAGING_GRAMS,
      1,
    );
  });

  it("scale target excludes packaging (what the packer weighs)", () => {
    const e = estimateWeight(2304); // 48×48
    expect(e.scaleTargetGrams).toBe(e.bricksWithSpareGrams);
    expect(e.scaleTargetGrams).toBeLessThan(e.totalGrams);
  });

  it("counts studs from a pixel_map", () => {
    const map = [
      [0, 1, 2],
      [3, 4, 5],
    ];
    expect(estimateWeightFromPixelMap(map).studs).toBe(6);
  });
});

describe("formatWeight", () => {
  it("uses grams under 1kg and kg at/over 1kg", () => {
    expect(formatWeight(250)).toContain("גרם");
    expect(formatWeight(1500)).toContain('ק"ג');
  });
});

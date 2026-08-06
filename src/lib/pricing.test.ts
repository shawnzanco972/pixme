import { describe, expect, it } from "vitest";

import {
  computeB2bPrice,
  computePrice,
  formatILS,
  presetStuds,
  SIZE_PRESETS,
} from "./pricing";

describe("computePrice", () => {
  it("digital price scales with area and has no physical surcharge", () => {
    const p = computePrice(32, 32, "digital");
    expect(p.studs).toBe(1024);
    expect(p.physicalSurcharge).toBe(0);
    expect(p.total).toBe(p.base);
    expect(p.total).toBeGreaterThan(0);
  });

  it("physical costs strictly more than digital for every preset", () => {
    for (const preset of SIZE_PRESETS) {
      const { cols, rows } = presetStuds(preset);
      const d = computePrice(cols, rows, "digital");
      const ph = computePrice(cols, rows, "physical");
      expect(ph.total).toBeGreaterThan(d.total);
      expect(ph.physicalSurcharge).toBeGreaterThan(0);
    }
  });

  it("larger sizes cost more", () => {
    expect(computePrice(64, 64, "digital").total).toBeGreaterThan(
      computePrice(32, 32, "digital").total,
    );
  });

  it("rectangular grids price by total studs", () => {
    // 2×3 plates (48×72) equals 3×2 plates (72×48) in total studs.
    expect(computePrice(48, 72, "physical").total).toBe(
      computePrice(72, 48, "physical").total,
    );
  });

  it("formats ILS with the shekel sign", () => {
    expect(formatILS(120)).toContain("₪");
  });
});

describe("computeB2bPrice", () => {
  it("totals licenses × per-license price", () => {
    const p = computeB2bPrice(10);
    expect(p.total).toBe(p.licenses * p.perLicense);
  });

  it("applies volume discounts at higher tiers", () => {
    expect(computeB2bPrice(100).perLicense).toBeLessThan(
      computeB2bPrice(5).perLicense,
    );
  });

  it("floors fractional license counts", () => {
    expect(computeB2bPrice(9.7).licenses).toBe(9);
  });
});

describe("headline price points", () => {
  it("prices the hero 3×3 at ₪399 (deliberate override, not the linear model)", () => {
    expect(computePrice(72, 72, "physical").total).toBe(399);
  });

  it("leaves every other size on the linear model", () => {
    expect(computePrice(48, 48, "physical").total).toBe(290); // 2×2
    expect(computePrice(72, 48, "physical").total).toBe(355); // 3×2
    expect(computePrice(96, 96, "physical").total).toBe(675); // 4×4
    expect(computePrice(120, 120, "physical").total).toBe(960); // 5×5
  });

  it("keeps prices monotonic in area", () => {
    const at = (n: number) => computePrice(n, n, "physical").total;
    expect(at(48)).toBeLessThan(at(72));
    expect(at(72)).toBeLessThan(at(96));
    expect(at(96)).toBeLessThan(at(120));
  });

  it("does not override a non-plate-aligned grid of the same area", () => {
    expect(computePrice(5184, 1, "physical").total).not.toBe(399);
  });
});

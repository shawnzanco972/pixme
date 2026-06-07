import { describe, expect, it } from "vitest";

import { computePrice, formatILS, SIZES } from "./pricing";

describe("computePrice", () => {
  it("digital price scales with area and has no physical surcharge", () => {
    const p = computePrice(32, "digital");
    expect(p.studs).toBe(1024);
    expect(p.physicalSurcharge).toBe(0);
    expect(p.total).toBe(p.base);
    expect(p.total).toBeGreaterThan(0);
  });

  it("physical costs strictly more than digital for the same size", () => {
    for (const s of SIZES) {
      const d = computePrice(s, "digital");
      const ph = computePrice(s, "physical");
      expect(ph.total).toBeGreaterThan(d.total);
      expect(ph.physicalSurcharge).toBeGreaterThan(0);
    }
  });

  it("larger sizes cost more", () => {
    expect(computePrice(64, "digital").total).toBeGreaterThan(
      computePrice(32, "digital").total,
    );
  });

  it("formats ILS with the shekel sign", () => {
    expect(formatILS(120)).toContain("₪");
  });
});

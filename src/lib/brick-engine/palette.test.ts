import { describe, expect, it } from "vitest";

import {
  CATALOG,
  DEFAULT_PALETTE,
  RECOMMENDED_IDS,
  getActivePalette,
  remapPixelMap,
} from "./palette";

describe("catalog", () => {
  it("has unique ids and hex values", () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    const hexes = new Set(CATALOG.map((c) => c.hex.toLowerCase()));
    expect(ids.size).toBe(CATALOG.length);
    expect(hexes.size).toBe(CATALOG.length); // no duplicate colors
  });

  it("recommended starter set is a subset of the catalog (>= 20 colors)", () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    for (const id of RECOMMENDED_IDS) expect(ids.has(id)).toBe(true);
    expect(RECOMMENDED_IDS.size).toBeGreaterThanOrEqual(20);
  });
});

describe("getActivePalette", () => {
  it("filters the catalog to enabled ids, preserving order", () => {
    const active = getActivePalette([3, 0, 23]);
    expect(active.map((c) => c.id)).toEqual([0, 3, 23]); // catalog order
  });
});

describe("remapPixelMap", () => {
  it("leaves in-palette indexes untouched", () => {
    const target = getActivePalette([0, 3, 23]);
    const map = [
      [0, 3],
      [23, 0],
    ];
    expect(remapPixelMap(map, target)).toEqual(map);
  });

  it("remaps out-of-stock colors to the nearest available color", () => {
    // Enable White(0), Black(3) only. A blue cell (23) must map to one of them.
    const target = getActivePalette([0, 3]);
    const blue = DEFAULT_PALETTE.find((c) => c.name === "Blue")!;
    const out = remapPixelMap([[blue.id]], target);
    expect([0, 3]).toContain(out[0][0]);
    expect(out[0][0]).toBe(3); // blue is nearer black than white
  });
});

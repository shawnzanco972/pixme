import { describe, expect, it } from "vitest";

import {
  CATALOG,
  CORE_IDS,
  DEFAULT_PALETTE,
  getActivePalette,
  remapPixelMap,
} from "./palette";

describe("catalog", () => {
  it("defines exactly 24 colors with unique ids and hex values", () => {
    expect(CATALOG.length).toBe(24);
    const ids = new Set(CATALOG.map((c) => c.id));
    const hexes = new Set(CATALOG.map((c) => c.hex.toLowerCase()));
    expect(ids.size).toBe(24);
    expect(hexes.size).toBe(24); // no duplicate colors
  });

  it("marks exactly 17 core colors (launch order) in stock by default", () => {
    expect(CORE_IDS.size).toBe(17);
    expect(CATALOG.filter((c) => c.core)).toHaveLength(17);
    expect(CATALOG.filter((c) => !c.core)).toHaveLength(7); // boosters
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

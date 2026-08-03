import { describe, expect, it } from "vitest";

import {
  CATALOG,
  CORE_SLUGS,
  DEFAULT_PALETTE,
  LEGACY_ID_TO_SLUG,
  decodePixelMap,
  encodePixelMap,
  getActivePalette,
  idForSlug,
  remapPixelMap,
  slugForId,
} from "./palette";

describe("catalog", () => {
  it("defines 31 colors with unique id/colorId/displayCode/hex", () => {
    expect(CATALOG.length).toBe(31);
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(31);
    expect(new Set(CATALOG.map((c) => c.colorId)).size).toBe(31);
    expect(new Set(CATALOG.map((c) => c.displayCode)).size).toBe(31);
    expect(new Set(CATALOG.map((c) => c.hex.toLowerCase())).size).toBe(31);
  });

  it("keeps colorId slugs kebab-case and displayCode ≤3 chars", () => {
    for (const c of CATALOG) {
      expect(c.colorId).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(c.displayCode.length).toBeLessThanOrEqual(3);
      expect(["base", "skin", "accent"]).toContain(c.role);
    }
  });

  it("has finite, distinct OKLab values", () => {
    const seen = new Set<string>();
    for (const c of CATALOG) {
      expect(Number.isFinite(c.oklab.L)).toBe(true);
      expect(Number.isFinite(c.oklab.a)).toBe(true);
      expect(Number.isFinite(c.oklab.b)).toBe(true);
      const key = `${c.oklab.L.toFixed(4)},${c.oklab.a.toFixed(4)},${c.oklab.b.toFixed(4)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("marks 19 core colors (launch order) in stock by default", () => {
    expect(CORE_SLUGS.size).toBe(19);
    expect(CATALOG.filter((c) => c.core)).toHaveLength(19);
    expect(CATALOG.filter((c) => !c.core)).toHaveLength(12); // boosters
  });
});

describe("identity <-> index", () => {
  it("slugForId and idForSlug are inverses across the catalog", () => {
    for (const c of CATALOG) {
      expect(slugForId(c.id)).toBe(c.colorId);
      expect(idForSlug(c.colorId)).toBe(c.id);
    }
  });

  it("encode/decode round-trips a pixel_map to slug space and back", () => {
    const map = [
      [0, 3, 30],
      [14, 7, 25],
    ];
    const encoded = encodePixelMap(map);
    expect(typeof encoded[0][0]).toBe("string");
    expect(encoded[0][2]).toBe("dark-purple");
    expect(decodePixelMap(encoded)).toEqual(map);
  });

  it("every legacy numeric id maps to a real catalog slug", () => {
    for (const slug of Object.values(LEGACY_ID_TO_SLUG)) {
      expect(CATALOG.some((c) => c.colorId === slug)).toBe(true);
    }
  });
});

describe("getActivePalette", () => {
  it("filters the catalog to enabled slugs, preserving order", () => {
    const active = getActivePalette(["black", "white", "sand"]);
    expect(active.map((c) => c.colorId)).toEqual(["white", "black", "sand"]);
  });

  it("also accepts numeric engine ids", () => {
    const active = getActivePalette([3, 0, 23]);
    expect(active.map((c) => c.colorId)).toEqual(["white", "black", "sand"]);
  });
});

describe("remapPixelMap", () => {
  it("leaves in-palette indexes untouched", () => {
    const target = getActivePalette(["white", "black", "sand"]);
    const map = [
      [idForSlug("white"), idForSlug("black")],
      [idForSlug("sand"), idForSlug("white")],
    ];
    expect(remapPixelMap(map, target)).toEqual(map);
  });

  it("remaps out-of-stock colors to the nearest available color", () => {
    // Enable White, Black only. A blue cell must map to one of them.
    const target = getActivePalette(["white", "black"]);
    const blue = DEFAULT_PALETTE.find((c) => c.name === "Blue")!;
    const out = remapPixelMap([[blue.id]], target);
    expect(out[0][0]).toBe(idForSlug("black")); // blue is nearer black
  });
});

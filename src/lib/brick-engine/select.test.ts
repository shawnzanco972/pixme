import { describe, expect, it } from "vitest";

import { oklabDistance, srgbToOklab, type OKLab } from "./color";
import { brickifyImage } from "./index";
import { CATALOG, getActivePalette, slugForId } from "./palette";
import { selectAdaptivePalette } from "./select";
import type { RGBAImage } from "./quantize";

const FULL = getActivePalette(CATALOG.map((c) => c.colorId));

/** A portrait-ish image: skin field, darker hair band, light background. */
function portrait(w: number, h: number): RGBAImage {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x / w - 0.5, cy = y / h - 0.5;
      const r2 = cx * cx + cy * cy;
      let rgb: [number, number, number];
      if (r2 > 0.16) rgb = [235, 238, 240];            // background
      else if (cy < -0.18) rgb = [70, 48, 34];          // hair
      else {
        const t = (cy + 0.18) / 0.5;                    // skin shading
        rgb = [235 - t * 70, 190 - t * 70, 165 - t * 70];
      }
      const i = (y * w + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
  }
  return { data: d, width: w, height: h };
}

/** Mean nearest-colour OKLab error of a palette over a set of targets. */
function meanError(targets: OKLab[], palette: typeof FULL): number {
  let s = 0;
  for (const t of targets) {
    let best = Infinity;
    for (const c of palette) {
      const d = oklabDistance(t, c.oklab);
      if (d < best) best = d;
    }
    s += best;
  }
  return s / targets.length;
}

const TARGETS: OKLab[] = [];
{
  const img = portrait(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    TARGETS.push(srgbToOklab(img.data[i], img.data[i + 1], img.data[i + 2]));
  }
}

describe("selectAdaptivePalette", () => {
  it("returns the whole catalogue when count covers it", () => {
    expect(selectAdaptivePalette(TARGETS, FULL, FULL.length).length).toBe(FULL.length);
    expect(selectAdaptivePalette(TARGETS, FULL, 999).length).toBe(FULL.length);
  });

  it("returns exactly `count` colours", () => {
    for (const n of [4, 8, 16, 24]) {
      expect(selectAdaptivePalette(TARGETS, FULL, n).length).toBe(n);
    }
  });

  it("is deterministic — same input, same colours every time", () => {
    const a = selectAdaptivePalette(TARGETS, FULL, 12).map((c) => c.colorId);
    const b = selectAdaptivePalette(TARGETS, FULL, 12).map((c) => c.colorId);
    expect(a).toEqual(b);
  });

  it("returns colours in catalogue order (stable pixel_map semantics)", () => {
    // Catalogue order is grouped by family (N/K/A) and is NOT ascending id —
    // ids stayed fixed when the palette was regrouped. So assert the result is
    // a SUBSEQUENCE of the catalogue, which is the property that matters.
    const picked = selectAdaptivePalette(TARGETS, FULL, 10).map((c) => c.id);
    const order = FULL.map((c) => c.id);
    let at = -1;
    for (const id of picked) {
      const next = order.indexOf(id);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
  });

  it("beats an arbitrary subset of the same size", () => {
    const n = 12;
    const adaptive = selectAdaptivePalette(TARGETS, FULL, n);
    const arbitrary = FULL.slice(0, n); // first N of the catalogue
    expect(meanError(TARGETS, adaptive)).toBeLessThan(meanError(TARGETS, arbitrary));
  });

  it("error decreases monotonically as more colours are allowed", () => {
    const errs = [4, 8, 16, 24].map((n) =>
      meanError(TARGETS, selectAdaptivePalette(TARGETS, FULL, n)),
    );
    for (let i = 1; i < errs.length; i++) {
      expect(errs[i]).toBeLessThanOrEqual(errs[i - 1]);
    }
  });

  it("spends its budget on the colours the image actually needs", () => {
    // A portrait must get skin bricks, not the blues/greens it never uses.
    const picked = selectAdaptivePalette(TARGETS, FULL, 10);
    const roles = picked.map((c) => c.role);
    expect(roles.filter((r) => r === "skin").length).toBeGreaterThanOrEqual(3);
  });
});

describe("brickifyImage with adaptive palette", () => {
  const img = portrait(96, 96);

  it("limits the mosaic to the requested number of colours", () => {
    const { pixelMap, palette } = brickifyImage(img, {
      cols: 48, rows: 48, palette: FULL, adaptive: { count: 10 },
    });
    expect(palette.length).toBe(10);
    const used = new Set(pixelMap.flat());
    expect(used.size).toBeLessThanOrEqual(10);
  });

  it("reports the full palette when adaptive is off", () => {
    const { palette } = brickifyImage(img, { cols: 48, rows: 48, palette: FULL });
    expect(palette.length).toBe(FULL.length);
  });

  it("stays deterministic end-to-end", () => {
    const opts = { cols: 48, rows: 48, palette: FULL, adaptive: { count: 14 } };
    const a = brickifyImage(img, opts);
    const b = brickifyImage(img, opts);
    expect(a.pixelMap).toEqual(b.pixelMap);
    expect(a.palette.map((c) => c.colorId)).toEqual(b.palette.map((c) => c.colorId));
  });

  it("still keeps skin off saturated accents at a reduced count", () => {
    const { pixelMap } = brickifyImage(img, {
      cols: 48, rows: 48, palette: FULL, adaptive: { count: 12 },
    });
    const slugs = new Set(pixelMap.flat().map(slugForId));
    for (const bad of ["red", "dark-red", "bright-green", "blue"]) {
      expect(slugs.has(bad), `used ${bad}`).toBe(false);
    }
  });
});

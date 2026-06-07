import { describe, expect, it } from "vitest";

import { brickifyImage } from "@/lib/brick-engine";
import { DEFAULT_PALETTE } from "@/lib/brick-engine/palette";
import { buildInventory } from "./inventory";
import { buildInstructionsPdf } from "./instructions";
import { buildPackingListPdf } from "./packing";

describe("buildInventory", () => {
  it("counts parts and totals correctly, sorted by count desc", () => {
    // 2 of color 1, 1 of color 4, 1 of color 7.
    const map = [
      [1, 1],
      [4, 7],
    ];
    const inv = buildInventory(map);
    expect(inv.totalStuds).toBe(4);
    expect(inv.distinctColors).toBe(3);
    expect(inv.lines[0].count).toBe(2); // most-used first
    expect(inv.lines.reduce((s, l) => s + l.count, 0)).toBe(4);
  });

  it("matches a manual tally for a brickified solid image", () => {
    const blue = DEFAULT_PALETTE.find((c) => c.name === "Blue")!;
    const data = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 8 * 8; i++) {
      data[i * 4] = blue.rgb[0];
      data[i * 4 + 1] = blue.rgb[1];
      data[i * 4 + 2] = blue.rgb[2];
      data[i * 4 + 3] = 255;
    }
    const { pixelMap } = brickifyImage({ data, width: 8, height: 8 }, {
      cols: 16,
      rows: 16,
    });
    const inv = buildInventory(pixelMap);
    expect(inv.totalStuds).toBe(256);
    expect(inv.lines).toHaveLength(1);
    expect(inv.lines[0].id).toBe(blue.id);
    expect(inv.lines[0].count).toBe(256);
  });
});

describe("buildInstructionsPdf", () => {
  it("produces a valid, non-trivial PDF buffer", () => {
    // 32×32 map → 4 modules of 16×16 + cover + inventory.
    const map: number[][] = [];
    for (let y = 0; y < 32; y++) {
      const row: number[] = [];
      for (let x = 0; x < 32; x++) row.push((x + y) % DEFAULT_PALETTE.length);
      map.push(row);
    }
    const buf = buildInstructionsPdf(map, { moduleSize: 16 });
    expect(buf.byteLength).toBeGreaterThan(1000);

    // PDF magic header "%PDF"
    const head = new Uint8Array(buf.slice(0, 4));
    expect(Array.from(head)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});

describe("buildPackingListPdf", () => {
  it("produces a valid PDF for an order pixel_map", () => {
    const map = [
      [0, 0, 11, 11],
      [3, 3, 17, 17],
    ];
    const buf = buildPackingListPdf(map, {
      orderId: "abc",
      customerName: "Test",
    });
    expect(buf.byteLength).toBeGreaterThan(800);
    const head = new Uint8Array(buf.slice(0, 4));
    expect(Array.from(head)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});

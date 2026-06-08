import { describe, expect, it } from "vitest";

import { GRAMS_PER_STUD, packCount } from "@/lib/packing";
import { aggregateRestock, orderPackingList } from "./restock";

describe("aggregateRestock", () => {
  it("sums per-color pieces across multiple orders", () => {
    const orderA = [
      [0, 0],
      [3, 3],
    ]; // 2×White(0), 2×Black(3)
    const orderB = [[0, 3]]; // 1×White, 1×Black
    const report = aggregateRestock([orderA, orderB]);

    expect(report.orderCount).toBe(2);
    expect(report.totalPieces).toBe(6);
    const white = report.lines.find((l) => l.id === 0)!;
    expect(white.pieces).toBe(3);
    expect(white.piecesWithSpare).toBe(packCount(3));
    expect(white.grams).toBeCloseTo(
      Math.round(white.piecesWithSpare * GRAMS_PER_STUD * 10) / 10,
      5,
    );
  });

  it("sorts by descending piece count and flags recommended colors", () => {
    const map = [
      [0, 0, 0],
      [3, 3, 28], // White×3, Black×2, Magenta×1
    ];
    const report = aggregateRestock([map]);
    expect(report.lines[0].id).toBe(0); // most-used first
    expect(report.lines.every((l) => typeof l.core === "boolean")).toBe(true);
  });

  it("orderPackingList gives per-color pieces + spare + grams for one order", () => {
    const map = [
      [0, 0, 0, 0],
      [3, 3, 3, 3],
    ]; // 4×White(0), 4×Black(3)
    const list = orderPackingList(map);
    expect(list.orderCount).toBe(1);
    expect(list.totalPieces).toBe(8);
    const white = list.lines.find((l) => l.id === 0)!;
    expect(white.pieces).toBe(4);
    expect(white.piecesWithSpare).toBe(packCount(4));
    expect(white.grams).toBeGreaterThan(white.pieces * GRAMS_PER_STUD * 0.9);
  });

  it("handles an empty pending set", () => {
    const report = aggregateRestock([]);
    expect(report.lines).toHaveLength(0);
    expect(report.totalPieces).toBe(0);
    expect(report.totalGrams).toBe(0);
  });
});

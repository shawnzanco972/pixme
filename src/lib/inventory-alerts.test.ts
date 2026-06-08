import { describe, expect, it } from "vitest";

import { inventoryAlerts, type InventoryItem } from "./inventory-alerts";

const color = (over: Partial<InventoryItem> = {}): InventoryItem => ({
  id: "1",
  name: "Red",
  category: "color",
  unit: "g",
  onHand: 1000,
  threshold: 0,
  ...over,
});

describe("inventoryAlerts", () => {
  it("ignores items with no threshold set", () => {
    expect(inventoryAlerts([color({ onHand: 0, threshold: 0 })])).toEqual([]);
  });

  it("flags a hard-floor breach (no demand)", () => {
    const [a] = inventoryAlerts([
      color({ onHand: 50, threshold: 200 }),
    ]);
    expect(a.shortfall).toBe(150);
    expect(a.available).toBe(50);
  });

  it("does not flag when comfortably above threshold", () => {
    expect(inventoryAlerts([color({ onHand: 500, threshold: 200 })])).toEqual(
      [],
    );
  });

  it("is demand-aware: incoming orders can push an item below threshold", () => {
    // 300 on hand, 250 committed → only 50 free, below the 200 floor.
    const [a] = inventoryAlerts([
      color({ onHand: 300, committedDemand: 250, threshold: 200 }),
    ]);
    expect(a.available).toBe(50);
    expect(a.shortfall).toBe(150);
  });

  it("sorts most-short first across categories", () => {
    const alerts = inventoryAlerts([
      color({ id: "1", onHand: 180, threshold: 200 }), // short 20
      {
        id: "box",
        name: "Gift box",
        category: "packaging",
        unit: "pcs",
        onHand: 0,
        threshold: 100,
      }, // short 100
    ]);
    expect(alerts.map((a) => a.id)).toEqual(["box", "1"]);
  });
});

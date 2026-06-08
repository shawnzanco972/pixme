/**
 * Low-stock engine — the single deterministic source the Overview alerts panel,
 * the Inventory badges, and (later) the email digest all share.
 *
 * Two signals per item (see ADMIN_DASHBOARD_PLAN §7):
 *   1. Hard floor       — onHand < threshold.
 *   2. Demand-aware     — onHand − committedDemand < threshold, where
 *      committedDemand is what incoming PAID-but-unfulfilled orders will drink.
 *
 * Pure + side-effect-free so it runs on the server and in unit tests.
 */

export type AlertCategory =
  | "color"
  | "baseplate"
  | "connector"
  | "packaging"
  | "other";

/** One inventory item's stock picture, category-agnostic. */
export interface InventoryItem {
  /** Stable id (color id as string, or supply uuid). */
  id: string;
  name: string;
  category: AlertCategory;
  /** Display unit: "g" for colors, "pcs"/"m"/… for supplies. */
  unit: string;
  /** Physically on hand now. */
  onHand: number;
  /** Outflow already committed by paid, unfulfilled orders. Default 0. */
  committedDemand?: number;
  /** Low-stock floor. Zero means "no threshold set" → never alerts. */
  threshold: number;
}

export interface InventoryAlert {
  id: string;
  name: string;
  category: AlertCategory;
  unit: string;
  onHand: number;
  committedDemand: number;
  threshold: number;
  /** onHand − committedDemand. What's effectively free to use. */
  available: number;
  /** How far below the threshold we are (always > 0 for an alert). */
  shortfall: number;
}

/**
 * Compute the low-stock alerts across colors + supplies.
 *
 * An item alerts when its demand-aware availability (onHand − committedDemand)
 * drops below its threshold. Items with threshold ≤ 0 are never flagged (the
 * operator hasn't opted them in). Sorted most-short first.
 */
export function inventoryAlerts(items: InventoryItem[]): InventoryAlert[] {
  const alerts: InventoryAlert[] = [];
  for (const item of items) {
    if (!(item.threshold > 0)) continue;
    const committedDemand = item.committedDemand ?? 0;
    const available = item.onHand - committedDemand;
    const shortfall = Math.round((item.threshold - available) * 100) / 100;
    if (shortfall > 0) {
      alerts.push({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        onHand: item.onHand,
        committedDemand,
        threshold: item.threshold,
        available: Math.round(available * 100) / 100,
        shortfall,
      });
    }
  }
  return alerts.sort((a, b) => b.shortfall - a.shortfall);
}

/**
 * Server-side inventory assembly — reads colors (brick_stock) + supplies
 * (inventory_supplies) + committed demand, and feeds the pure `inventoryAlerts`
 * engine. Shared by the Overview alerts panel and the Inventory tab so they
 * always agree.
 */
import "server-only";

import { CATALOG } from "@/lib/brick-engine/palette";
import {
  inventoryAlerts,
  type AlertCategory,
  type InventoryAlert,
  type InventoryItem,
} from "@/lib/inventory-alerts";
import { aggregateRestock } from "@/lib/restock";
import type { SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { InventorySupply, PixelMap } from "@/lib/supabase/types.helpers";

// Either the cookie-bound (RLS) client or the service-role admin client — both
// are SupabaseClient<Database>, so the cron route can reuse this.
type SupabaseClient = SupabaseJsClient<Database>;

export interface ColorStockRow {
  id: number;
  name: string;
  hex: string;
  onHandGrams: number;
  reorderPointGrams: number;
  committedGrams: number;
}

export interface InventoryData {
  items: InventoryItem[];
  alerts: InventoryAlert[];
  colors: ColorStockRow[];
  supplies: InventorySupply[];
}

/**
 * Load the full inventory picture. Committed demand = grams needed by PAID,
 * unfulfilled physical orders (the orders that will actually drink the stock).
 */
export async function loadInventory(
  supabase: SupabaseClient,
): Promise<InventoryData> {
  const [{ data: stockRows }, { data: demandRows }, { data: supplyRows }] =
    await Promise.all([
      supabase
        .from("brick_stock")
        .select("id, on_hand_grams, reorder_point_grams"),
      supabase
        .from("b2c_orders")
        .select("pixel_map")
        .eq("fulfillment_type", "physical")
        .eq("status", "paid"),
      supabase
        .from("inventory_supplies")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  const stockById = new Map(
    (stockRows ?? []).map((r) => [
      r.id,
      {
        onHand: Number(r.on_hand_grams),
        threshold: Number(r.reorder_point_grams),
      },
    ]),
  );

  const restock = aggregateRestock(
    (demandRows ?? [])
      .map((r) => r.pixel_map as PixelMap | null)
      .filter((m): m is PixelMap => Array.isArray(m)),
  );
  const demandById = new Map(restock.lines.map((l) => [l.id, l.grams]));

  const colors: ColorStockRow[] = CATALOG.map((c) => {
    const s = stockById.get(c.id);
    return {
      id: c.id,
      name: c.name,
      hex: c.hex,
      onHandGrams: s?.onHand ?? 0,
      reorderPointGrams: s?.threshold ?? 0,
      committedGrams: demandById.get(c.id) ?? 0,
    };
  });

  const supplies = supplyRows ?? [];

  const items: InventoryItem[] = [
    ...colors.map((c) => ({
      id: `color:${c.id}`,
      name: c.name,
      category: "color" as AlertCategory,
      unit: "g",
      onHand: c.onHandGrams,
      committedDemand: c.committedGrams,
      threshold: c.reorderPointGrams,
    })),
    ...supplies.map((s) => ({
      id: `supply:${s.id}`,
      name: s.name,
      category: s.category as AlertCategory,
      unit: s.unit,
      onHand: Number(s.on_hand),
      threshold: Number(s.reorder_point),
    })),
  ];

  return { items, alerts: inventoryAlerts(items), colors, supplies };
}

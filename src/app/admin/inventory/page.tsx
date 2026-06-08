/**
 * Inventory tab — /admin/inventory. Three sections:
 *  - Colors / 1×1 plates (StockManager: availability + on-hand + threshold)
 *  - Supplies (SuppliesManager: baseplates / connectors / packaging by count)
 *  - Restock report: what to order for pending physical orders (CSV export)
 */
import { redirect } from "next/navigation";

import { ExportRestockCsv } from "@/components/admin/ExportRestockCsv";
import { StockManager } from "@/components/admin/StockManager";
import { SuppliesManager } from "@/components/admin/SuppliesManager";
import { formatWeight } from "@/lib/packing";
import { aggregateRestock } from "@/lib/restock";
import { createClient } from "@/lib/supabase/server";
import type { PixelMap } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

export default async function AdminInventory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: restockRows }, { data: b2bRows }, { data: stockRows }] =
    await Promise.all([
      supabase
        .from("b2c_orders")
        .select("pixel_map")
        .eq("fulfillment_type", "physical")
        .in("status", ["pending", "paid"]),
      // B2B kits the owner has approved ("ready") are committed production too.
      supabase
        .from("employee_submissions")
        .select("pixel_map")
        .eq("status", "ready"),
      supabase.from("brick_stock").select("id, on_hand_grams"),
    ]);

  const restock = aggregateRestock(
    [...(restockRows ?? []), ...(b2bRows ?? [])]
      .map((r) => r.pixel_map as PixelMap | null)
      .filter((m): m is PixelMap => Array.isArray(m)),
  );

  const onHand = new Map<number, number>(
    (stockRows ?? []).map((r) => [r.id, Number(r.on_hand_grams)]),
  );
  const reorder = restock.lines.map((l) => {
    const onHandGrams = onHand.get(l.id) ?? 0;
    return {
      ...l,
      onHandGrams,
      toOrderGrams: Math.max(0, Math.round((l.grams - onHandGrams) * 10) / 10),
    };
  });
  const totalToOrder =
    Math.round(reorder.reduce((s, l) => s + l.toOrderGrams, 0) * 10) / 10;

  return (
    <main className="flex w-full flex-1 flex-col gap-8 p-6">
      <h1 className="font-heading text-2xl font-bold">מלאי</h1>

      <StockManager />

      <SuppliesManager />

      {/* Restock intelligence */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">
            רכש מלאי — הזמנות פיזיות + מתנות עסקיות מאושרות ({restock.orderCount})
          </h2>
          <ExportRestockCsv rows={reorder} />
        </div>
        {reorder.length === 0 ? (
          <p className="text-sm text-zinc-400">אין הזמנות פיזיות לרכש כרגע.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-zinc-600">
                <tr>
                  <th className="p-3 text-start">צבע</th>
                  <th className="p-3 text-start">נדרש (כולל רזרבה)</th>
                  <th className="p-3 text-start">במלאי</th>
                  <th className="p-3 text-start">להזמין</th>
                </tr>
              </thead>
              <tbody>
                {reorder.map((l) => (
                  <tr key={l.id} className="border-t border-outline">
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded border border-black/20"
                          style={{ backgroundColor: l.hex }}
                        />
                        {l.name}
                        {l.core ? (
                          <span className="text-xs text-zinc-400">★</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="p-3">{formatWeight(l.grams)}</td>
                    <td className="p-3 text-zinc-500">
                      {formatWeight(l.onHandGrams)}
                    </td>
                    <td
                      className={`p-3 font-medium ${
                        l.toOrderGrams > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {l.toOrderGrams > 0 ? formatWeight(l.toOrderGrams) : "✓"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-outline font-semibold">
                  <td className="p-3">סה״כ ({reorder.length} צבעים)</td>
                  <td className="p-3">{formatWeight(restock.totalGrams)}</td>
                  <td className="p-3" />
                  <td className="p-3">{formatWeight(totalToOrder)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          ★ = צבע ליבה. &quot;נדרש&quot; כולל רזרבה. &quot;להזמין&quot; = נדרש
          פחות מלאי קיים.
        </p>
      </section>
    </main>
  );
}

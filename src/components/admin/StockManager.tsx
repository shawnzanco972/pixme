"use client";
/**
 * Admin inventory manager (24-color catalog) — availability + on-hand weight.
 *
 * Effective in-stock = DB override (brick_stock.in_stock) if a row exists, else
 * the color's `core` default. on_hand_grams is what's physically in stock (by
 * weight); the restock report compares it to demand.
 */
import { useEffect, useState } from "react";

import { CATALOG, isCore } from "@/lib/brick-engine/palette";
import { formatWeight } from "@/lib/packing";
import { createClient } from "@/lib/supabase/client";

interface Row {
  in_stock: boolean;
  on_hand_grams: number;
  reorder_point_grams: number;
}

export function StockManager() {
  const [rows, setRows] = useState<Map<number, Row>>(new Map());
  const [drafts, setDrafts] = useState<Map<number, string>>(new Map());
  const [thresholdDrafts, setThresholdDrafts] = useState<Map<number, string>>(
    new Map(),
  );
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("brick_stock")
        .select("id, in_stock, on_hand_grams, reorder_point_grams");
      if (!cancelled) {
        setRows(
          new Map(
            (data ?? []).map((r) => [
              r.id,
              {
                in_stock: r.in_stock,
                on_hand_grams: Number(r.on_hand_grams),
                reorder_point_grams: Number(r.reorder_point_grams),
              },
            ]),
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inStockOf = (id: number) => rows.get(id)?.in_stock ?? isCore(id);
  const onHandOf = (id: number) => rows.get(id)?.on_hand_grams ?? 0;
  const thresholdOf = (id: number) => rows.get(id)?.reorder_point_grams ?? 0;

  async function save(id: number, patch: Partial<Row>) {
    setSavingId(id);
    const next: Row = {
      in_stock: patch.in_stock ?? inStockOf(id),
      on_hand_grams: patch.on_hand_grams ?? onHandOf(id),
      reorder_point_grams: patch.reorder_point_grams ?? thresholdOf(id),
    };
    const sb = createClient();
    const { error } = await sb
      .from("brick_stock")
      .upsert({ id, ...next }, { onConflict: "id" });
    setSavingId(null);
    if (!error) setRows((prev) => new Map(prev).set(id, next));
  }

  const inStockCount = CATALOG.filter((c) => inStockOf(c.id)).length;
  const totalGrams = CATALOG.reduce((s, c) => s + onHandOf(c.id), 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">
        מלאי צבעים ({inStockCount}/{CATALOG.length} זמינים ·{" "}
        {formatWeight(totalGrams)} במלאי)
      </h2>
      <div className="overflow-x-auto rounded-xl border border-outline">
        <table className="w-full text-start text-sm">
          <thead className="bg-surface-muted text-zinc-600">
            <tr>
              <th className="p-2 text-start">צבע</th>
              <th className="p-2 text-start">סוג</th>
              <th className="p-2 text-start">זמין</th>
              <th className="p-2 text-start">במלאי (גרם)</th>
              <th className="p-2 text-start">סף התראה (גרם)</th>
            </tr>
          </thead>
          <tbody>
            {CATALOG.map((c) => {
              const draft = drafts.get(c.id);
              const value = draft ?? String(onHandOf(c.id));
              const tDraft = thresholdDrafts.get(c.id);
              const tValue = tDraft ?? String(thresholdOf(c.id));
              const below =
                thresholdOf(c.id) > 0 && onHandOf(c.id) < thresholdOf(c.id);
              return (
                <tr
                  key={c.id}
                  className={`border-t border-outline ${
                    below ? "bg-red-50" : ""
                  }`}
                >
                  <td className="p-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded border border-black/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-zinc-500">
                    {isCore(c.id) ? "ליבה" : "בוסט"}
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      disabled={savingId === c.id}
                      onClick={() => save(c.id, { in_stock: !inStockOf(c.id) })}
                      className={`rounded-full px-3 py-1 text-xs ${
                        inStockOf(c.id)
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      }`}
                    >
                      {inStockOf(c.id) ? "זמין" : "אזל"}
                    </button>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      className="w-24 rounded border border-outline px-2 py-1 bg-surface"
                      value={value}
                      onChange={(e) =>
                        setDrafts((d) =>
                          new Map(d).set(c.id, e.target.value),
                        )
                      }
                      onBlur={() => {
                        if (draft === undefined) return;
                        const n = Number(draft);
                        setDrafts((d) => {
                          const nd = new Map(d);
                          nd.delete(c.id);
                          return nd;
                        });
                        if (!Number.isNaN(n) && n !== onHandOf(c.id)) {
                          void save(c.id, { on_hand_grams: n });
                        }
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      className="w-24 rounded border border-outline px-2 py-1 bg-surface"
                      value={tValue}
                      onChange={(e) =>
                        setThresholdDrafts((d) =>
                          new Map(d).set(c.id, e.target.value),
                        )
                      }
                      onBlur={() => {
                        if (tDraft === undefined) return;
                        const n = Number(tDraft);
                        setThresholdDrafts((d) => {
                          const nd = new Map(d);
                          nd.delete(c.id);
                          return nd;
                        });
                        if (!Number.isNaN(n) && n !== thresholdOf(c.id)) {
                          void save(c.id, { reorder_point_grams: n });
                        }
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        17 צבעי ליבה זמינים כברירת מחדל. עדכנו משקל במלאי כדי לראות חוסרים בדוח
        הרכש. הגדירו &quot;סף התראה&quot; כדי לקבל התראת מלאי נמוך (שורה אדומה)
        בלשונית הסקירה.
      </p>
    </section>
  );
}

"use client";
/**
 * Supplies inventory manager — baseplates, connectors, packaging, and other
 * physical supplies tracked by count (not weight). Add / edit on-hand +
 * reorder-point inline; rows below their threshold highlight red so the
 * operator never gets caught short. Colors live separately in StockManager.
 */
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { InventorySupply, SupplyCategory } from "@/lib/supabase/types.helpers";

const CATEGORY_HE: Record<SupplyCategory, string> = {
  baseplate: "לוחות בסיס",
  connector: "מחברים",
  packaging: "אריזה",
  other: "אחר",
};

const CATEGORIES: SupplyCategory[] = [
  "baseplate",
  "connector",
  "packaging",
  "other",
];

export function SuppliesManager() {
  const [rows, setRows] = useState<InventorySupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    category: "packaging" as SupplyCategory,
    name: "",
    unit: "pcs",
    on_hand: "0",
    reorder_point: "0",
    supplier: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("inventory_supplies")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (!cancelled) {
        setRows(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function patch(id: string, fields: Partial<InventorySupply>) {
    const sb = createClient();
    await sb.from("inventory_supplies").update(fields).eq("id", id);
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...fields } : r)),
    );
  }

  async function remove(id: string) {
    const sb = createClient();
    await sb.from("inventory_supplies").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function add() {
    if (!draft.name.trim()) return;
    setAdding(true);
    const sb = createClient();
    const { data } = await sb
      .from("inventory_supplies")
      .insert({
        category: draft.category,
        name: draft.name.trim(),
        unit: draft.unit.trim() || "pcs",
        on_hand: Number(draft.on_hand) || 0,
        reorder_point: Number(draft.reorder_point) || 0,
        supplier: draft.supplier.trim() || null,
      })
      .select("*")
      .single();
    setAdding(false);
    if (data) {
      setRows((prev) => [...prev, data]);
      setDraft({
        category: "packaging",
        name: "",
        unit: "pcs",
        on_hand: "0",
        reorder_point: "0",
        supplier: "",
      });
    }
  }

  const belowCount = rows.filter(
    (r) => Number(r.reorder_point) > 0 && Number(r.on_hand) < Number(r.reorder_point),
  ).length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">
        ציוד ואריזה ({rows.length}
        {belowCount > 0 ? ` · ${belowCount} מתחת לסף` : ""})
      </h2>

      <div className="overflow-x-auto rounded-xl border border-outline">
        <table className="w-full text-start text-sm">
          <thead className="bg-surface-muted text-zinc-600">
            <tr>
              <th className="p-2 text-start">קטגוריה</th>
              <th className="p-2 text-start">שם</th>
              <th className="p-2 text-start">יחידה</th>
              <th className="p-2 text-start">במלאי</th>
              <th className="p-2 text-start">סף התראה</th>
              <th className="p-2 text-start">ספק</th>
              <th className="p-2 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-zinc-400">
                  טוען…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-zinc-400">
                  אין פריטים. הוסיפו ציוד למטה.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const below =
                Number(r.reorder_point) > 0 &&
                Number(r.on_hand) < Number(r.reorder_point);
              return (
                <tr
                  key={r.id}
                  className={`border-t border-outline ${below ? "bg-red-50" : ""}`}
                >
                  <td className="p-2 text-zinc-500">
                    {CATEGORY_HE[r.category as SupplyCategory] ?? r.category}
                  </td>
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 text-zinc-500">{r.unit}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      defaultValue={String(r.on_hand)}
                      className="w-20 rounded border border-outline px-2 py-1 bg-surface"
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isNaN(n) && n !== Number(r.on_hand))
                          void patch(r.id, { on_hand: n });
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      defaultValue={String(r.reorder_point)}
                      className="w-20 rounded border border-outline px-2 py-1 bg-surface"
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isNaN(n) && n !== Number(r.reorder_point))
                          void patch(r.id, { reorder_point: n });
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      defaultValue={r.supplier ?? ""}
                      className="w-28 rounded border border-outline px-2 py-1 bg-surface"
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (r.supplier ?? null))
                          void patch(r.id, { supplier: v });
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => void remove(r.id)}
                      className="text-xs text-red-600 underline"
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-outline p-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          קטגוריה
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                category: e.target.value as SupplyCategory,
              }))
            }
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_HE[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          שם
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          יחידה
          <input
            value={draft.unit}
            onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
            className="w-16 rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          במלאי
          <input
            type="number"
            min={0}
            value={draft.on_hand}
            onChange={(e) =>
              setDraft((d) => ({ ...d, on_hand: e.target.value }))
            }
            className="w-20 rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          סף התראה
          <input
            type="number"
            min={0}
            value={draft.reorder_point}
            onChange={(e) =>
              setDraft((d) => ({ ...d, reorder_point: e.target.value }))
            }
            className="w-20 rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          ספק
          <input
            value={draft.supplier}
            onChange={(e) =>
              setDraft((d) => ({ ...d, supplier: e.target.value }))
            }
            className="w-28 rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <button
          type="button"
          disabled={adding || !draft.name.trim()}
          onClick={() => void add()}
          className="btn btn-primary h-9 min-h-9 px-4 text-sm"
        >
          הוסף
        </button>
      </div>
    </section>
  );
}

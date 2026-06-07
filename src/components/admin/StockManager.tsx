"use client";
/**
 * Admin color-stock manager (24-color catalog).
 *
 * Effective availability = DB override (brick_stock) if present, else the
 * color's `core` default (17 core in stock, 7 boosters out). Toggling writes an
 * explicit brick_stock row. The studio reads the same logic so out-of-stock
 * colors are hidden from customers and excluded from the engine.
 */
import { useEffect, useState } from "react";

import { CATALOG, isCore } from "@/lib/brick-engine/palette";
import { createClient } from "@/lib/supabase/client";

export function StockManager() {
  // Explicit DB overrides: id → in_stock.
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("brick_stock").select("id, in_stock");
      if (!cancelled) {
        setOverrides(new Map((data ?? []).map((r) => [r.id, r.in_stock])));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inStockOf = (id: number): boolean =>
    overrides.get(id) ?? isCore(id);

  async function toggle(id: number) {
    const next = !inStockOf(id);
    setSaving(id);
    const sb = createClient();
    const { error } = await sb
      .from("brick_stock")
      .upsert({ id, in_stock: next }, { onConflict: "id" });
    setSaving(null);
    if (error) return;
    setOverrides((prev) => new Map(prev).set(id, next));
  }

  const inStockCount = CATALOG.filter((c) => inStockOf(c.id)).length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">
        מלאי צבעים ({inStockCount}/{CATALOG.length} זמינים)
      </h2>
      <div className="flex flex-wrap gap-2">
        {CATALOG.map((c) => {
          const oos = !inStockOf(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={saving === c.id}
              onClick={() => toggle(c.id)}
              title={`${c.name}${isCore(c.id) ? " · ליבה" : " · בוסט"}`}
              className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xs ${
                oos
                  ? "border-red-400 opacity-30"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {oos ? <span className="text-red-700">✕</span> : null}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        לחצו על צבע כדי לסמן שאזל / חזר למלאי. 17 צבעי הליבה זמינים כברירת מחדל;
        7 צבעי הבוסט מושבתים עד שתזמינו אותם.
      </p>
    </section>
  );
}

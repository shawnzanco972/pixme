"use client";
/**
 * Admin color-stock manager. Lets the operator mark catalog colors in/out of
 * stock (upserts brick_stock; absence of a row == in stock). The studio reads
 * this so out-of-stock colors are disabled and the engine stops using them.
 */
import { useEffect, useState } from "react";

import { CATALOG, isRecommended } from "@/lib/brick-engine/palette";
import { createClient } from "@/lib/supabase/client";

export function StockManager() {
  const [outOfStock, setOutOfStock] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("brick_stock")
        .select("id, in_stock")
        .eq("in_stock", false);
      if (!cancelled) setOutOfStock(new Set((data ?? []).map((r) => r.id)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(id: number) {
    const nowInStock = outOfStock.has(id); // currently OOS → bringing back
    setSaving(id);
    const sb = createClient();
    const { error } = await sb
      .from("brick_stock")
      .upsert({ id, in_stock: nowInStock }, { onConflict: "id" });
    setSaving(null);
    if (error) return;
    setOutOfStock((prev) => {
      const next = new Set(prev);
      if (nowInStock) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const recommendedOOS = CATALOG.filter(
    (c) => isRecommended(c.id) && outOfStock.has(c.id),
  ).length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">
        מלאי צבעים ({CATALOG.length - outOfStock.size}/{CATALOG.length} זמינים)
      </h2>
      {recommendedOOS > 0 && (
        <p className="text-sm text-amber-600">
          ⚠ {recommendedOOS} צבעים מומלצים אזלו מהמלאי — מומלץ להזמין.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {CATALOG.map((c) => {
          const oos = outOfStock.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={saving === c.id}
              onClick={() => toggle(c.id)}
              title={`${c.name}${isRecommended(c.id) ? " · מומלץ" : ""}`}
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
        לחצו על צבע כדי לסמן שאזל / חזר למלאי. צבעים שאזלו מוסתרים מהלקוחות.
      </p>
    </section>
  );
}

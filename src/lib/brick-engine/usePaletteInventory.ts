"use client";
/**
 * Loads the brick color catalog merged with live availability from Supabase
 * (`brick_stock`). Convention: no row == in stock. Returns the colors plus the
 * default-enabled set (recommended ∩ in-stock) the studio starts from.
 */
import { useEffect, useMemo, useState } from "react";

import { CATALOG, isRecommended } from "@/lib/brick-engine/palette";
import { createClient } from "@/lib/supabase/client";

export interface PaletteColor {
  id: number;
  name: string;
  hex: string;
  rgb: [number, number, number];
  inStock: boolean;
  recommended: boolean;
}

export function usePaletteInventory() {
  const [stock, setStock] = useState<Map<number, boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        const { data } = await sb.from("brick_stock").select("id, in_stock");
        if (cancelled) return;
        setStock(new Map((data ?? []).map((r) => [r.id, r.in_stock])));
      } catch {
        if (!cancelled) setStock(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const colors = useMemo<PaletteColor[]>(
    () =>
      CATALOG.map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex,
        rgb: c.rgb,
        inStock: stock?.get(c.id) ?? true,
        recommended: isRecommended(c.id),
      })),
    [stock],
  );

  const defaultEnabledIds = useMemo(() => {
    const inStockRecommended = colors.filter((c) => c.inStock && c.recommended);
    // Fall back to all in-stock if nothing recommended is available.
    const base =
      inStockRecommended.length >= 4
        ? inStockRecommended
        : colors.filter((c) => c.inStock);
    return new Set(base.map((c) => c.id));
  }, [colors]);

  return { colors, defaultEnabledIds, loaded: stock !== null };
}

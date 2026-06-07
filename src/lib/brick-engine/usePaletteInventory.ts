"use client";
/**
 * Loads the 24-color catalog merged with availability.
 *
 * Default in-stock = the color's `core` flag (17 true) UNLESS the DB
 * (`brick_stock`) overrides it. So the 7 booster colors are out of stock by
 * default until an admin marks them in.
 *
 * `forceAllInStock` (dev test mode, ?testPalette=full) bypasses the DB/default
 * and treats all 24 colors as available.
 */
import { useEffect, useMemo, useState } from "react";

import { CATALOG, isCore } from "@/lib/brick-engine/palette";
import { createClient } from "@/lib/supabase/client";

export interface PaletteColor {
  id: number;
  name: string;
  hex: string;
  rgb: [number, number, number];
  inStock: boolean;
  core: boolean;
}

export function usePaletteInventory(forceAllInStock = false) {
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
        // DB override → else the color's core default.
        inStock: forceAllInStock ? true : (stock?.get(c.id) ?? c.core),
        core: isCore(c.id),
      })),
    [stock, forceAllInStock],
  );

  const defaultEnabledIds = useMemo(
    () => new Set(colors.filter((c) => c.inStock).map((c) => c.id)),
    [colors],
  );

  return { colors, defaultEnabledIds, loaded: stock !== null };
}

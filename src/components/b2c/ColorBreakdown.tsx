"use client";
/**
 * Per-color brick breakdown for the customer — how many studs of each color
 * the current mosaic uses. (The physical kit adds spare; this is the visible
 * design count.)
 */
import { type BrickColor } from "@/lib/brick-engine";
import { CATALOG } from "@/lib/brick-engine/palette";
import { buildInventory } from "@/lib/pdf/inventory";

// Customer-facing Hebrew names (the engine/PDF keep the stable English names).
const HE_BY_ID = new Map(CATALOG.map((c) => [c.id, c.nameHe]));

export function ColorBreakdown({
  pixelMap,
  palette,
}: {
  pixelMap: number[][];
  palette?: BrickColor[];
}) {
  const inv = buildInventory(pixelMap, palette);

  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="mb-2 text-sm font-medium">
        פירוט צבעים ({inv.distinctColors})
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {inv.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 shrink-0 rounded border border-black/20"
              style={{ backgroundColor: l.hex }}
            />
            <span className="flex-1 truncate">{HE_BY_ID.get(l.id) ?? l.name}</span>
            <span className="tabular-nums text-zinc-500">{l.count}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-400">סה״כ {inv.totalStuds} לבנים</p>
    </div>
  );
}

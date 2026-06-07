/**
 * Parts inventory — derive a build's bill of materials from a pixel_map.
 *
 * Pure (no PDF, no DOM) so it is unit-testable and reusable by both the PDF
 * route and any on-screen summary. Trusts the stored pixel_map (CLAUDE.md):
 * it never re-runs image processing.
 */
import { countParts } from "@/lib/brick-engine";
import { DEFAULT_PALETTE, type BrickColor } from "@/lib/brick-engine/palette";

export interface PartLine {
  id: number;
  name: string;
  hex: string;
  rgb: [number, number, number];
  count: number;
}

export interface Inventory {
  lines: PartLine[];
  totalStuds: number;
  distinctColors: number;
}

/**
 * Build a parts inventory from a pixel_map, sorted by descending count.
 * Unknown indexes (not in palette) are reported as "Unknown #<id>".
 */
export function buildInventory(
  pixelMap: number[][],
  palette: BrickColor[] = DEFAULT_PALETTE,
): Inventory {
  const counts = countParts(pixelMap);
  const byId = new Map<number, BrickColor>(palette.map((c) => [c.id, c]));

  const lines: PartLine[] = [...counts.entries()]
    .map(([id, count]) => {
      const c = byId.get(id);
      return {
        id,
        name: c?.name ?? `Unknown #${id}`,
        hex: c?.hex ?? "#000000",
        rgb: c?.rgb ?? ([0, 0, 0] as [number, number, number]),
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.id - b.id);

  const totalStuds = lines.reduce((sum, l) => sum + l.count, 0);

  return { lines, totalStuds, distinctColors: lines.length };
}

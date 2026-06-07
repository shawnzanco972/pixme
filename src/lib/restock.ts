/**
 * Restock intelligence — aggregate pending PHYSICAL orders into a per-color
 * GoBricks reorder list (piece counts + grams, incl. spare allowance).
 *
 * Pure + deterministic so it can run on the server (admin page) or in tests.
 */
import { countParts } from "@/lib/brick-engine";
import {
  CATALOG,
  isRecommended,
  type BrickColor,
} from "@/lib/brick-engine/palette";
import { GRAMS_PER_STUD, SPARE_RATIO } from "@/lib/packing";

export interface RestockLine {
  id: number;
  name: string;
  hex: string;
  recommended: boolean;
  /** Total studs needed across all aggregated orders. */
  pieces: number;
  /** Pieces including spare allowance (what to actually order). */
  piecesWithSpare: number;
  /** Weight of piecesWithSpare, grams. */
  grams: number;
}

export interface RestockReport {
  lines: RestockLine[];
  orderCount: number;
  totalPieces: number;
  totalGrams: number;
}

/**
 * @param pixelMaps pixel_maps of pending physical orders (each number[][])
 */
export function aggregateRestock(
  pixelMaps: number[][][],
  palette: BrickColor[] = CATALOG,
): RestockReport {
  const byId = new Map<number, BrickColor>(palette.map((c) => [c.id, c]));
  const totals = new Map<number, number>();

  for (const map of pixelMaps) {
    for (const [id, count] of countParts(map)) {
      totals.set(id, (totals.get(id) ?? 0) + count);
    }
  }

  const lines: RestockLine[] = [...totals.entries()]
    .map(([id, pieces]) => {
      const c = byId.get(id);
      const piecesWithSpare = Math.ceil(pieces * (1 + SPARE_RATIO));
      return {
        id,
        name: c?.name ?? `Unknown #${id}`,
        hex: c?.hex ?? "#000000",
        recommended: isRecommended(id),
        pieces,
        piecesWithSpare,
        grams: Math.round(piecesWithSpare * GRAMS_PER_STUD * 10) / 10,
      };
    })
    .sort((a, b) => b.pieces - a.pieces || a.id - b.id);

  return {
    lines,
    orderCount: pixelMaps.length,
    totalPieces: lines.reduce((s, l) => s + l.pieces, 0),
    totalGrams:
      Math.round(lines.reduce((s, l) => s + l.grams, 0) * 10) / 10,
  };
}

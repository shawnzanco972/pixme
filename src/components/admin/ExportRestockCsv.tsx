"use client";
/**
 * Export the restock/reorder list as a CSV (for sending to GoBricks / records).
 */
import type { RestockLine } from "@/lib/restock";

export type ReorderRow = RestockLine & {
  onHandGrams: number;
  toOrderGrams: number;
};

export function ExportRestockCsv({ rows }: { rows: ReorderRow[] }) {
  function download() {
    const header =
      "id,color,hex,core,design_pieces,order_pieces,needed_grams,on_hand_grams,to_order_grams\n";
    const body = rows
      .map(
        (l) =>
          `${l.id},"${l.name}",${l.hex},${l.core ? 1 : 0},${l.pieces},${l.piecesWithSpare},${l.grams},${l.onHandGrams},${l.toOrderGrams}`,
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixme-restock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="rounded-full border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      ייצוא CSV
    </button>
  );
}

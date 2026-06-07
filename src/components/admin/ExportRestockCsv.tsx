"use client";
/**
 * Export the restock/reorder list as a CSV (for sending to GoBricks / records).
 */
import type { RestockLine } from "@/lib/restock";

export function ExportRestockCsv({ lines }: { lines: RestockLine[] }) {
  function download() {
    const header = "id,color,hex,core,design_pieces,order_pieces,grams\n";
    const rows = lines
      .map(
        (l) =>
          `${l.id},"${l.name}",${l.hex},${l.core ? 1 : 0},${l.pieces},${l.piecesWithSpare},${l.grams}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
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
      disabled={lines.length === 0}
      className="rounded-full border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      ייצוא CSV
    </button>
  );
}

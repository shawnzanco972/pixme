/**
 * Admin packing-list PDF — the weigh-and-pack sheet for fulfilling an order.
 * Per-color pieces (+spare) and grams, plus the total scale target. Generated
 * from the stored pixel_map (trusted; no image math).
 */
import { jsPDF } from "jspdf";

import { type BrickColor } from "@/lib/brick-engine";
import { formatWeight } from "@/lib/packing";
import { orderPackingList } from "@/lib/restock";

const A4 = { w: 210, h: 297 };
const MARGIN = 14;

export interface PackingPdfOptions {
  palette?: BrickColor[];
  orderId?: string;
  customerName?: string;
}

export function buildPackingListPdf(
  pixelMap: number[][],
  options: PackingPdfOptions = {},
): ArrayBuffer {
  const report = orderPackingList(pixelMap, options.palette);
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Pixipic — Packing List", MARGIN, MARGIN + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = MARGIN + 14;
  if (options.customerName) {
    doc.text(`Customer: ${options.customerName}`, MARGIN, y);
    y += 5;
  }
  if (options.orderId) {
    doc.text(`Order: ${options.orderId}`, MARGIN, y);
    y += 5;
  }
  doc.text(
    `Colors: ${report.lines.length}   Pieces: ${report.totalPieces}   Weight: ${formatWeight(
      report.totalGrams,
    )} (incl. spare)`,
    MARGIN,
    y,
  );
  y += 8;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const col = { sw: MARGIN, name: MARGIN + 10, pcs: 120, pack: 145, g: 185 };
  doc.text("Color", col.name, y);
  doc.text("Design", col.pcs, y, { align: "right" });
  doc.text("Pack", col.pack, y, { align: "right" });
  doc.text("Grams", col.g, y, { align: "right" });
  y += 2;
  doc.setDrawColor(150, 150, 150);
  doc.line(MARGIN, y, A4.w - MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  for (const l of report.lines) {
    if (y > A4.h - MARGIN - 16) {
      doc.addPage();
      y = MARGIN + 8;
    }
    doc.setFillColor(l.rgb?.[0] ?? 0, l.rgb?.[1] ?? 0, l.rgb?.[2] ?? 0);
    doc.setDrawColor(120, 120, 120);
    doc.rect(col.sw, y - 4, 5, 5, "FD");
    doc.text(`${l.name}${l.core ? "" : " *"}`, col.name, y);
    doc.text(String(l.pieces), col.pcs, y, { align: "right" });
    doc.text(String(l.piecesWithSpare), col.pack, y, { align: "right" });
    doc.text(formatWeight(l.grams), col.g, y, { align: "right" });
    y += 7;
  }

  doc.setDrawColor(60, 60, 60);
  doc.line(MARGIN, y - 4, A4.w - MARGIN, y - 4);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL (scale target)", col.name, y + 2);
  doc.text(formatWeight(report.totalGrams), col.g, y + 2, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "* = booster color (outside the 17 core). Pack by weight on the scale.",
    MARGIN,
    A4.h - MARGIN,
  );

  return doc.output("arraybuffer");
}

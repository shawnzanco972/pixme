/**
 * Admin packing-list PDF — the weigh-and-pack sheet for fulfilling an order.
 * Per-color pieces (+spare) and grams, plus the total scale target and a
 * tick-box per color so the packer can check colors off as they're weighed.
 * Generated from the stored pixel_map (trusted; no image math).
 *
 * jsPDF has no bidi shaping: Western digits next to Hebrew get reordered, and
 * the built-in Latin fonts can't draw Hebrew at all. So all numbers/units use
 * ASCII (g / kg), and the only Hebrew (the customer name) is drawn with an
 * embedded Heebo font, logically reversed so it reads right-to-left.
 */
import { jsPDF } from "jspdf";

import { type BrickColor } from "@/lib/brick-engine";
import { formatWeightAscii } from "@/lib/packing";
import { orderPackingList } from "@/lib/restock";
import { HEEBO_TTF_BASE64 } from "./heebo-font";

const A4 = { w: 210, h: 297 };
const MARGIN = 14;
/** Physical size of one 1x1 plate, cm (96cm ÷ 120 studs). */
const CM_PER_STUD = 0.8;

export interface PackingPdfOptions {
  palette?: BrickColor[];
  orderId?: string;
  customerName?: string;
}

/** Register Heebo for Hebrew text; returns the font name or null on failure. */
function registerHebrew(doc: jsPDF): string | null {
  try {
    doc.addFileToVFS("Heebo.ttf", HEEBO_TTF_BASE64);
    doc.addFont("Heebo.ttf", "Heebo", "normal");
    return "Heebo";
  } catch {
    return null;
  }
}

/** True if the string contains any Hebrew code points. */
function hasHebrew(s: string): boolean {
  return /[֐-׿]/.test(s);
}

/** Visually reverse so a Hebrew run drawn LTR (no bidi) reads right-to-left. */
function rtl(s: string): string {
  return [...s].reverse().join("");
}

export function buildPackingListPdf(
  pixelMap: number[][],
  options: PackingPdfOptions = {},
): ArrayBuffer {
  const report = orderPackingList(pixelMap, options.palette);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const hebrewFont = registerHebrew(doc);

  const rows = pixelMap.length;
  const cols = rows > 0 ? pixelMap[0].length : 0;
  const wCm = Math.round(cols * CM_PER_STUD);
  const hCm = Math.round(rows * CM_PER_STUD);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Pixipic — Packing List", MARGIN, MARGIN + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = MARGIN + 14;

  if (options.customerName) {
    const label = "Customer: ";
    doc.text(label, MARGIN, y);
    if (hebrewFont && hasHebrew(options.customerName)) {
      // Draw the Hebrew name with Heebo, right-aligned & reversed for RTL.
      doc.setFont(hebrewFont, "normal");
      doc.text(rtl(options.customerName), A4.w - MARGIN, y, { align: "right" });
      doc.setFont("helvetica", "normal");
    } else {
      doc.text(options.customerName, MARGIN + doc.getTextWidth(label), y);
    }
    y += 5;
  }
  if (options.orderId) {
    doc.text(`Order: ${options.orderId}`, MARGIN, y);
    y += 5;
  }
  doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, MARGIN, y);
  y += 5;
  doc.text(
    `Size: ${cols} × ${rows} studs  ·  ${wCm} × ${hCm} cm`,
    MARGIN,
    y,
  );
  y += 5;
  doc.text(
    `Colors: ${report.lines.length}   Pieces: ${report.totalPieces}   Pack weight: ${formatWeightAscii(
      report.totalGrams,
    )} (incl. spare)`,
    MARGIN,
    y,
  );
  y += 8;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const col = {
    sw: MARGIN,
    name: MARGIN + 8,
    design: 118,
    pack: 145,
    g: 178,
    check: A4.w - MARGIN - 5,
  };
  doc.text("Color", col.name, y);
  doc.text("Design", col.design, y, { align: "right" });
  doc.text("Pack", col.pack, y, { align: "right" });
  doc.text("Grams", col.g, y, { align: "right" });
  doc.text("Done", col.check + 5, y, { align: "right" });
  y += 2;
  doc.setDrawColor(150, 150, 150);
  doc.line(MARGIN, y, A4.w - MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  for (const l of report.lines) {
    if (y > A4.h - MARGIN - 18) {
      doc.addPage();
      y = MARGIN + 8;
    }
    doc.setFillColor(l.rgb?.[0] ?? 0, l.rgb?.[1] ?? 0, l.rgb?.[2] ?? 0);
    doc.setDrawColor(120, 120, 120);
    doc.rect(col.sw, y - 4, 5, 5, "FD");
    doc.text(`${l.name}${l.core ? "" : " *"}`, col.name, y);
    doc.text(String(l.pieces), col.design, y, { align: "right" });
    doc.text(String(l.piecesWithSpare), col.pack, y, { align: "right" });
    doc.text(formatWeightAscii(l.grams), col.g, y, { align: "right" });
    // Empty tick-box to check off after weighing this color.
    doc.setDrawColor(80, 80, 80);
    doc.rect(col.check, y - 4, 5, 5, "D");
    y += 7;
  }

  doc.setDrawColor(60, 60, 60);
  doc.line(MARGIN, y - 4, A4.w - MARGIN, y - 4);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL (scale target)", col.name, y + 2);
  doc.text(formatWeightAscii(report.totalGrams), col.g, y + 2, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "* = booster color (outside the core set).   Pack column already includes the spare cushion — weigh each color to its grams figure.",
    MARGIN,
    A4.h - MARGIN,
  );
  doc.setTextColor(0, 0, 0);

  return doc.output("arraybuffer");
}

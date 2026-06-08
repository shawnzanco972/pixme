/**
 * Admin packing-list PDF — the weigh-and-pack sheet for fulfilling an order.
 * Per-color pieces (+spare) and grams, plus the total scale target and a
 * tick-box per color so the packer can check colors off as they're weighed.
 * Generated from the stored pixel_map (trusted; no image math).
 *
 * Fully Hebrew + RTL. jsPDF's own bidi engine mishandles numbers in RTL-base
 * lines (dates/dimensions reverse), so instead we reorder to visual order
 * ourselves with the Unicode Bidi Algorithm (`toVisual`) and tell jsPDF the
 * input is already visual (`isInputVisual`) so it doesn't touch it. We also
 * right-align manually (jsPDF's `align:'right'` re-corrupts the order). The
 * table is laid out right-to-left (colour on the right, tick-box on the left);
 * colour names stay English and bidi keeps those runs correct.
 */
import { jsPDF } from "jspdf";

import { type BrickColor } from "@/lib/brick-engine";
import { formatWeight } from "@/lib/packing";
import { orderPackingList } from "@/lib/restock";
import { HEEBO_TTF_BASE64 } from "./heebo-font";
import { makeHebrewWriter } from "./rtl";

const A4 = { w: 210, h: 297 };
const MARGIN = 14;
const RIGHT = A4.w - MARGIN; // right edge of the content (start of RTL text)
/** Physical size of one 1x1 plate, cm (96cm ÷ 120 studs). */
const CM_PER_STUD = 0.8;

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
  doc.addFileToVFS("Heebo.ttf", HEEBO_TTF_BASE64);
  doc.addFont("Heebo.ttf", "Heebo", "normal");
  doc.setFont("Heebo", "normal");

  const he = makeHebrewWriter(doc);

  const rows = pixelMap.length;
  const cols = rows > 0 ? pixelMap[0].length : 0;
  const wCm = Math.round(cols * CM_PER_STUD);
  const hCm = Math.round(rows * CM_PER_STUD);

  // Title
  doc.setFontSize(18);
  he("פיקסיפיק — רשימת אריזה", RIGHT, MARGIN + 6);

  // Metadata
  doc.setFontSize(10);
  let y = MARGIN + 15;
  if (options.customerName) {
    he(`לקוח: ${options.customerName}`, RIGHT, y);
    y += 5;
  }
  if (options.orderId) {
    he(`הזמנה: ${options.orderId}`, RIGHT, y);
    y += 5;
  }
  he(`תאריך: ${new Date().toLocaleDateString("en-GB")}`, RIGHT, y);
  y += 5;
  he(`גודל: ${cols}×${rows} לבנים · ${wCm}×${hCm} ס"מ`, RIGHT, y);
  y += 5;
  he(
    `${report.lines.length} צבעים · ${report.totalPieces} חלקים · משקל אריזה ${formatWeight(
      report.totalGrams,
    )} (כולל רזרבה)`,
    RIGHT,
    y,
  );
  y += 9;

  // Column anchors (right-to-left): colour on the right, tick-box on the left.
  const swatchX = RIGHT - 5; // left edge of the colour swatch rect
  const nameRight = swatchX - 2; // colour name, right-aligned to here
  const designRight = 128;
  const packRight = 100;
  const gramsRight = 66;
  const doneX = MARGIN; // tick-box rect left edge

  // Header row
  doc.setFontSize(11);
  he("צבע", nameRight, y);
  he("בעיצוב", designRight, y);
  he("לאריזה", packRight, y);
  he("משקל", gramsRight, y);
  he("בוצע", doneX + 6, y);
  y += 2;
  doc.setDrawColor(150, 150, 150);
  doc.line(MARGIN, y, RIGHT, y);
  y += 6;

  doc.setFontSize(10);
  for (const l of report.lines) {
    if (y > A4.h - MARGIN - 18) {
      doc.addPage();
      doc.setFont("Heebo", "normal");
      y = MARGIN + 8;
    }
    doc.setFillColor(l.rgb?.[0] ?? 0, l.rgb?.[1] ?? 0, l.rgb?.[2] ?? 0);
    doc.setDrawColor(120, 120, 120);
    doc.rect(swatchX, y - 4, 5, 5, "FD");
    he(`${l.name}${l.core ? "" : " *"}`, nameRight, y);
    he(String(l.pieces), designRight, y);
    he(String(l.piecesWithSpare), packRight, y);
    he(formatWeight(l.grams), gramsRight, y);
    // Empty tick-box to check off after weighing this colour.
    doc.setDrawColor(80, 80, 80);
    doc.rect(doneX, y - 4, 5, 5, "D");
    y += 7;
  }

  // Total
  doc.setDrawColor(60, 60, 60);
  doc.line(MARGIN, y - 4, RIGHT, y - 4);
  doc.setFontSize(11);
  he("סה״כ (יעד שקילה)", nameRight, y + 2);
  he(formatWeight(report.totalGrams), gramsRight, y + 2);

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  he(
    'צבע עם * הוא צבע משלים (מחוץ לסט הליבה). עמודת "לאריזה" כבר כוללת רזרבה — שִׁקלו כל צבע למשקל שלו.',
    RIGHT,
    A4.h - MARGIN,
  );
  doc.setTextColor(0, 0, 0);

  return doc.output("arraybuffer");
}

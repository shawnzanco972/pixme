/**
 * jsPDF instruction-manual generator.
 *
 * Turns a stored pixel_map into a printable build manual:
 *   - cover with a rendered preview + summary
 *   - one page per 16×16 module: a numbered, color-filled build grid
 *   - a parts inventory table
 *
 * Trusts the pixel_map (CLAUDE.md) — NO image processing happens here, so the
 * serverless route stays fast and within time limits.
 *
 * Labels/numbers are language-neutral. Hebrew text (title) renders correctly
 * only when a Hebrew-capable font is supplied via `hebrewFontBase64`; otherwise
 * we fall back to the Latin title so output is never garbled.
 */
import { jsPDF } from "jspdf";

import { DEFAULT_PALETTE, type BrickColor } from "@/lib/brick-engine/palette";
import { estimateWeight } from "@/lib/packing";
import { buildInventory } from "./inventory";

export interface InstructionsOptions {
  palette?: BrickColor[];
  /** Module size in studs (square). Default 16 (the project's modular grid). */
  moduleSize?: number;
  /** Title shown on the cover. */
  title?: string;
  /** Optional Hebrew TTF as base64 to embed for Hebrew text. */
  hebrewFontBase64?: string;
}

const A4 = { w: 210, h: 297 };
const MARGIN = 12;

/** Pick black/white text for legibility over a given fill color (sRGB). */
function readableText(rgb: [number, number, number]): [number, number, number] {
  // Rec. 601 luma is good enough for contrast selection.
  const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luma > 140 ? [20, 20, 20] : [245, 245, 245];
}

function maybeRegisterHebrew(doc: jsPDF, base64?: string): string | null {
  if (!base64) return null;
  try {
    doc.addFileToVFS("Heebo.ttf", base64);
    doc.addFont("Heebo.ttf", "Heebo", "normal");
    return "Heebo";
  } catch {
    return null;
  }
}

/** Generate the instruction-manual PDF as an ArrayBuffer. */
export function buildInstructionsPdf(
  pixelMap: number[][],
  options: InstructionsOptions = {},
): ArrayBuffer {
  const palette = options.palette ?? DEFAULT_PALETTE;
  const moduleSize = options.moduleSize ?? 24;
  const rows = pixelMap.length;
  const cols = rows > 0 ? pixelMap[0].length : 0;

  const byId = new Map<number, BrickColor>(palette.map((c) => [c.id, c]));
  const inv = buildInventory(pixelMap, palette);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const hebrewFont = maybeRegisterHebrew(doc, options.hebrewFontBase64);
  const title =
    options.title ?? (hebrewFont ? "פיקסיפיק — מדריך הרכבה" : "Pixipic — Build Instructions");

  // ---------------------------------------------------------------- Cover
  doc.setFont(hebrewFont ?? "helvetica", hebrewFont ? "normal" : "bold");
  doc.setFontSize(22);
  if (hebrewFont) {
    doc.text(title, A4.w - MARGIN, MARGIN + 8, { align: "right" });
  } else {
    doc.text(title, MARGIN, MARGIN + 8);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `Size: ${cols} × ${rows} studs   |   Total: ${inv.totalStuds} studs   |   Colors: ${inv.distinctColors}`,
    MARGIN,
    MARGIN + 18,
  );

  // Rendered preview (fit within a box under the header).
  drawPreview(doc, pixelMap, byId, {
    x: MARGIN,
    y: MARGIN + 26,
    maxW: A4.w - 2 * MARGIN,
    maxH: A4.h - (MARGIN + 26) - MARGIN,
  });

  // --------------------------------------------------- Baseplate layout map
  const modulesX = Math.ceil(cols / moduleSize);
  const modulesY = Math.ceil(rows / moduleSize);

  // Only worth a dedicated overview page when there's more than one baseplate.
  if (modulesX * modulesY > 1) {
    doc.addPage();
    drawBaseplateLayout(doc, pixelMap, byId, {
      moduleSize,
      cols,
      rows,
      modulesX,
      modulesY,
    });
  }

  // ------------------------------------------------------------- Modules
  for (let my = 0; my < modulesY; my++) {
    for (let mx = 0; mx < modulesX; mx++) {
      doc.addPage();
      drawModule(doc, pixelMap, byId, {
        mx,
        my,
        moduleSize,
        cols,
        rows,
        modulesX,
        modulesY,
      });
    }
  }

  // ----------------------------------------------------------- Inventory
  doc.addPage();
  drawInventory(doc, inv);

  return doc.output("arraybuffer");
}

function drawPreview(
  doc: jsPDF,
  pixelMap: number[][],
  byId: Map<number, BrickColor>,
  box: { x: number; y: number; maxW: number; maxH: number },
) {
  const rows = pixelMap.length;
  const cols = rows > 0 ? pixelMap[0].length : 0;
  if (!cols || !rows) return;

  const cell = Math.min(box.maxW / cols, box.maxH / rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const [r, g, b] = byId.get(pixelMap[y][x])?.rgb ?? [0, 0, 0];
      doc.setFillColor(r, g, b);
      doc.rect(box.x + x * cell, box.y + y * cell, cell, cell, "F");
    }
  }
}

/**
 * Overview page: the whole mosaic with thick baseplate boundaries and an
 * R#-C# label per baseplate, so the builder knows which plate goes where on the
 * wall before opening the per-baseplate stud pages.
 */
function drawBaseplateLayout(
  doc: jsPDF,
  pixelMap: number[][],
  byId: Map<number, BrickColor>,
  m: {
    moduleSize: number;
    cols: number;
    rows: number;
    modulesX: number;
    modulesY: number;
  },
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(
    `Baseplate Layout — ${m.modulesY} rows × ${m.modulesX} cols of ${m.moduleSize}-stud plates`,
    MARGIN,
    MARGIN + 6,
  );

  const top = MARGIN + 12;
  const cell = Math.min(
    (A4.w - 2 * MARGIN) / m.cols,
    (A4.h - top - MARGIN) / m.rows,
  );
  const gridX = MARGIN;

  drawPreview(doc, pixelMap, byId, {
    x: gridX,
    y: top,
    maxW: m.cols * cell,
    maxH: m.rows * cell,
  });

  // Baseplate boundary lines + labels.
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  for (let r = 0; r <= m.modulesY; r++) {
    const y = top + Math.min(r * m.moduleSize, m.rows) * cell;
    doc.line(gridX, y, gridX + m.cols * cell, y);
  }
  for (let c = 0; c <= m.modulesX; c++) {
    const x = gridX + Math.min(c * m.moduleSize, m.cols) * cell;
    doc.line(x, top, x, top + m.rows * cell);
  }

  doc.setFontSize(Math.max(8, m.moduleSize * cell * 0.18));
  for (let my = 0; my < m.modulesY; my++) {
    for (let mx = 0; mx < m.modulesX; mx++) {
      const label = `R${my + 1}-C${mx + 1}`;
      const cx =
        gridX + (mx + 0.5) * m.moduleSize * cell;
      const cy = top + (my + 0.5) * m.moduleSize * cell;
      // White halo for legibility over any color.
      doc.setTextColor(255, 255, 255);
      doc.text(label, cx + 0.3, cy + 0.3, { align: "center" });
      doc.setTextColor(20, 20, 20);
      doc.text(label, cx, cy, { align: "center" });
    }
  }
}

function drawModule(
  doc: jsPDF,
  pixelMap: number[][],
  byId: Map<number, BrickColor>,
  m: {
    mx: number;
    my: number;
    moduleSize: number;
    cols: number;
    rows: number;
    modulesX: number;
    modulesY: number;
  },
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    `Module R${m.my + 1}-C${m.mx + 1}  (of ${m.modulesY}×${m.modulesX})`,
    MARGIN,
    MARGIN + 6,
  );

  const x0 = m.mx * m.moduleSize;
  const y0 = m.my * m.moduleSize;
  const xEnd = Math.min(m.cols, x0 + m.moduleSize);
  const yEnd = Math.min(m.rows, y0 + m.moduleSize);
  const wStuds = xEnd - x0;
  const hStuds = yEnd - y0;

  const avail = Math.min(A4.w - 2 * MARGIN, A4.h - (MARGIN + 12) - MARGIN);
  const cell = avail / m.moduleSize;
  const gridX = MARGIN;
  const gridY = MARGIN + 12;

  doc.setFontSize(Math.max(6, cell * 1.6));
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.1);

  for (let yy = 0; yy < hStuds; yy++) {
    for (let xx = 0; xx < wStuds; xx++) {
      const id = pixelMap[y0 + yy][x0 + xx];
      const color = byId.get(id);
      const rgb = color?.rgb ?? [0, 0, 0];
      const cx = gridX + xx * cell;
      const cy = gridY + yy * cell;

      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(cx, cy, cell, cell, "FD"); // fill + draw border

      const [tr, tg, tb] = readableText(rgb);
      doc.setTextColor(tr, tg, tb);
      doc.text(String(id), cx + cell / 2, cy + cell / 2 + cell * 0.18, {
        align: "center",
      });
    }
  }
  doc.setTextColor(20, 20, 20);
}

function drawInventory(
  doc: jsPDF,
  inv: ReturnType<typeof buildInventory>,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Parts Inventory", MARGIN, MARGIN + 6);

  doc.setFontSize(10);
  let y = MARGIN + 16;
  const rowH = 7;
  const swatch = 5;

  doc.text("#", MARGIN, y);
  doc.text("Color", MARGIN + 22, y);
  doc.text("Qty", A4.w - MARGIN, y, { align: "right" });
  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.line(MARGIN, y, A4.w - MARGIN, y);
  y += rowH;

  doc.setFont("helvetica", "normal");
  for (const line of inv.lines) {
    if (y > A4.h - MARGIN) {
      doc.addPage();
      y = MARGIN + 10;
    }
    doc.text(String(line.id), MARGIN, y);
    doc.setFillColor(line.rgb[0], line.rgb[1], line.rgb[2]);
    doc.setDrawColor(120, 120, 120);
    doc.rect(MARGIN + 10, y - swatch + 1, swatch, swatch, "FD");
    doc.text(line.name, MARGIN + 22, y);
    doc.text(String(line.count), A4.w - MARGIN, y, { align: "right" });
    y += rowH;
  }

  doc.setFont("helvetica", "bold");
  y += 2;
  doc.line(MARGIN, y - rowH + 2, A4.w - MARGIN, y - rowH + 2);
  doc.text(`Total studs: ${inv.totalStuds}`, A4.w - MARGIN, y, {
    align: "right",
  });

  // Weight-based packing target (Pixipic packs by scale, not by counting).
  const w = estimateWeight(inv.totalStuds);
  y += rowH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Packing scale target: ~${w.scaleTargetGrams} g (incl. ${Math.round(
      (w.bricksWithSpareGrams / w.bricksGrams - 1) * 100,
    )}% spare)`,
    A4.w - MARGIN,
    y,
    { align: "right" },
  );
}

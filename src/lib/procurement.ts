/**
 * Procurement export — turn a reorder/restock (keyed by our canonical `colorId`)
 * into a supplier-ready order list in ANY manufacturer's numbering.
 *
 * The manufacturer→code mapping lives in DB (`color_manufacturer_codes`) and is
 * passed in here, so adding a new supplier is DATA-ONLY (no code change). The
 * canonical `colorId` is never coupled to a supplier's SKU scheme.
 *
 * Pure + deterministic (server + test friendly).
 */
import type { RestockReport } from "@/lib/restock";

/** Per-color supplier code lookup for ONE manufacturer, keyed by `colorId`. */
export type ManufacturerCodeMap = Map<
  string,
  { code: string; sku?: string | null }
>;

/** Our current primary brick supplier (Shantou Chenghai Peiye Toys / BCM). */
export const DEFAULT_MANUFACTURER = "peiye";
/** Brick mold we order — Plate 1x1 (supplier/LEGO part 3024). */
export const DEFAULT_PART_NUMBER = "3024";

export interface ProcurementLine {
  colorId: string;
  displayCode: string;
  name: string;
  /** The mold/part ordered (e.g. "3024" = Plate 1x1). */
  part: string;
  /** The chosen manufacturer's colour code, or null if unmapped. */
  manufacturerCode: string | null;
  /** Full order SKU = `part-code` (e.g. "3024-154"), or null if unmapped. */
  sku: string | null;
  pieces: number;
  grams: number;
}

export interface ProcurementExport {
  manufacturer: string;
  lines: ProcurementLine[];
  /** colorIds with no code for this manufacturer — must be filled before order. */
  unmapped: string[];
  totalPieces: number;
  totalGrams: number;
}

export interface ProcurementOptions {
  /** Supplier whose numbering to emit. Default {@link DEFAULT_MANUFACTURER}. */
  manufacturer?: string;
  /** Mold/part ordered. Default {@link DEFAULT_PART_NUMBER} (Plate 1x1). */
  part?: string;
  /** Order piecesWithSpare (true, default) or the bare design count. */
  withSpare?: boolean;
}

/**
 * Build a procurement export from an aggregated restock report + a per-color
 * code map for the selected manufacturer.
 */
export function buildProcurementExport(
  report: RestockReport,
  codes: ManufacturerCodeMap,
  options: ProcurementOptions = {},
): ProcurementExport {
  const manufacturer = options.manufacturer ?? DEFAULT_MANUFACTURER;
  const part = options.part ?? DEFAULT_PART_NUMBER;
  const withSpare = options.withSpare ?? true;
  const unmapped: string[] = [];

  const lines: ProcurementLine[] = report.lines.map((l) => {
    const m = codes.get(l.colorId);
    if (!m) unmapped.push(l.colorId);
    return {
      colorId: l.colorId,
      displayCode: l.displayCode,
      name: l.name,
      part,
      manufacturerCode: m?.code ?? null,
      // Prefer an explicit supplier SKU; else compose part-code.
      sku: m?.sku ?? (m?.code ? `${part}-${m.code}` : null),
      pieces: withSpare ? l.piecesWithSpare : l.pieces,
      grams: l.grams,
    };
  });

  return {
    manufacturer,
    lines,
    unmapped,
    totalPieces: lines.reduce((s, l) => s + l.pieces, 0),
    totalGrams: Math.round(lines.reduce((s, l) => s + l.grams, 0) * 10) / 10,
  };
}

/** RFC-4180-ish CSV escape (quote fields containing separators/quotes). */
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Render a procurement export to CSV in the chosen manufacturer's codes. */
export function procurementToCsv(exp: ProcurementExport): string {
  const header = [
    "part",
    "manufacturer_code",
    "sku",
    "color_id",
    "display_code",
    "name",
    "pieces",
    "grams",
  ];
  const rows = exp.lines.map((l) =>
    [
      l.part,
      l.manufacturerCode ?? "",
      l.sku ?? "",
      l.colorId,
      l.displayCode,
      l.name,
      l.pieces,
      l.grams,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/**
 * Convenience: build a per-manufacturer code map from flat DB rows
 * (`color_manufacturer_codes`), filtered to one manufacturer.
 */
export function codeMapFromRows(
  rows: { color_id: string; manufacturer: string; code: string; sku?: string | null }[],
  manufacturer: string,
): ManufacturerCodeMap {
  const map: ManufacturerCodeMap = new Map();
  for (const r of rows) {
    if (r.manufacturer === manufacturer) {
      map.set(r.color_id, { code: r.code, sku: r.sku ?? null });
    }
  }
  return map;
}

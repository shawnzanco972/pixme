/**
 * B2B pricing — scales with the order, because B2B is PHYSICAL.
 *
 * Every employee receives their own physical gift set, so the price is simply
 * (employees × the regular per-mosaic price for the chosen size). B2B is NOT a
 * digital license and is never dramatically cheaper than a B2C order — anything
 * else loses money on every kit.
 *
 * The optional upsell ("managed") is the convenience layer for the office
 * manager: a dedicated upload link per employee + the project dashboard that
 * tracks them. That's billed per seat (small) — it sells the time saved, not
 * the bricks.
 *
 * Pure + deterministic so the calculator renders live and checkout can recompute
 * the authoritative amount server-side.
 */
import {
  computePrice,
  presetById,
  presetStuds,
  SIZE_PRESETS,
  type SizePreset,
} from "@/lib/pricing";

/** Per-seat fee for the managed upsell (dedicated links + dashboard), ILS. */
export const MANAGED_FEE_PER_SEAT = 18;

/** Above this many employees we switch to a manual price quote. */
export const MAX_SELF_SERVE_SEATS = 100;

// --- Physical plate facts (for the FAQ / family-activity framing) ----------
/** One 24×24 baseplate is ~19 cm per side. */
export const PLATE_CM = 19;
/** Studs per baseplate (24×24). */
export const BRICKS_PER_PLATE = 576;
/** Rough build time for one baseplate, minutes. */
export const BUILD_MINUTES_PER_PLATE = 45;

/** Sizes offered to B2B buyers (curated squares, smallest → largest). */
export const B2B_SIZE_PRESETS: readonly SizePreset[] = SIZE_PRESETS.filter(
  (p) => p.group === "square",
);

export interface B2bQuote {
  employees: number;
  presetId: string;
  cols: number;
  rows: number;
  plates: number;
  /** Physical price of ONE employee's mosaic (same as a regular order). */
  perMosaic: number;
  /** employees × perMosaic. */
  mosaicsTotal: number;
  managed: boolean;
  /** managed ? employees × MANAGED_FEE_PER_SEAT : 0. */
  managementTotal: number;
  total: number;
  /** True when employees exceed the self-serve cap → request a quote. */
  requiresQuote: boolean;
}

/**
 * Compute a B2B quote. Falls back to the first preset for an unknown id, and
 * clamps employees to ≥1. `requiresQuote` is advisory — callers gate checkout
 * on it (the totals are still computed so the quote form can prefill them).
 */
export function computeB2bQuote(
  employees: number,
  presetId: string,
  managed: boolean,
): B2bQuote {
  const preset = presetById(presetId) ?? B2B_SIZE_PRESETS[0];
  const n = Math.max(1, Math.floor(employees || 0));
  const { cols, rows } = presetStuds(preset);
  const perMosaic = computePrice(cols, rows, "physical").total;
  const mosaicsTotal = perMosaic * n;
  const managementTotal = managed ? n * MANAGED_FEE_PER_SEAT : 0;
  return {
    employees: n,
    presetId: preset.id,
    cols,
    rows,
    plates: preset.platesX * preset.platesY,
    perMosaic,
    mosaicsTotal,
    managed,
    managementTotal,
    total: mosaicsTotal + managementTotal,
    requiresQuote: n > MAX_SELF_SERVE_SEATS,
  };
}

/** Estimated build time for one employee's set, in minutes. */
export function buildMinutes(plates: number): number {
  return plates * BUILD_MINUTES_PER_PLATE;
}

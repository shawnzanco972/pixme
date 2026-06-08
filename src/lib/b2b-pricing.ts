/**
 * B2B pricing — scales with the order, with a VOLUME DISCOUNT.
 *
 * B2B is physical (every employee gets their own gift set), so the base is the
 * regular per-mosaic price. But buying in bulk earns a gradual discount — the
 * more sets, the cheaper each one — so an office manager who orders for the
 * whole company (and runs it all from one dashboard, ordering per birthday
 * without paying each time) is rewarded. B2B is therefore cheaper per unit than
 * a one-off B2C order at volume, but never sold below cost.
 *
 * The optional "managed" upsell (dedicated per-employee link + dashboard) is
 * billed per seat and ALSO gets cheaper with volume (down to ₪10 at 50+).
 *
 * Pure + deterministic so the calculator renders live and checkout recomputes
 * the authoritative amount server-side.
 */
import {
  computePrice,
  presetById,
  presetStuds,
  SIZE_PRESETS,
  type SizePreset,
} from "@/lib/pricing";

/** Above this many employees we switch to a manual price quote. */
export const MAX_SELF_SERVE_SEATS = 100;

/**
 * Per-mosaic volume discount: [minEmployees, discountFraction]. Highest
 * matching tier wins. Gradual so bulk buyers see real savings.
 */
const MOSAIC_DISCOUNT_TIERS: ReadonlyArray<readonly [number, number]> = [
  [50, 0.18],
  [25, 0.12],
  [10, 0.06],
  [1, 0],
];

/**
 * Managed-upsell fee per seat: [minEmployees, fee ILS]. Drops to ₪10 at 50+.
 */
const MANAGED_FEE_TIERS: ReadonlyArray<readonly [number, number]> = [
  [50, 10],
  [25, 14],
  [1, 18],
];

/** Headline managed fee for marketing copy ("from ₪10"). */
export const MANAGED_FEE_MIN = 10;
export const MANAGED_FEE_MAX = 18;

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

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Volume discount fraction for an employee count. */
export function mosaicDiscount(employees: number): number {
  return MOSAIC_DISCOUNT_TIERS.find(([min]) => employees >= min)?.[1] ?? 0;
}

/** Managed-upsell fee per seat for an employee count. */
export function managedFeePerSeat(employees: number): number {
  return MANAGED_FEE_TIERS.find(([min]) => employees >= min)?.[1] ?? MANAGED_FEE_MAX;
}

export interface B2bQuote {
  employees: number;
  presetId: string;
  cols: number;
  rows: number;
  plates: number;
  /** Undiscounted physical price of one mosaic (the B2C reference price). */
  perMosaicBase: number;
  /** Discounted per-mosaic price actually charged. */
  perMosaic: number;
  /** Discount fraction applied (0..1). */
  discount: number;
  /** Shekels saved vs. ordering each set at the B2C price. */
  savings: number;
  /** employees × perMosaic. */
  mosaicsTotal: number;
  managed: boolean;
  /** Per-seat managed fee at this volume. */
  managedFee: number;
  /** managed ? employees × managedFee : 0. */
  managementTotal: number;
  total: number;
  /** True when employees exceed the self-serve cap → request a quote. */
  requiresQuote: boolean;
}

/**
 * Compute a B2B quote. Falls back to the first preset for an unknown id, and
 * clamps employees to ≥1.
 */
export function computeB2bQuote(
  employees: number,
  presetId: string,
  managed: boolean,
): B2bQuote {
  const preset = presetById(presetId) ?? B2B_SIZE_PRESETS[0];
  const n = Math.max(1, Math.floor(employees || 0));
  const { cols, rows } = presetStuds(preset);

  const perMosaicBase = computePrice(cols, rows, "physical").total;
  const discount = mosaicDiscount(n);
  const perMosaic = round5(perMosaicBase * (1 - discount));
  const mosaicsTotal = perMosaic * n;
  const savings = (perMosaicBase - perMosaic) * n;

  const managedFee = managedFeePerSeat(n);
  const managementTotal = managed ? n * managedFee : 0;

  return {
    employees: n,
    presetId: preset.id,
    cols,
    rows,
    plates: preset.platesX * preset.platesY,
    perMosaicBase,
    perMosaic,
    discount,
    savings,
    mosaicsTotal,
    managed,
    managedFee,
    managementTotal,
    total: mosaicsTotal + managementTotal,
    requiresQuote: n > MAX_SELF_SERVE_SEATS,
  };
}

/** Estimated build time for one employee's set, in minutes. */
export function buildMinutes(plates: number): number {
  return plates * BUILD_MINUTES_PER_PLATE;
}

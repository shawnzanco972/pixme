/**
 * Brick palette — the set of available 1x1 plate colors the engine can match
 * against, and the project's canonical COLOR IDENTITY.
 *
 * Three-layer identity (manufacturer-agnostic — CLAUDE.md / colour-identifier
 * system). Every color carries:
 *   1. `colorId`     — canonical, stable, internal slug (e.g. "light-bluish-gray").
 *                      This is the key the persisted pixel_map, DB, and stock
 *                      reference. Never reused, never renumbered.
 *   2. `displayCode` — short (≤3 char) code printed inside each stud on the
 *                      instruction grid + legend. Ours, family-grouped for
 *                      print readability (N=neutral/base, K=skin, A=accent).
 *   3. manufacturer codes — a SEPARATE, swappable mapping (DB table
 *                      `color_manufacturer_codes`), so we can reorder in any
 *                      supplier's numbering without touching `colorId`.
 *
 * `id` is a NUMERIC working index (= array position) used only by the hot
 * matching loops (match/despeckle/optimize) for speed. It is an implementation
 * detail: the PERSISTED pixel_map stores `colorId` slugs (see encode/decode).
 * Convert at the DB boundary with {@link encodePixelMap} / {@link decodePixelMap}.
 *
 * Launch strategy: 31 defined, 19 in stock. The 19 marked `core: true` ship in
 * the first GoBricks order; the 12 `core: false` "fidelity boosters" (incl. all
 * 6 newest colours) are defined but OUT OF STOCK by default until demand (or the
 * ?testPalette=full mode) justifies ordering them. Availability is overridden
 * per-color in DB `brick_stock` (keyed by `colorId`), no deploy needed.
 *
 * OKLab values are precomputed once at module load from the (BrickLink-verified)
 * hex, and are authoritative — they must match the `colors` table seed.
 */
import { hexToRgb, srgbToOklab, type OKLab } from "./color";
import { nearestColorIndex } from "./match";

export type BrickMaterial = "solid" | "transparent" | "metallic";

/** Colour family / usage role. Drives the `displayCode` prefix and DB `role`. */
export type BrickRole = "base" | "skin" | "accent";

export interface BrickColorDef {
  /**
   * Numeric working index — array position, used by the hot matching loops.
   * NOT persisted (the pixel_map stores `colorId`). Kept dense from 0.
   */
  id: number;
  /**
   * Canonical stable slug — the key everything durable references. Optional in
   * ad-hoc/test defs (defaults to a slug of `name` in {@link buildPalette}); the
   * real CATALOG sets it explicitly.
   */
  colorId?: string;
  /** Short code printed in each stud + legend (≤3 chars). Ours, stable. */
  displayCode?: string;
  /** Internal/admin/PDF name (English, stable). */
  name: string;
  /** Customer-facing Hebrew name (shown in the studio + breakdown + PDF). */
  nameHe: string;
  hex: string;
  material: BrickMaterial;
  role?: BrickRole;
  /**
   * Part of the 19-color launch order (in stock by default). `false` = one of
   * the 12 booster colors, defined but out of stock until ordered.
   */
  core: boolean;
}

export interface BrickColor extends BrickColorDef {
  /** Always resolved at build time (see {@link buildPalette}). */
  colorId: string;
  displayCode: string;
  role: BrickRole;
  rgb: [number, number, number];
  oklab: OKLab;
}

/** Fallback slug for ad-hoc defs that omit `colorId` (e.g. test palettes). */
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * The 31-color catalog, grouped by family so `displayCode`s read in order:
 *   N1–N7  neutrals / base    K1–K7  skin / brown    A1–A17  accents
 *
 * `id` (array position) is an internal engine index only — safe to REORDER
 * here because nothing durable stores it (pixel_map stores `colorId`). To add a
 * colour, append a def and grow `LEGACY_ID_TO_SLUG` is NOT required (that maps
 * the OLD numeric scheme). `colorId`/`displayCode` must stay unique + stable.
 */
const DEFAULT_PALETTE_DEFS: BrickColorDef[] = [
  // `id` = the ORIGINAL stable engine index (0–24 for the pre-identity colours,
  // 25–30 appended for the new ones) so legacy integer pixel_maps + brick_stock
  // rows keep working. `displayCode` is family-grouped (N/K/A) independently.
  // Neutrals / base — N
  { id: 0, colorId: "white", displayCode: "N1", name: "White", nameHe: "לבן", hex: "#f2f3f2", material: "solid", role: "base", core: true },
  { id: 1, colorId: "light-bluish-gray", displayCode: "N2", name: "Light Bluish Gray", nameHe: "אפור בהיר", hex: "#a0a5a9", material: "solid", role: "base", core: true },
  { id: 2, colorId: "dark-bluish-gray", displayCode: "N3", name: "Dark Bluish Gray", nameHe: "אפור כהה", hex: "#6c6e68", material: "solid", role: "base", core: true },
  { id: 3, colorId: "black", displayCode: "N4", name: "Black", nameHe: "שחור", hex: "#1b1b1b", material: "solid", role: "base", core: true },
  { id: 23, colorId: "sand", displayCode: "N5", name: "Sand", nameHe: "חול", hex: "#c2b280", material: "solid", role: "base", core: false },
  { id: 25, colorId: "sand-blue", displayCode: "N6", name: "Sand Blue", nameHe: "כחול חול", hex: "#5a748c", material: "solid", role: "base", core: false },
  { id: 26, colorId: "sand-green", displayCode: "N7", name: "Sand Green", nameHe: "ירוק חול", hex: "#7d9c86", material: "solid", role: "base", core: false },
  // Skin / brown — K
  { id: 10, colorId: "light-nougat", displayCode: "K1", name: "Light Nougat", nameHe: "נוגט בהיר", hex: "#f6d7b3", material: "solid", role: "skin", core: true },
  { id: 9, colorId: "nougat", displayCode: "K2", name: "Nougat", nameHe: "נוגט", hex: "#cc8e69", material: "solid", role: "skin", core: true },
  { id: 8, colorId: "medium-nougat", displayCode: "K3", name: "Medium Nougat", nameHe: "נוגט בינוני", hex: "#aa7d55", material: "solid", role: "skin", core: false },
  { id: 6, colorId: "dark-tan", displayCode: "K4", name: "Dark Tan", nameHe: "בז' כהה", hex: "#958a73", material: "solid", role: "skin", core: false },
  { id: 7, colorId: "tan", displayCode: "K5", name: "Tan", nameHe: "בז'", hex: "#e4cd9e", material: "solid", role: "skin", core: true },
  { id: 4, colorId: "reddish-brown", displayCode: "K6", name: "Reddish Brown", nameHe: "חום אדמדם", hex: "#582a12", material: "solid", role: "skin", core: true },
  { id: 5, colorId: "dark-brown", displayCode: "K7", name: "Dark Brown", nameHe: "חום כהה", hex: "#3b2412", material: "solid", role: "skin", core: false },
  // Skin-ramp fill (K8–K15). Added after measuring that four visually distinct
  // skin tones all collapsed onto Medium Nougat — which is what made faces read
  // flat and posterised. These eight subdivide the light→deep ramp so a face
  // gets actual modelling. Chosen by greedily minimising mean OKLab error over
  // a Fitzpatrick I–VI sample (0.0491 → 0.0343).
  { id: 31, colorId: "blush", displayCode: "K8", name: "Blush", nameHe: "ורדרד בהיר", hex: "#ffd7c3", material: "solid", role: "skin", core: true },
  { id: 32, colorId: "light-peach", displayCode: "K9", name: "Light Peach", nameHe: "אפרסק בהיר", hex: "#f2ba93", material: "solid", role: "skin", core: true },
  { id: 33, colorId: "peach", displayCode: "K10", name: "Peach", nameHe: "אפרסק", hex: "#f0c4a0", material: "solid", role: "skin", core: true },
  { id: 34, colorId: "warm-nougat", displayCode: "K11", name: "Warm Nougat", nameHe: "נוגט חם", hex: "#e59e6d", material: "solid", role: "skin", core: true },
  { id: 35, colorId: "taupe", displayCode: "K12", name: "Taupe", nameHe: "טאופ", hex: "#9e7d5e", material: "solid", role: "skin", core: true },
  { id: 36, colorId: "sienna", displayCode: "K13", name: "Sienna", nameHe: "סיינה", hex: "#a65523", material: "solid", role: "skin", core: true },
  { id: 37, colorId: "deep-umber", displayCode: "K14", name: "Deep Umber", nameHe: "חום עמוק", hex: "#693f23", material: "solid", role: "skin", core: true },
  { id: 38, colorId: "coffee", displayCode: "K15", name: "Coffee", nameHe: "חום קפה", hex: "#4e3524", material: "solid", role: "skin", core: true },
  // Accents — A
  { id: 11, colorId: "red", displayCode: "A1", name: "Red", nameHe: "אדום", hex: "#c91a09", material: "solid", role: "accent", core: true },
  { id: 12, colorId: "dark-red", displayCode: "A2", name: "Dark Red", nameHe: "אדום כהה", hex: "#720e0f", material: "solid", role: "accent", core: false },
  { id: 13, colorId: "orange", displayCode: "A3", name: "Orange", nameHe: "כתום", hex: "#fe8a18", material: "solid", role: "accent", core: true },
  { id: 14, colorId: "yellow", displayCode: "A4", name: "Yellow", nameHe: "צהוב", hex: "#f2cd37", material: "solid", role: "accent", core: true },
  { id: 15, colorId: "bright-green", displayCode: "A5", name: "Bright Green", nameHe: "ירוק", hex: "#4b9f4a", material: "solid", role: "accent", core: true },
  { id: 16, colorId: "dark-green", displayCode: "A6", name: "Dark Green", nameHe: "ירוק כהה", hex: "#237841", material: "solid", role: "accent", core: true },
  { id: 27, colorId: "olive-green", displayCode: "A7", name: "Olive Green", nameHe: "ירוק זית", hex: "#9b9a5a", material: "solid", role: "accent", core: false },
  { id: 17, colorId: "blue", displayCode: "A8", name: "Blue", nameHe: "כחול", hex: "#0055bf", material: "solid", role: "accent", core: true },
  { id: 18, colorId: "dark-blue", displayCode: "A9", name: "Dark Blue", nameHe: "כחול כהה", hex: "#0a3463", material: "solid", role: "accent", core: true },
  { id: 19, colorId: "medium-blue", displayCode: "A10", name: "Medium Blue", nameHe: "כחול בינוני", hex: "#5a93db", material: "solid", role: "accent", core: true },
  { id: 20, colorId: "bright-light-blue", displayCode: "A11", name: "Bright Light Blue", nameHe: "תכלת", hex: "#9fc3e9", material: "solid", role: "accent", core: true },
  { id: 24, colorId: "medium-azure", displayCode: "A12", name: "Medium Azure", nameHe: "טורקיז", hex: "#36aebf", material: "solid", role: "accent", core: true },
  { id: 22, colorId: "bright-pink", displayCode: "A13", name: "Bright Pink", nameHe: "ורוד", hex: "#e4adc8", material: "solid", role: "accent", core: true },
  { id: 21, colorId: "dark-pink", displayCode: "A14", name: "Dark Pink", nameHe: "ורוד כהה", hex: "#c870a0", material: "solid", role: "accent", core: false },
  { id: 28, colorId: "light-pink", displayCode: "A15", name: "Light Pink", nameHe: "ורוד בהיר", hex: "#f6adc6", material: "solid", role: "accent", core: false },
  { id: 29, colorId: "medium-lavender", displayCode: "A16", name: "Medium Lavender", nameHe: "לבנדר", hex: "#ac78ba", material: "solid", role: "accent", core: false },
  { id: 30, colorId: "dark-purple", displayCode: "A17", name: "Dark Purple", nameHe: "סגול כהה", hex: "#3f3691", material: "solid", role: "accent", core: false },
];

/**
 * Maps the RETIRED numeric palette (ids 0–24, pre-identity scheme) → `colorId`.
 * Used ONCE by migration 0018 to backfill stored pixel_maps from ints to slugs,
 * and by tests asserting determinism across that remap. Do not extend/reuse —
 * new colours never entered the old numeric scheme.
 */
export const LEGACY_ID_TO_SLUG: Readonly<Record<number, string>> = {
  0: "white", 1: "light-bluish-gray", 2: "dark-bluish-gray", 3: "black",
  4: "reddish-brown", 5: "dark-brown", 6: "dark-tan", 7: "tan",
  8: "medium-nougat", 9: "nougat", 10: "light-nougat", 11: "red",
  12: "dark-red", 13: "orange", 14: "yellow", 15: "bright-green",
  16: "dark-green", 17: "blue", 18: "dark-blue", 19: "medium-blue",
  20: "bright-light-blue", 21: "dark-pink", 22: "bright-pink", 23: "sand",
  24: "medium-azure",
};

/** Build a runtime palette (with rgb + precomputed OKLab) from defs. */
export function buildPalette(defs: BrickColorDef[]): BrickColor[] {
  return defs.map((d) => {
    const rgb = hexToRgb(d.hex);
    return {
      ...d,
      colorId: d.colorId ?? slugify(d.name),
      displayCode: d.displayCode ?? String(d.id),
      role: d.role ?? "accent",
      rgb,
      oklab: srgbToOklab(rgb[0], rgb[1], rgb[2]),
    };
  });
}

/** The full 31-color catalog (every color we could stock). */
export const CATALOG: BrickColor[] = buildPalette(DEFAULT_PALETTE_DEFS);

/** Alias kept for existing imports — the catalog the engine matches against. */
export const DEFAULT_PALETTE: BrickColor[] = CATALOG;

// -------------------------------------------------------- identity lookups
const BY_SLUG = new Map<string, BrickColor>(CATALOG.map((c) => [c.colorId, c]));
const BY_ID = new Map<number, BrickColor>(CATALOG.map((c) => [c.id, c]));

/** Canonical slug → color (or undefined). */
export function colorBySlug(colorId: string): BrickColor | undefined {
  return BY_SLUG.get(colorId);
}

/** Numeric engine index → color (or undefined). */
export function colorByIndex(
  palette: BrickColor[],
  index: number,
): BrickColor | undefined {
  return palette.find((c) => c.id === index);
}

/** Numeric engine index → canonical slug. Throws on unknown id (a bug). */
export function slugForId(id: number): string {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown palette id ${id}`);
  return c.colorId;
}

/** Canonical slug → numeric engine index. Throws on unknown slug (a bug). */
export function idForSlug(colorId: string): number {
  const c = BY_SLUG.get(colorId);
  if (!c) throw new Error(`Unknown colorId "${colorId}"`);
  return c.id;
}

/**
 * Encode an in-memory (integer-indexed) pixel_map to the PERSISTED slug form.
 * Pure. This is the ONLY format written to the DB `pixel_map` column.
 */
export function encodePixelMap(pixelMap: number[][]): string[][] {
  return pixelMap.map((row) => row.map(slugForId));
}

/**
 * Decode a persisted slug pixel_map back to integer indices for the engine /
 * PDF / part-counting. Pure inverse of {@link encodePixelMap}.
 */
export function decodePixelMap(pixelMap: string[][]): number[][] {
  return pixelMap.map((row) => row.map(idForSlug));
}

/** True if `pm` looks like a persisted (slug) pixel_map vs a legacy int one. */
export function isSlugPixelMap(pm: unknown): pm is string[][] {
  return (
    Array.isArray(pm) &&
    pm.length > 0 &&
    Array.isArray(pm[0]) &&
    typeof pm[0][0] === "string"
  );
}

/**
 * Coerce a stored pixel_map (either slug form or a LEGACY integer form from
 * before migration 0018) into engine integer indices. Returns null for a
 * missing/malformed map. Use at every DB read boundary.
 */
export function toEnginePixelMap(
  raw: string[][] | number[][] | null | undefined,
): number[][] | null {
  if (!Array.isArray(raw) || raw.length === 0 || !Array.isArray(raw[0])) {
    return null;
  }
  return isSlugPixelMap(raw) ? decodePixelMap(raw) : (raw as number[][]);
}

/** The 19 core color ids (slugs) that ship in the first order (in stock). */
export const CORE_SLUGS: ReadonlySet<string> = new Set(
  CATALOG.filter((c) => c.core).map((c) => c.colorId),
);

/** True if a color is one of the 19 launch (in-stock-by-default) colors. */
export function isCore(idOrSlug: number | string): boolean {
  const slug = typeof idOrSlug === "number" ? slugForId(idOrSlug) : idOrSlug;
  return CORE_SLUGS.has(slug);
}

/**
 * Build the ACTIVE palette the engine matches against = catalog filtered to a
 * set of enabled color ids (in-stock ∩ user-selected). Accepts EITHER slugs
 * (the durable key, e.g. from brick_stock) or numeric engine ids. Order kept.
 */
export function getActivePalette(
  enabled: Iterable<string | number>,
  catalog: BrickColor[] = CATALOG,
): BrickColor[] {
  const slugs = new Set<string>();
  for (const e of enabled) slugs.add(typeof e === "number" ? slugForId(e) : e);
  return catalog.filter((c) => slugs.has(c.colorId));
}

/**
 * Remap a pixel_map (integer indices) so every cell uses only colors in
 * `targetPalette`. Any index not in the target (e.g. a color that went out of
 * stock) is replaced with the perceptually nearest available color (OKLab).
 * Pure + deterministic.
 */
export function remapPixelMap(
  pixelMap: number[][],
  targetPalette: BrickColor[],
  catalog: BrickColor[] = CATALOG,
): number[][] {
  const targetIds = new Set(targetPalette.map((c) => c.id));
  const catById = new Map(catalog.map((c) => [c.id, c]));
  const cache = new Map<number, number>();

  const resolve = (id: number): number => {
    if (targetIds.has(id)) return id;
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const c = catById.get(id);
    const replacement = c
      ? nearestColorIndex(c.oklab, targetPalette)
      : (targetPalette[0]?.id ?? id);
    cache.set(id, replacement);
    return replacement;
  };

  return pixelMap.map((row) => row.map(resolve));
}

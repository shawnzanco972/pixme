/**
 * Brick palette — the set of available 1x1 plate colors the engine can match
 * against. Modeled on generic GoBricks-style stock. Each entry carries a
 * `material` so the matcher can apply a material-mismatch penalty (CLAUDE.md).
 *
 * Launch strategy: 25 defined, 19 active. We DEFINE 25 colors. The 19 marked
 * `core: true` are stocked in the first GoBricks order (in stock by default) —
 * including cool tones (Bright Light Blue, Medium Azure) for skies/eyes/teal;
 * the 6 `core: false` "fidelity boosters" are defined but OUT OF STOCK by
 * default until demand (or the full-palette test) justifies ordering them.
 *
 * OKLab values are precomputed once at module load for fast matching.
 */
import { hexToRgb, srgbToOklab, type OKLab } from "./color";
import { nearestColorIndex } from "./match";

export type BrickMaterial = "solid" | "transparent" | "metallic";

export interface BrickColorDef {
  /** Stable palette index — this is what gets stored in pixel_map. */
  id: number;
  /** Human-facing name (kept in English; UI localizes separately). */
  name: string;
  hex: string;
  material: BrickMaterial;
  /**
   * Part of the 17-color launch order (in stock by default). `false` = one of
   * the 7 booster colors, defined but out of stock until ordered.
   */
  core: boolean;
}

export interface BrickColor extends BrickColorDef {
  rgb: [number, number, number];
  oklab: OKLab;
}

/**
 * The 24-color launch catalog. `core: true` × 17 = first GoBricks order;
 * `core: false` × 7 = fidelity boosters (out of stock by default).
 *
 * Indices are STABLE and persisted in pixel_map — only ever APPEND new colors;
 * never reorder or remove existing ones (would corrupt stored maps).
 */
const DEFAULT_PALETTE_DEFS: BrickColorDef[] = [
  // Neutrals (4 core)
  { id: 0, name: "White", hex: "#f2f3f2", material: "solid", core: true },
  { id: 1, name: "Light Bluish Gray", hex: "#a0a5a9", material: "solid", core: true },
  { id: 2, name: "Dark Bluish Gray", hex: "#6c6e68", material: "solid", core: true },
  { id: 3, name: "Black", hex: "#1b1b1b", material: "solid", core: true },
  // Skin / brown ramp
  { id: 4, name: "Reddish Brown", hex: "#582a12", material: "solid", core: true },
  { id: 5, name: "Dark Brown", hex: "#3b2412", material: "solid", core: false },
  { id: 6, name: "Dark Tan", hex: "#958a73", material: "solid", core: false },
  { id: 7, name: "Tan", hex: "#e4cd9e", material: "solid", core: true },
  { id: 8, name: "Medium Nougat", hex: "#aa7d55", material: "solid", core: false },
  { id: 9, name: "Nougat", hex: "#cc8e69", material: "solid", core: true },
  { id: 10, name: "Light Nougat", hex: "#f6d7b3", material: "solid", core: true },
  // Reds / warm
  { id: 11, name: "Red", hex: "#c91a09", material: "solid", core: true },
  { id: 12, name: "Dark Red", hex: "#720e0f", material: "solid", core: false },
  { id: 13, name: "Orange", hex: "#fe8a18", material: "solid", core: true },
  { id: 14, name: "Yellow", hex: "#f2cd37", material: "solid", core: true },
  // Greens
  { id: 15, name: "Bright Green", hex: "#4b9f4a", material: "solid", core: true },
  { id: 16, name: "Dark Green", hex: "#237841", material: "solid", core: true },
  // Blues
  { id: 17, name: "Blue", hex: "#0055bf", material: "solid", core: true },
  { id: 18, name: "Dark Blue", hex: "#0a3463", material: "solid", core: true },
  { id: 19, name: "Medium Blue", hex: "#5a93db", material: "solid", core: true },
  { id: 20, name: "Bright Light Blue", hex: "#9fc3e9", material: "solid", core: true },
  // Pinks
  { id: 21, name: "Dark Pink", hex: "#c870a0", material: "solid", core: false },
  { id: 22, name: "Bright Pink", hex: "#e4adc8", material: "solid", core: true },
  // Sand
  { id: 23, name: "Sand", hex: "#c2b280", material: "solid", core: false },
  // Cyan / azure — cool tones (skies, eyes, teal backgrounds)
  { id: 24, name: "Medium Azure", hex: "#36aebf", material: "solid", core: true },
];

/** Build a runtime palette (with rgb + precomputed OKLab) from defs. */
export function buildPalette(defs: BrickColorDef[]): BrickColor[] {
  return defs.map((d) => {
    const rgb = hexToRgb(d.hex);
    return { ...d, rgb, oklab: srgbToOklab(rgb[0], rgb[1], rgb[2]) };
  });
}

/** The full 24-color catalog (every color we could stock). */
export const CATALOG: BrickColor[] = buildPalette(DEFAULT_PALETTE_DEFS);

/** Alias kept for existing imports — the catalog the engine matches against. */
export const DEFAULT_PALETTE: BrickColor[] = CATALOG;

/** The 17 core color ids that ship in the first inventory order (in stock). */
export const CORE_IDS: ReadonlySet<number> = new Set(
  CATALOG.filter((c) => c.core).map((c) => c.id),
);

/** True if a color is one of the 17 launch (in-stock-by-default) colors. */
export function isCore(id: number): boolean {
  return CORE_IDS.has(id);
}

/** Look up a color by its palette index. */
export function colorByIndex(
  palette: BrickColor[],
  index: number,
): BrickColor | undefined {
  return palette.find((c) => c.id === index);
}

/**
 * Build the ACTIVE palette the engine matches against = catalog filtered to a
 * set of enabled color ids (e.g. in-stock ∩ user-selected). Order is preserved.
 */
export function getActivePalette(
  enabledIds: Iterable<number>,
  catalog: BrickColor[] = CATALOG,
): BrickColor[] {
  const set = enabledIds instanceof Set ? enabledIds : new Set(enabledIds);
  return catalog.filter((c) => set.has(c.id));
}

/**
 * Remap a pixel_map so every cell uses only colors in `targetPalette`. Any
 * index not in the target (e.g. a color that went out of stock) is replaced
 * with the perceptually nearest available color (OKLab). Pure + deterministic.
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

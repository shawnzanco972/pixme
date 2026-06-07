/**
 * Brick palette — the set of available 1x1 plate colors the engine can match
 * against. Modeled on generic GoBricks-style stock. Each entry carries a
 * `material` so the matcher can apply a material-mismatch penalty (CLAUDE.md).
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
}

export interface BrickColor extends BrickColorDef {
  rgb: [number, number, number];
  oklab: OKLab;
}

/**
 * Default solid-color palette — a curated GoBricks-compatible stock range
 * (~31 colors) with accurate ABS hex values. Deliberately rich in skin/gray
 * gradations because faces are where fidelity is judged. This IS our physical
 * stock list: the matcher can only ever choose from these shades.
 *
 * Indices are STABLE and persisted in pixel_map — only ever APPEND new colors;
 * never reorder or remove existing ones (would corrupt stored maps).
 */
const DEFAULT_PALETTE_DEFS: BrickColorDef[] = [
  // Neutrals
  { id: 0, name: "White", hex: "#f2f3f2", material: "solid" },
  { id: 1, name: "Light Bluish Gray", hex: "#a0a5a9", material: "solid" },
  { id: 2, name: "Dark Bluish Gray", hex: "#6c6e68", material: "solid" },
  { id: 3, name: "Black", hex: "#1b1b1b", material: "solid" },
  // Browns / skin tones (extra density — faces live here)
  { id: 4, name: "Reddish Brown", hex: "#582a12", material: "solid" },
  { id: 5, name: "Dark Brown", hex: "#3b2412", material: "solid" },
  { id: 6, name: "Dark Tan", hex: "#958a73", material: "solid" },
  { id: 7, name: "Tan", hex: "#e4cd9e", material: "solid" },
  { id: 8, name: "Medium Nougat", hex: "#aa7d55", material: "solid" },
  { id: 9, name: "Nougat", hex: "#cc8e69", material: "solid" },
  { id: 10, name: "Light Nougat", hex: "#f6d7b3", material: "solid" },
  // Reds / warm
  { id: 11, name: "Dark Red", hex: "#720e0f", material: "solid" },
  { id: 12, name: "Red", hex: "#c91a09", material: "solid" },
  { id: 13, name: "Coral", hex: "#ff698f", material: "solid" },
  { id: 14, name: "Orange", hex: "#fe8a18", material: "solid" },
  { id: 15, name: "Bright Light Orange", hex: "#ffa70b", material: "solid" },
  { id: 16, name: "Yellow", hex: "#f2cd37", material: "solid" },
  // Greens
  { id: 17, name: "Lime", hex: "#bbe90b", material: "solid" },
  { id: 18, name: "Bright Green", hex: "#4b9f4a", material: "solid" },
  { id: 19, name: "Dark Green", hex: "#237841", material: "solid" },
  { id: 20, name: "Sand Green", hex: "#a0bcac", material: "solid" },
  // Cyans / blues
  { id: 21, name: "Dark Turquoise", hex: "#008f9b", material: "solid" },
  { id: 22, name: "Medium Azure", hex: "#36aebf", material: "solid" },
  { id: 23, name: "Blue", hex: "#0055bf", material: "solid" },
  { id: 24, name: "Dark Blue", hex: "#0a3463", material: "solid" },
  { id: 25, name: "Medium Blue", hex: "#5a93db", material: "solid" },
  { id: 26, name: "Bright Light Blue", hex: "#9fc3e9", material: "solid" },
  // Purples / pinks
  { id: 27, name: "Dark Purple", hex: "#3f3691", material: "solid" },
  { id: 28, name: "Magenta", hex: "#923978", material: "solid" },
  { id: 29, name: "Dark Pink", hex: "#c870a0", material: "solid" },
  { id: 30, name: "Bright Pink", hex: "#e4adc8", material: "solid" },

  // --- Extended range (appended; richer gradations for photo fidelity) ---
  // Neutrals
  { id: 31, name: "Very Light Bluish Gray", hex: "#d4d6d1", material: "solid" },
  { id: 32, name: "Light Gray", hex: "#bcbcb9", material: "solid" },
  // Skin / warm midtones (faces)
  { id: 33, name: "Light Flesh", hex: "#f5cba9", material: "solid" },
  { id: 34, name: "Medium Dark Flesh", hex: "#c77e4e", material: "solid" },
  { id: 35, name: "Sienna", hex: "#8d5524", material: "solid" },
  { id: 36, name: "Medium Brown", hex: "#5a3a22", material: "solid" },
  { id: 37, name: "Sand", hex: "#c2b280", material: "solid" },
  { id: 38, name: "Dark Orange", hex: "#a85b2a", material: "solid" },
  // Greens
  { id: 39, name: "Olive Green", hex: "#8a8a3a", material: "solid" },
  { id: 40, name: "Medium Green", hex: "#73a86b", material: "solid" },
  // Blues / cyans
  { id: 41, name: "Sky Blue", hex: "#7dbbdd", material: "solid" },
  { id: 42, name: "Sand Blue", hex: "#5e748c", material: "solid" },
  { id: 43, name: "Teal", hex: "#2f6f72", material: "solid" },
  // Purple / pink
  { id: 44, name: "Lavender", hex: "#cda4de", material: "solid" },
  { id: 45, name: "Light Pink", hex: "#f6c3d0", material: "solid" },
];

/** Build a runtime palette (with rgb + precomputed OKLab) from defs. */
export function buildPalette(defs: BrickColorDef[]): BrickColor[] {
  return defs.map((d) => {
    const rgb = hexToRgb(d.hex);
    return { ...d, rgb, oklab: srgbToOklab(rgb[0], rgb[1], rgb[2]) };
  });
}

/** The default runtime palette used by the engine. */
export const DEFAULT_PALETTE: BrickColor[] = buildPalette(DEFAULT_PALETTE_DEFS);

/** Look up a color by its palette index. */
export function colorByIndex(
  palette: BrickColor[],
  index: number,
): BrickColor | undefined {
  return palette.find((c) => c.id === index);
}

/** Full catalog (every color we could ever stock). Alias of DEFAULT_PALETTE. */
export const CATALOG: BrickColor[] = DEFAULT_PALETTE;

/**
 * Recommended STARTER palette — the minimum set worth ordering for good
 * coverage across typical photos (neutrals + a full skin ramp + primaries).
 * This is what the studio enables by default. ~24 colors.
 */
export const RECOMMENDED_IDS: ReadonlySet<number> = new Set([
  0, 1, 2, 3, // neutrals
  4, 5, 6, 7, 8, 9, 10, // browns + skin ramp
  11, 12, 14, 16, // red / orange / yellow
  18, 19, // greens
  23, 24, 25, 26, // blues
  29, 30, // pinks
  37, // sand
]);

export function isRecommended(id: number): boolean {
  return RECOMMENDED_IDS.has(id);
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

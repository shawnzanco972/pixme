/**
 * Brick palette — the set of available 1x1 plate colors the engine can match
 * against. Modeled on generic GoBricks-style stock. Each entry carries a
 * `material` so the matcher can apply a material-mismatch penalty (CLAUDE.md).
 *
 * OKLab values are precomputed once at module load for fast matching.
 */
import { hexToRgb, srgbToOklab, type OKLab } from "./color";

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
 * Default solid-color palette. Indices are STABLE and persisted in pixel_map —
 * only ever append new colors; never reorder or remove existing ones.
 */
const DEFAULT_PALETTE_DEFS: BrickColorDef[] = [
  { id: 0, name: "White", hex: "#f4f4f4", material: "solid" },
  { id: 1, name: "Black", hex: "#1b1b1b", material: "solid" },
  { id: 2, name: "Light Gray", hex: "#a3a2a4", material: "solid" },
  { id: 3, name: "Dark Gray", hex: "#5b5d60", material: "solid" },
  { id: 4, name: "Red", hex: "#c4151c", material: "solid" },
  { id: 5, name: "Dark Red", hex: "#7b1a1a", material: "solid" },
  { id: 6, name: "Orange", hex: "#f57d20", material: "solid" },
  { id: 7, name: "Yellow", hex: "#f5cd2f", material: "solid" },
  { id: 8, name: "Tan", hex: "#e4cd9e", material: "solid" },
  { id: 9, name: "Nougat", hex: "#cc8e69", material: "solid" },
  { id: 10, name: "Reddish Brown", hex: "#6b3f2a", material: "solid" },
  { id: 11, name: "Brown", hex: "#583927", material: "solid" },
  { id: 12, name: "Bright Green", hex: "#4b9f4a", material: "solid" },
  { id: 13, name: "Dark Green", hex: "#237841", material: "solid" },
  { id: 14, name: "Lime", hex: "#a5ca18", material: "solid" },
  { id: 15, name: "Sand Green", hex: "#a0bcac", material: "solid" },
  { id: 16, name: "Blue", hex: "#0055bf", material: "solid" },
  { id: 17, name: "Dark Blue", hex: "#0a3463", material: "solid" },
  { id: 18, name: "Medium Blue", hex: "#5a93db", material: "solid" },
  { id: 19, name: "Azure", hex: "#36aebf", material: "solid" },
  { id: 20, name: "Purple", hex: "#81007b", material: "solid" },
  { id: 21, name: "Magenta", hex: "#923978", material: "solid" },
  { id: 22, name: "Pink", hex: "#e4adc8", material: "solid" },
  { id: 23, name: "Dark Pink", hex: "#c870a0", material: "solid" },
  { id: 24, name: "Medium Nougat", hex: "#aa7d55", material: "solid" },
  { id: 25, name: "Dark Tan", hex: "#958a73", material: "solid" },
  { id: 26, name: "Olive Green", hex: "#9b9a5a", material: "solid" },
  { id: 27, name: "Coral", hex: "#ff698f", material: "solid" },
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

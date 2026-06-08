/**
 * Minimal ambient types for `bidi-js` (ships no types). Covers only the bits we
 * use: building the engine and reordering a logical string into visual order.
 */
declare module "bidi-js" {
  interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: { start: number; end: number; level: number }[];
  }
  interface Bidi {
    getEmbeddingLevels(text: string, baseDirection?: "ltr" | "rtl" | "auto"): EmbeddingLevels;
    getReorderedString(text: string, embeddingLevels: EmbeddingLevels, start?: number, end?: number): string;
    getReorderSegments(text: string, embeddingLevels: EmbeddingLevels, start?: number, end?: number): [number, number][];
    getReorderedIndices(text: string, embeddingLevels: EmbeddingLevels, start?: number, end?: number): number[];
  }
  export default function bidiFactory(): Bidi;
}

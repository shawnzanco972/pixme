/**
 * Bidi reordering for jsPDF.
 *
 * jsPDF draws glyphs left-to-right in the exact code-point order it's given and
 * does NO bidirectional reordering. Hebrew letters don't need contextual
 * shaping (unlike Arabic), but mixed Hebrew + Latin/digits must be reordered
 * from logical order into visual order, or numbers next to Hebrew flip and the
 * line reads as gibberish.
 *
 * `bidi-js` implements the Unicode Bidi Algorithm (UAX #9). We use it to turn a
 * logical string into the visual string jsPDF should actually draw (also
 * mirroring brackets), then render it right-aligned.
 */
import type { jsPDF } from "jspdf";
import bidiFactory from "bidi-js";

const bidi = bidiFactory();

/** Any Hebrew code point present? (so we only reorder when needed). */
export function hasHebrew(s: string): boolean {
  return /[֐-׿]/.test(s);
}

/**
 * Wrap a run that must read left-to-right (a date, a "16×16" dimension) in a
 * Unicode LTR isolate (LRI…PDI). Without this, a numeric token with internal
 * separators inside an RTL line gets reordered ("08/06/2026" → "6202/60/80").
 */
export function ltr(text: string | number): string {
  return `⁦${text}⁩`;
}

/**
 * Reorder a logical string into the visual order jsPDF should draw, for a base
 * RTL paragraph. ASCII-only strings come back unchanged, so it's safe to wrap
 * everything.
 */
export function toVisual(text: string, base: "rtl" | "ltr" = "rtl"): string {
  if (!text) return text;
  const levels = bidi.getEmbeddingLevels(text, base);
  return bidi.getReorderedString(text, levels);
}

/**
 * Counter jsPDF's residual number mangling. Even with `isInputVisual`, jsPDF
 * char-reverses multi-group numeric runs joined by `/` or `×` (so "08/06/2026"
 * → "6202/60/80" and "16×16" → "61×61"); single numbers like "9.81" are left
 * alone. We pre-reverse exactly those runs so jsPDF's reversal restores them.
 * Apply AFTER `toVisual`, right before handing the string to jsPDF.
 */
export function fixNumberRuns(s: string): string {
  return s.replace(/[0-9]+(?:[/×][0-9]+)+/g, (m) => [...m].reverse().join(""));
}

export type HebrewAlign = "right" | "left" | "center";

/**
 * Build a Hebrew-aware text writer for a jsPDF doc. It pre-shapes to visual
 * order, counters jsPDF's number mangling, and positions manually (jsPDF's own
 * `align`/bidi for RTL is unreliable). `x` is the right edge for "right", the
 * left edge for "left", the centre for "center". A Hebrew font must be set on
 * the doc first.
 */
export function makeHebrewWriter(doc: jsPDF) {
  return (text: string | number, x: number, y: number, align: HebrewAlign = "right") => {
    const s = fixNumberRuns(toVisual(String(text)));
    const w = doc.getTextWidth(s);
    const xx = align === "left" ? x : align === "center" ? x - w / 2 : x - w;
    doc.text(s, xx, y, { isInputVisual: true });
  };
}

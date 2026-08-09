/**
 * Adaptive palette selection — pick the best N colours for THIS image.
 *
 * Matching against the full catalogue always yields the lowest error, so this
 * is NOT an accuracy feature: it's a style and cost control. Fewer colours give
 * a bolder, poster-like look, and — because Pixipic packs kits by weight, bag
 * per colour — a kit with 18 colours is materially faster to pack than one with
 * 39. What this buys is that a 18-colour mosaic is chosen *well* for the
 * specific photo instead of being an arbitrary subset.
 *
 * Method: greedy facility-location / k-median. Repeatedly add whichever
 * remaining colour most reduces total weighted error across the image. Cost is
 * kept sane by binning the target colours into an OKLab histogram first, so the
 * inner loop is O(bins × candidates) rather than O(cells × candidates).
 *
 * DETERMINISTIC (CLAUDE.md): no RNG, and ties resolve to the earlier catalogue
 * entry, so the same image+options always selects the same colours — the
 * persisted pixel_map stays reproducible.
 */
import { type OKLab } from "./color";
import { effectiveDistanceSq, type MatchOptions } from "./match";
import type { BrickColor } from "./palette";

/** Bins per axis for the OKLab histogram. 16³ ceiling; real images use far less. */
const BINS = 16;
/** a/b span assumed when binning (OKLab chroma axes sit well inside ±0.4). */
const AB_SPAN = 0.4;

interface Bin {
  lab: OKLab;
  weight: number;
}

/** Collapse per-cell targets into a weighted OKLab histogram. */
function histogram(targets: OKLab[]): Bin[] {
  const acc = new Map<number, { L: number; a: number; b: number; w: number }>();
  const q = (v: number) =>
    Math.max(0, Math.min(BINS - 1, Math.round(v * (BINS - 1))));

  for (const t of targets) {
    const li = q(t.L);
    const ai = q((t.a + AB_SPAN) / (2 * AB_SPAN));
    const bi = q((t.b + AB_SPAN) / (2 * AB_SPAN));
    const key = (li * BINS + ai) * BINS + bi;
    const cur = acc.get(key);
    if (cur) {
      cur.L += t.L;
      cur.a += t.a;
      cur.b += t.b;
      cur.w += 1;
    } else {
      acc.set(key, { L: t.L, a: t.a, b: t.b, w: 1 });
    }
  }

  // Representative colour of a bin = the mean of the cells that fell in it.
  // Iterate the map in insertion order so the result is deterministic.
  const out: Bin[] = [];
  for (const v of acc.values()) {
    out.push({ lab: { L: v.L / v.w, a: v.a / v.w, b: v.b / v.w }, weight: v.w });
  }
  return out;
}

/**
 * Choose `count` colours from `catalog` that best represent `targets`.
 * Returns them in CATALOG order (not selection order). If `count` covers the
 * whole catalogue the catalogue is returned untouched.
 */
export function selectAdaptivePalette(
  targets: OKLab[],
  catalog: BrickColor[],
  count: number,
  opts: MatchOptions = {},
): BrickColor[] {
  if (catalog.length === 0) return catalog;
  const n = Math.max(1, Math.min(Math.floor(count), catalog.length));
  if (n >= catalog.length || targets.length === 0) return catalog;

  const bins = histogram(targets);
  // Best (smallest) cost seen so far for each bin, given the colours chosen.
  const best = new Float64Array(bins.length).fill(Number.POSITIVE_INFINITY);
  const chosen = new Set<number>();

  for (let k = 0; k < n; k++) {
    let bestCand: BrickColor | null = null;
    let bestTotal = Number.POSITIVE_INFINITY;

    for (const cand of catalog) {
      if (chosen.has(cand.id)) continue;
      let total = 0;
      for (let i = 0; i < bins.length; i++) {
        const d = effectiveDistanceSq(bins[i].lab, cand, opts);
        total += bins[i].weight * (d < best[i] ? d : best[i]);
        // Early out: this candidate can't win any more.
        if (total >= bestTotal) break;
      }
      // Strict `<` means ties keep the earlier catalogue entry → deterministic.
      if (total < bestTotal) {
        bestTotal = total;
        bestCand = cand;
      }
    }

    if (!bestCand) break;
    chosen.add(bestCand.id);
    for (let i = 0; i < bins.length; i++) {
      const d = effectiveDistanceSq(bins[i].lab, bestCand, opts);
      if (d < best[i]) best[i] = d;
    }
  }

  return catalog.filter((c) => chosen.has(c.id));
}

/**
 * Tiny seeded PRNG (mulberry32). Deterministic so the engine produces a stable
 * pixel_map for a given image+options — important because the map is persisted
 * and later trusted by the PDF route.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Signed noise in [-amount, +amount). */
export function signedNoise(rng: Rng, amount: number): number {
  return (rng() * 2 - 1) * amount;
}

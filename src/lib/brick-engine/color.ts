/**
 * Color science for the Brick Engine.
 *
 * Per project rules (CLAUDE.md): never match colors in raw sRGB. We convert
 * sRGB → linear → OKLab (perceptually uniform, Björn Ottosson 2020) so that
 * averaging and nearest-color matching behave the way human vision does — this
 * is what prevents muddy mixes and the classic "green skin tone" failure.
 */

/** OKLab color: L (lightness), a (green↔red), b (blue↔yellow). */
export interface OKLab {
  L: number;
  a: number;
  b: number;
}

/** A single sRGB channel value (0–255) → linear-light [0,1]. */
export function srgbChannelToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear-light [0,1] → sRGB channel (0–255, rounded). */
export function linearToSrgbChannel(c: number): number {
  const v =
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/** Linear-light RGB (each [0,1]) → OKLab. */
export function linearRgbToOklab(r: number, g: number, b: number): OKLab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** OKLab → linear-light RGB (each [0,1], not clamped to gamut). */
export function oklabToLinearRgb(lab: OKLab): [number, number, number] {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** sRGB (0–255 per channel) → OKLab. */
export function srgbToOklab(r8: number, g8: number, b8: number): OKLab {
  return linearRgbToOklab(
    srgbChannelToLinear(r8),
    srgbChannelToLinear(g8),
    srgbChannelToLinear(b8),
  );
}

/** OKLab → sRGB (0–255 per channel, gamut-clamped). */
export function oklabToSrgb(lab: OKLab): [number, number, number] {
  const [r, g, b] = oklabToLinearRgb(lab);
  return [
    linearToSrgbChannel(r),
    linearToSrgbChannel(g),
    linearToSrgbChannel(b),
  ];
}

/** Parse a #rrggbb hex string into an sRGB tuple (0–255). */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Squared Euclidean distance in OKLab (cheaper; monotonic with distance). */
export function oklabDistanceSq(x: OKLab, y: OKLab): number {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return dL * dL + da * da + db * db;
}

/** Euclidean distance in OKLab. */
export function oklabDistance(x: OKLab, y: OKLab): number {
  return Math.sqrt(oklabDistanceSq(x, y));
}

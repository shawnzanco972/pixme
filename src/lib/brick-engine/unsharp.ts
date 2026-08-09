/**
 * Unsharp mask — local contrast, at STUD scale.
 *
 * Coarse downsampling to studs averages away local contrast, which is why an
 * un-enhanced mosaic reads flat and grey: a face loses the light/shadow
 * modelling that made it look three-dimensional, and lettering blurs into its
 * background before it ever reaches the matcher.
 *
 * The critical detail is the RADIUS. This used to be a fixed 3×3 blur on the
 * full-resolution image — on a 3000px photo reduced to 48 studs, each stud
 * covers ~60px, so a 3px sharpen operated ~60× finer than a brick and did
 * essentially nothing to the structure that survives downsampling. The radius
 * must be tied to the stud size, so we amplify exactly the detail band that
 * ends up on the board.
 *
 * Unlike a global contrast/saturation boost this does NOT inflate chroma
 * overall — it only widens differences across local edges — so it adds depth
 * without dragging warm skin toward red (see design-settings.ts).
 *
 * Blur is a running-sum box blur: O(pixels) regardless of radius.
 */
import type { RGBAImage } from "./quantize";

/** Separable running-sum box blur (radius r) over the RGB planes. */
function boxBlur(
  src: Uint8ClampedArray,
  dst: Float32Array,
  w: number,
  h: number,
  r: number,
): void {
  const tmp = new Float32Array(w * h * 3);
  const win = 2 * r + 1;

  // Horizontal pass.
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      // Prime the window with clamped edge samples.
      for (let x = -r; x <= r; x++) {
        const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
        sum += src[(row + cx) * 4 + c];
      }
      for (let x = 0; x < w; x++) {
        tmp[(row + x) * 3 + c] = sum / win;
        const outX = x - r;
        const inX = x + r + 1;
        sum -= src[(row + (outX < 0 ? 0 : outX)) * 4 + c];
        sum += src[(row + (inX >= w ? w - 1 : inX)) * 4 + c];
      }
    }
  }

  // Vertical pass.
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) {
        const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
        sum += tmp[(cy * w + x) * 3 + c];
      }
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * 3 + c] = sum / win;
        const outY = y - r;
        const inY = y + r + 1;
        sum -= tmp[((outY < 0 ? 0 : outY) * w + x) * 3 + c];
        sum += tmp[((inY >= h ? h - 1 : inY) * w + x) * 3 + c];
      }
    }
  }
}

/**
 * Return a locally-contrast-enhanced copy.
 *
 * @param amount strength; 0 = untouched, ~0.4 subtle, ~1.2 strong (line art).
 * @param radius blur radius in SOURCE pixels. Pass roughly half a stud —
 *               see `studRadius()`.
 */
export function unsharpMask(
  image: RGBAImage,
  amount = 0.8,
  radius = 1,
): RGBAImage {
  const { data, width: w, height: h } = image;
  if (amount <= 0 || w < 2 || h < 2) return image;
  const r = Math.max(1, Math.min(Math.round(radius), Math.floor(Math.min(w, h) / 2) - 1 || 1));

  const blur = new Float32Array(w * h * 3);
  boxBlur(data, blur, w, h, r);

  const out = new Uint8ClampedArray(data.length);
  for (let p = 0, i = 0; i < data.length; p++, i += 4) {
    for (let c = 0; c < 3; c++) {
      const orig = data[i + c];
      const hi = orig - blur[p * 3 + c]; // detail at ~stud scale
      out[i + c] = clamp255(orig + amount * hi);
    }
    out[i + 3] = data[i + 3];
  }
  return { data: out, width: w, height: h };
}

/**
 * Blur radius that matches the mosaic's stud pitch: half a stud in source
 * pixels. This is the band the board can actually reproduce.
 */
export function studRadius(
  srcW: number,
  srcH: number,
  cols: number,
  rows: number,
): number {
  const perStud = Math.min(srcW / Math.max(1, cols), srcH / Math.max(1, rows));
  return Math.max(1, Math.round(perStud * 0.5));
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

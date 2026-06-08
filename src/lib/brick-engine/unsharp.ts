/**
 * Unsharp mask — edge crisping for the line-art / text mode.
 *
 * Coarse downsampling to studs blurs thin features (letter strokes, logo
 * outlines) until they vanish. Sharpening the full-res image first widens the
 * contrast across those edges so they survive quantization and stay legible.
 *
 * Classic unsharp: sharpened = original + amount × (original − blurred). We use
 * a cheap separable 3×3 box blur as the low-pass; that's plenty given the image
 * is about to be reduced to a few thousand studs anyway.
 */
import type { RGBAImage } from "./quantize";

/** 3×3 box-blur one channel-plane (RGB interleaved) into `dst`. */
function boxBlur(
  src: Uint8ClampedArray,
  dst: Float32Array,
  w: number,
  h: number,
): void {
  // Horizontal then vertical pass via a temp buffer (separable box blur).
  const tmp = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let cnt = 0;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          sum += src[(y * w + nx) * 4 + c];
          cnt++;
        }
        tmp[(y * w + x) * 3 + c] = sum / cnt;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          sum += tmp[(ny * w + x) * 3 + c];
          cnt++;
        }
        dst[(y * w + x) * 3 + c] = sum / cnt;
      }
    }
  }
}

/**
 * Return a sharpened copy of the image. `amount` controls strength (default
 * 0.8 — strong, because the detail is about to be decimated by downsampling).
 */
export function unsharpMask(image: RGBAImage, amount = 0.8): RGBAImage {
  const { data, width: w, height: h } = image;
  const blur = new Float32Array(w * h * 3);
  boxBlur(data, blur, w, h);

  const out = new Uint8ClampedArray(data.length);
  for (let p = 0, i = 0; i < data.length; p++, i += 4) {
    for (let c = 0; c < 3; c++) {
      const orig = data[i + c];
      const hi = orig - blur[p * 3 + c]; // high-frequency detail
      out[i + c] = clamp255(orig + amount * hi);
    }
    out[i + 3] = data[i + 3];
  }
  return { data: out, width: w, height: h };
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

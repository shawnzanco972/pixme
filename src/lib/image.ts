/**
 * Client-side image helpers (browser only).
 *
 * Decodes an uploaded File into ImageData for the Brick Engine worker. We
 * downscale large photos first — the engine only needs enough resolution to
 * average each stud's block, so this keeps the worker fast and memory light.
 */

/** Decode + (optionally) downscale a File to ImageData. */
export async function fileToImageData(
  file: File,
  maxDimension = 1024,
): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    // Composite over WHITE so transparent PNGs don't become dark/brown blocks.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } finally {
    bitmap.close();
  }
}

/**
 * Center-crop ImageData to a target aspect ratio (cover) with an optional
 * `zoom` (>1 crops tighter into the center = more studs on the subject). This
 * decouples framing from the baseplate grid: changing plate count keeps the
 * same crop, and the zoom slider recomposes independently.
 */
export function cropToAspect(
  src: ImageData,
  aspectW: number,
  aspectH: number,
  zoom = 1,
  centerX = 0.5,
  centerY = 0.5,
): ImageData {
  const targetAR = aspectW / aspectH;
  const srcAR = src.width / src.height;

  // Largest centered rect of the target aspect that fits the source...
  let cw: number;
  let ch: number;
  if (srcAR > targetAR) {
    ch = src.height;
    cw = src.height * targetAR;
  } else {
    cw = src.width;
    ch = src.width / targetAR;
  }
  // ...then zoom in (crop tighter).
  const z = Math.max(1, zoom);
  cw = Math.max(1, Math.round(cw / z));
  ch = Math.max(1, Math.round(ch / z));

  if (cw === src.width && ch === src.height) return src;

  // Position the crop window at (centerX, centerY), clamped to image bounds.
  const ox = clamp(Math.round(centerX * src.width - cw / 2), 0, src.width - cw);
  const oy = clamp(Math.round(centerY * src.height - ch / 2), 0, src.height - ch);

  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.putImageData(src, 0, 0);
  return ctx.getImageData(ox, oy, cw, ch);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Paint a preview RGBA buffer onto a canvas element at integer scale. */
export function paintToCanvas(
  canvas: HTMLCanvasElement,
  rgba: { data: Uint8ClampedArray; width: number; height: number },
) {
  canvas.width = rgba.width;
  canvas.height = rgba.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(rgba.width, rgba.height);
  img.data.set(rgba.data);
  ctx.putImageData(img, 0, 0);
}

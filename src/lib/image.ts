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
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } finally {
    bitmap.close();
  }
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

"use client";
/**
 * Realistic studded-brick preview renderer.
 *
 * Instead of flat colored squares, each cell is drawn as a 3D-looking brick
 * stud: a raised cylinder with a top-left highlight and bottom-right shadow,
 * sitting on a slightly darker plate with a thin gap. This is what makes the
 * preview read as the physical LEGO-compatible product rather than "pixels".
 *
 * Per-color stud tiles are rendered once and cached, then blitted per cell, so
 * even a 72×72 (5,184-stud) mosaic paints in a few milliseconds.
 */
import { DEFAULT_PALETTE, type BrickColor } from "@/lib/brick-engine";

type RGB = [number, number, number];

function mix(c: RGB, target: number, t: number): RGB {
  return [
    Math.round(c[0] + (target - c[0]) * t),
    Math.round(c[1] + (target - c[1]) * t),
    Math.round(c[2] + (target - c[2]) * t),
  ];
}
const lighten = (c: RGB, t: number) => mix(c, 255, t);
const darken = (c: RGB, t: number) => mix(c, 0, t);
const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Build a single brick-stud tile (size×size) for a base color. */
function makeStudTile(color: RGB, size: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;

  // Plate (the area between studs) — slightly darker, with a thin gap border.
  ctx.fillStyle = css(darken(color, 0.28));
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = css(darken(color, 0.08));
  const inset = Math.max(0.5, size * 0.045);
  ctx.fillRect(inset, inset, size - 2 * inset, size - 2 * inset);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;

  // Drop shadow under the stud (offset toward bottom-right).
  ctx.beginPath();
  ctx.arc(cx + size * 0.05, cy + size * 0.06, r, 0, Math.PI * 2);
  ctx.fillStyle = css(darken(color, 0.4));
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Stud top — radial gradient lit from top-left.
  const g = ctx.createRadialGradient(
    cx - r * 0.4,
    cy - r * 0.4,
    r * 0.1,
    cx,
    cy,
    r,
  );
  g.addColorStop(0, css(lighten(color, 0.32)));
  g.addColorStop(0.65, css(color));
  g.addColorStop(1, css(darken(color, 0.16)));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // Specular highlight dot, top-left.
  ctx.beginPath();
  ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = css(lighten(color, 0.55));
  ctx.globalAlpha = 0.45;
  ctx.fill();
  ctx.globalAlpha = 1;

  return cv;
}

/**
 * Render a pixel_map as studded bricks onto a canvas.
 * @param studPx pixels per stud in the render buffer (display can scale down).
 */
export function renderBricks(
  canvas: HTMLCanvasElement,
  pixelMap: number[][],
  palette: BrickColor[] = DEFAULT_PALETTE,
  studPx = 14,
): void {
  const rows = pixelMap.length;
  const cols = rows > 0 ? pixelMap[0].length : 0;
  if (!cols || !rows) return;

  canvas.width = cols * studPx;
  canvas.height = rows * studPx;
  const ctx = canvas.getContext("2d")!;

  const rgbById = new Map<number, RGB>(palette.map((c) => [c.id, c.rgb]));
  const tiles = new Map<number, HTMLCanvasElement>();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const id = pixelMap[y][x];
      let tile = tiles.get(id);
      if (!tile) {
        tile = makeStudTile(rgbById.get(id) ?? [0, 0, 0], studPx);
        tiles.set(id, tile);
      }
      ctx.drawImage(tile, x * studPx, y * studPx);
    }
  }
}

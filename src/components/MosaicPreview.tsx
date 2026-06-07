/**
 * Server-renderable mosaic preview from a pixel_map (SVG, no canvas/DOM).
 * Uses horizontal run-length so even a 120×120 map is a few hundred rects.
 * Shown in the admin so every order displays its design even when the original
 * photo is missing.
 */
import type { ReactNode } from "react";

import { CATALOG, type BrickColor } from "@/lib/brick-engine/palette";

export function MosaicPreview({
  pixelMap,
  palette = CATALOG,
  className,
}: {
  pixelMap: number[][];
  palette?: BrickColor[];
  className?: string;
}) {
  const rows = pixelMap.length;
  const cols = rows > 0 ? pixelMap[0].length : 0;
  if (!cols || !rows) return null;

  const byId = new Map<number, [number, number, number]>(
    palette.map((c) => [c.id, c.rgb]),
  );

  const rects: ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      const id = pixelMap[y][x];
      let w = 1;
      while (x + w < cols && pixelMap[y][x + w] === id) w++;
      const [r, g, b] = byId.get(id) ?? [0, 0, 0];
      rects.push(
        <rect
          key={`${y}-${x}`}
          x={x}
          y={y}
          width={w}
          height={1}
          fill={`rgb(${r},${g},${b})`}
        />,
      );
      x += w;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      className={className}
      shapeRendering="crispEdges"
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="תצוגת פסיפס"
    >
      {rects}
    </svg>
  );
}

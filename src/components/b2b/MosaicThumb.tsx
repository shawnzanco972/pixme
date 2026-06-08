"use client";
/**
 * Renders a stored pixel_map to a small canvas so the project owner can see each
 * employee's mosaic at a glance. Uses the same renderer as the studio preview.
 */
import { useEffect, useRef } from "react";

import { renderBricks } from "@/lib/brick-render";

export function MosaicThumb({
  pixelMap,
  className = "",
}: {
  pixelMap: number[][];
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && pixelMap.length > 0) {
      renderBricks(canvasRef.current, pixelMap);
    }
  }, [pixelMap]);

  const cols = pixelMap[0]?.length ?? 1;
  const rows = pixelMap.length;

  return (
    <canvas
      ref={canvasRef}
      className={`rounded-lg border border-outline bg-surface-muted object-contain ${className}`}
      style={{ aspectRatio: `${cols} / ${rows}` }}
    />
  );
}

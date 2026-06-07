"use client";
/**
 * Higher-level preview hook built on useBrickWorker. Handler-driven (no
 * effects): call `process(file, size)` from an event handler to decode, run the
 * engine, paint a canvas, and get back the pixel_map.
 */
import { useCallback, useRef, useState } from "react";

import { type BrickifyOptions } from "@/lib/brick-engine";
import { useBrickWorker } from "@/lib/brick-engine/useBrickWorker";
import { renderBricks } from "@/lib/brick-render";
import { fileToImageData } from "@/lib/image";

export function useBrickPreview() {
  const { brickify } = useBrickWorker();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixelMap, setPixelMap] = useState<number[][] | null>(null);
  const [working, setWorking] = useState(false);

  const process = useCallback(
    async (
      file: File,
      size: number,
      extra?: Omit<BrickifyOptions, "cols" | "rows">,
    ): Promise<number[][]> => {
      setWorking(true);
      try {
        const imageData = await fileToImageData(file);
        const { pixelMap: map } = await brickify(imageData, {
          cols: size,
          rows: size,
          ...extra,
        });
        if (canvasRef.current) renderBricks(canvasRef.current, map);
        setPixelMap(map);
        return map;
      } finally {
        setWorking(false);
      }
    },
    [brickify],
  );

  return { canvasRef, pixelMap, working, process };
}

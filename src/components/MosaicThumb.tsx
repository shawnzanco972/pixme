"use client";
/**
 * Renders a ready-made design as an actual brick mosaic (studded canvas) using
 * the admin's saved engine settings — so customers see the product they buy,
 * not the source artwork. Used on the homepage gallery and the studio's
 * suggestions strip.
 *
 * The canvas keeps the design's true aspect ratio (platesX:platesY) so wide art
 * gets wide thumbnails instead of being cropped to a square. For performance the
 * matching grid is capped (full fidelity isn't needed at thumbnail size).
 */
import { useEffect, useRef, useState } from "react";

import { brickifyImage } from "@/lib/brick-engine";
import { renderBricks } from "@/lib/brick-render";
import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from "@/lib/design-settings";
import { cropToAspect, fileToImageData } from "@/lib/image";

const PLATE_STUDS = 24;
const MAX_GRID = 72; // cap the longest edge of the matching grid

export function MosaicThumb({
  imageUrl,
  platesX,
  platesY,
  settings,
  studPx = 4,
  className,
}: {
  imageUrl: string;
  platesX: number;
  platesY: number;
  settings?: EngineSettings;
  studPx?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  // Stable dependency key: callers often build `settings` inline (new object
  // every render), which would otherwise re-run the effect on every render.
  const settingsKey = JSON.stringify(settings ?? null);

  useEffect(() => {
    let cancelled = false;
    const s = settings ?? DEFAULT_ENGINE_SETTINGS;
    (async () => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const file = new File([blob], "design", {
          type: blob.type || "image/png",
        });
        const image = await fileToImageData(file);
        if (cancelled) return;

        // Preserve aspect ratio; scale the grid down so big designs stay fast.
        const fullCols = platesX * PLATE_STUDS;
        const fullRows = platesY * PLATE_STUDS;
        const scale = Math.min(1, MAX_GRID / Math.max(fullCols, fullRows));
        const cols = Math.max(8, Math.round(fullCols * scale));
        const rows = Math.max(8, Math.round(fullRows * scale));

        const cropped = cropToAspect(image, cols, rows, s.zoom, s.panX, s.panY);
        const { pixelMap } = brickifyImage(cropped, {
          cols,
          rows,
          preprocess: {
            contrast: s.contrast,
            saturation: s.saturation,
            autoLevels: s.autoLevels,
            faceAware: s.faceAware,
            lineArt: s.lineArt,
          },
          dither: s.dither > 0 ? { amount: s.dither } : null,
          fsDither: s.smoothGradients,
        });
        if (cancelled || !ref.current) return;
        renderBricks(ref.current, pixelMap, undefined, studPx);
        setReady(true);
      } catch {
        /* leave the canvas blank on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
    // settings is captured via settingsKey to keep the dep stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, platesX, platesY, settingsKey, studPx]);

  return (
    <canvas
      ref={ref}
      className={`${className ?? ""} ${ready ? "" : "animate-pulse bg-surface-muted"}`}
    />
  );
}

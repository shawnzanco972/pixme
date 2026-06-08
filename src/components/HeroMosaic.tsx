"use client";
/**
 * Hero showpiece — one starter rendered as a real brick mosaic in a tilted,
 * framed "canvas on the wall" card, so the landing hero shows actual output
 * instead of a stock photo. Pure client; runs the engine on a small grid.
 */
import { useEffect, useRef } from "react";

import { brickifyImage } from "@/lib/brick-engine";
import { renderBricks } from "@/lib/brick-render";
import { renderStarterImageData } from "@/lib/starters";

export function HeroMosaic({ starter = "smiley" }: { starter?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = renderStarterImageData(starter, 320);
    if (!image || !ref.current) return;
    const { pixelMap } = brickifyImage(image, { cols: 56, rows: 56 });
    renderBricks(ref.current, pixelMap, undefined, 8);
  }, [starter]);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="card rotate-[-3deg] p-3 shadow-lg transition-transform hover:rotate-0">
        <canvas ref={ref} className="w-full rounded-xl" />
      </div>
      <div className="card absolute -bottom-4 -start-4 rotate-[6deg] px-4 py-2 text-sm font-heading font-bold text-primary shadow-md">
        מהתמונה שלכם → ללבנים
      </div>
    </div>
  );
}

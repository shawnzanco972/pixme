"use client";
/**
 * Hero showpiece — a real brick mosaic in a tilted, framed "canvas on the wall"
 * card, so the landing hero shows actual product output instead of a stock
 * photo. Defaults to the built-in smiley starter; the admin can instead point it
 * at a chosen ready-made design (rendered through the same engine).
 */
import { useEffect, useRef } from "react";

import { MosaicThumb } from "@/components/MosaicThumb";
import { brickifyImage } from "@/lib/brick-engine";
import { renderBricks } from "@/lib/brick-render";
import type { EngineSettings } from "@/lib/design-settings";
import { renderStarterImageData } from "@/lib/starters";

export interface HeroDesign {
  imageUrl: string;
  platesX: number;
  platesY: number;
  settings?: EngineSettings;
}

export function HeroMosaic({
  starter = "smiley",
  design,
}: {
  starter?: string;
  design?: HeroDesign;
}) {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="card flex rotate-[-3deg] items-center justify-center p-3 shadow-lg transition-transform hover:rotate-0">
        {design ? (
          <MosaicThumb
            imageUrl={design.imageUrl}
            platesX={design.platesX}
            platesY={design.platesY}
            settings={design.settings}
            studPx={8}
            className="max-h-80 max-w-full rounded-xl"
          />
        ) : (
          <StarterCanvas starter={starter} />
        )}
      </div>
      <div className="card absolute -bottom-4 -start-4 rotate-[6deg] px-4 py-2 text-sm font-heading font-bold text-primary shadow-md">
        מהתמונה שלכם ← לקיר מלבנים
      </div>
    </div>
  );
}

function StarterCanvas({ starter }: { starter: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = renderStarterImageData(starter, 320);
    if (!image || !ref.current) return;
    const { pixelMap } = brickifyImage(image, { cols: 56, rows: 56 });
    renderBricks(ref.current, pixelMap, undefined, 8);
  }, [starter]);
  return <canvas ref={ref} className="w-full rounded-xl" />;
}

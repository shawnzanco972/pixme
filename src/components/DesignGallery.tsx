"use client";
/**
 * Homepage ready-made gallery grid (client). Renders each design as a brick
 * mosaic with no surrounding card/box — just the artwork + caption. Items share
 * a fixed height so different aspect ratios line up evenly; wide designs simply
 * take more width, filling the row. Shows the first 6, then a "show more"
 * toggle (a dedicated gallery page will replace this section eventually).
 */
import { useState } from "react";
import Link from "next/link";

import { MosaicThumb } from "@/components/MosaicThumb";
import type { EngineSettings } from "@/lib/design-settings";

const CM_PER_PLATE = 19.2;
const INITIAL_COUNT = 6;

export interface GalleryDesign {
  id: string;
  title: string;
  imageUrl: string;
  platesX: number;
  platesY: number;
  brickCount: number;
  settings: EngineSettings;
}

export function DesignGallery({ designs }: { designs: GalleryDesign[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? designs : designs.slice(0, INITIAL_COUNT);
  const hasMore = designs.length > INITIAL_COUNT;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-10">
        {visible.map((d) => (
          <Link
            key={d.id}
            href={`/create?design=${d.id}`}
            className="group flex flex-col items-center gap-3"
          >
            <div className="flex h-44 items-end justify-center sm:h-52">
              <MosaicThumb
                imageUrl={d.imageUrl}
                platesX={d.platesX}
                platesY={d.platesY}
                settings={d.settings}
                studPx={6}
                className="max-h-full max-w-[18rem] rounded-md shadow-md transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg"
              />
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="font-heading text-base font-semibold">
                {d.title}
              </span>
              <span className="text-xs text-foreground/60">
                {Math.round(d.platesX * CM_PER_PLATE)}×
                {Math.round(d.platesY * CM_PER_PLATE)} ס״מ ·{" "}
                {d.brickCount.toLocaleString("he-IL")} לבנים
              </span>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="btn btn-ghost"
        >
          {expanded ? "הצגת פחות" : `הצגת עוד (${designs.length - INITIAL_COUNT}) ←`}
        </button>
      )}
    </div>
  );
}

"use client";
/**
 * Landing showcase — renders a few starter designs as ACTUAL brick mosaics
 * (engine + studded render) so visitors see the real output quality. Pure
 * client; runs the engine synchronously on small grids.
 */
import { useEffect, useRef } from "react";
import Link from "next/link";

import { brickifyImage } from "@/lib/brick-engine";
import { renderBricks } from "@/lib/brick-render";
import { renderStarterImageData } from "@/lib/starters";

const ITEMS = [
  { id: "flag", label: "דגל ישראל" },
  { id: "heart", label: "לב" },
  { id: "smiley", label: "סמיילי" },
  { id: "star", label: "כוכב" },
];

function ShowcaseTile({ id, label }: { id: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = renderStarterImageData(id, 240);
    if (!image || !ref.current) return;
    const { pixelMap } = brickifyImage(image, { cols: 48, rows: 48 });
    renderBricks(ref.current, pixelMap, undefined, 7);
  }, [id]);

  return (
    <Link
      href="/create"
      className="card group flex flex-col items-center gap-2 p-3 transition-transform hover:-translate-y-1"
    >
      <canvas ref={ref} className="w-full rounded-lg" />
      <span className="font-heading text-sm font-medium">{label}</span>
    </Link>
  );
}

export function StarterShowcase() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {ITEMS.map((it) => (
        <ShowcaseTile key={it.id} id={it.id} label={it.label} />
      ))}
    </div>
  );
}

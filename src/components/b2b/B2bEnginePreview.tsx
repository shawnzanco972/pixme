"use client";
/**
 * B2B live engine preview — a trimmed Studio for the landing page. It exists to
 * SHOW how the brick engine works (upload a photo / pick a design → live OKLab
 * preview with colors + settings), NOT to place an order. So it has no form, no
 * price, and no size controls: the size (cols×rows) is driven by the calculator
 * section above, so the two stay in sync.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type BrickifyResult } from "@/lib/brick-engine";
import { BrickSwatch } from "@/components/b2c/BrickSwatch";
import { getActivePalette } from "@/lib/brick-engine/palette";
import { useBrickWorker } from "@/lib/brick-engine/useBrickWorker";
import { usePaletteInventory } from "@/lib/brick-engine/usePaletteInventory";
import { renderBricks } from "@/lib/brick-render";
import { cropToAspect, fileToImageData } from "@/lib/image";
import { STARTERS, renderStarter } from "@/lib/starters";

const STARTER_EMOJI: Record<string, string> = {
  heart: "❤️",
  star: "⭐",
  "magen-david": "✡️",
  smiley: "🙂",
  flag: "🇮🇱",
  paw: "🐾",
  gift: "🎁",
  checker: "♟️",
};

export function B2bEnginePreview({ cols, rows }: { cols: number; rows: number }) {
  const { brickify } = useBrickWorker();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [, setResult] = useState<BrickifyResult | null>(null);
  const [working, setWorking] = useState(false);

  const [contrast, setContrast] = useState(1.2);
  const [saturation, setSaturation] = useState(1.1);
  const [autoLevels, setAutoLevels] = useState(true);
  const [smoothGradients, setSmoothGradients] = useState(false);
  const [faceAware, setFaceAware] = useState(false);
  const [lineArt, setLineArt] = useState(false);

  const { colors, defaultEnabledIds } = usePaletteInventory(false);
  const visibleColors = colors.filter((c) => c.inStock);
  const [customEnabled, setCustomEnabled] = useState<Set<number> | null>(null);
  const enabled = customEnabled ?? defaultEnabledIds;
  const enabledKey = useMemo(
    () => [...enabled].sort((a, b) => a - b).join(","),
    [enabled],
  );
  const activePalette = useMemo(
    () => getActivePalette(enabled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabledKey],
  );

  const toggleColor = useCallback(
    (id: number) => {
      const next = new Set(enabled);
      if (next.has(id)) {
        if (next.size <= 4) return;
        next.delete(id);
      } else next.add(id);
      if (imageData) setWorking(true);
      setCustomEnabled(next);
    },
    [enabled, imageData],
  );

  const onPick = useCallback(async (f: File) => {
    setWorking(true);
    try {
      setImageData(await fileToImageData(f));
    } catch {
      setWorking(false);
    }
  }, []);

  const pickStarter = useCallback(async (id: string) => {
    setWorking(true);
    try {
      const r = await renderStarter(id);
      if (r) setImageData(r.imageData);
      else setWorking(false);
    } catch {
      setWorking(false);
    }
  }, []);

  // Re-run the engine on any change — including cols/rows from the calculator.
  useEffect(() => {
    let cancelled = false;
    if (!imageData) return;
    const cropped = cropToAspect(imageData, cols, rows, 1, 0.5, 0.5);
    brickify(cropped, {
      cols,
      rows,
      palette: activePalette,
      preprocess: { contrast, saturation, autoLevels, faceAware, lineArt },
      fsDither: smoothGradients,
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        if (canvasRef.current) renderBricks(canvasRef.current, r.pixelMap);
      })
      .catch(() => {})
      .finally(() => !cancelled && setWorking(false));
    return () => {
      cancelled = true;
    };
  }, [
    imageData,
    cols,
    rows,
    contrast,
    saturation,
    autoLevels,
    smoothGradients,
    faceAware,
    lineArt,
    enabledKey,
    activePalette,
    brickify,
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Settings */}
      <div className="card flex flex-col gap-5 p-6">
        <p className="text-sm font-medium">התאמות תמונה</p>
        <Slider
          label={`ניגודיות: ${contrast.toFixed(2)}`}
          min={0.5}
          max={2}
          step={0.05}
          value={contrast}
          onChange={(v) => {
            if (imageData) setWorking(true);
            setContrast(v);
          }}
        />
        <Slider
          label={`רוויה: ${saturation.toFixed(2)}`}
          min={0}
          max={2}
          step={0.05}
          value={saturation}
          onChange={(v) => {
            if (imageData) setWorking(true);
            setSaturation(v);
          }}
        />
        <Toggle
          label="שיפור אוטומטי (ניגודיות חכמה)"
          checked={autoLevels}
          onChange={(v) => {
            if (imageData) setWorking(true);
            setAutoLevels(v);
          }}
        />
        <Toggle
          label="הדגשת פנים (לדיוקנאות)"
          checked={faceAware}
          onChange={(v) => {
            if (imageData) setWorking(true);
            setFaceAware(v);
          }}
        />
        <Toggle
          label="מעברי צבע חלקים (לתמונות)"
          checked={smoothGradients}
          onChange={(v) => {
            if (imageData) setWorking(true);
            setSmoothGradients(v);
          }}
        />
        <Toggle
          label="מצב טקסט / קו (ללוגו וכיתוב)"
          checked={lineArt}
          onChange={(v) => {
            if (imageData) setWorking(true);
            setLineArt(v);
          }}
        />

        <div className="border-t border-outline pt-4">
          <p className="mb-2 text-sm font-medium">צבעים ({enabled.size})</p>
          <div className="flex flex-wrap gap-2">
            {visibleColors.map((c) => (
              <BrickSwatch
                key={c.id}
                hex={c.hex}
                name={c.name}
                on={enabled.has(c.id)}
                disabled={!c.inStock}
                onClick={() => toggleColor(c.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stage */}
      <div className="card flex flex-col items-center justify-center gap-4 p-6">
        <label className="relative flex aspect-square w-full max-w-sm cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline bg-surface-muted">
          <canvas
            ref={canvasRef}
            className={`h-full w-full object-contain ${imageData ? "" : "hidden"}`}
          />
          {!imageData && (
            <span className="px-6 text-center text-zinc-500">
              העלו תמונה כדי לראות תצוגה מקדימה
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
            }}
          />
        </label>
        {working && <p className="text-sm text-zinc-500">מעבד…</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {STARTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void pickStarter(s.id)}
              className="btn btn-ghost text-xs"
            >
              {STARTER_EMOJI[s.id] ?? "■"} {s.name}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-zinc-500">
          תצוגה ב-{cols}×{rows} לבנים — לפי הגודל שבחרתם למעלה.
        </p>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

"use client";
/**
 * B2B live engine preview — a trimmed Studio for the landing page. It exists to
 * SHOW how the brick engine works (upload a photo / pick a design → live OKLab
 * preview), NOT to place an order. So it has no form, no price, and no size
 * controls: the size (cols×rows) is driven by the calculator section above, so
 * the two stay in sync.
 *
 * Settings are the shared DEFAULT_ENGINE_SETTINGS plus the same named presets
 * the studio offers. It used to ship its own hard-coded "vivid" values
 * (contrast 1.2 / saturation 1.1 / autoLevels on) — the exact combination that
 * drags warm skin toward red — so a prospect's first look at the engine was its
 * worst output. Never re-introduce local defaults here; import them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type BrickifyResult } from "@/lib/brick-engine";
import { BrickSwatch } from "@/components/b2c/BrickSwatch";
import { getActivePalette } from "@/lib/brick-engine/palette";
import { useBrickWorker } from "@/lib/brick-engine/useBrickWorker";
import { usePaletteInventory } from "@/lib/brick-engine/usePaletteInventory";
import { renderBricks } from "@/lib/brick-render";
import { DEFAULT_ENGINE_SETTINGS, ENGINE_PRESETS } from "@/lib/design-settings";
import { cropToAspect, fileToImageData } from "@/lib/image";
import { computePrice, formatILS } from "@/lib/pricing";

const CM_PER_PLATE = 19;

/**
 * Shape shortcuts offered next to the canvas. Deliberately a small, opinionated
 * set (one per aspect ratio family plus a step up in each) — the full grid lives
 * in the calculator's ± controls.
 */
const SHAPES: { id: string; x: number; y: number; label: string }[] = [
  { id: "2x2", x: 2, y: 2, label: "ריבוע" },
  { id: "3x2", x: 3, y: 2, label: "רוחב" },
  { id: "2x3", x: 2, y: 3, label: "פורטרט" },
  { id: "3x3", x: 3, y: 3, label: "ריבוע גדול" },
  { id: "4x2", x: 4, y: 2, label: "פנורמה" },
  { id: "1x1", x: 1, y: 1, label: "מיני" },
];

/** A ready-made design offered as a "try it on this" sample. */
export interface PreviewSample {
  id: string;
  title: string;
  imageUrl: string;
}

export function B2bEnginePreview({
  cols,
  rows,
  platesX,
  platesY,
  setPlates,
  samples = [],
}: {
  cols: number;
  rows: number;
  platesX: number;
  platesY: number;
  /**
   * Writes back to the calculator's size. The shape strip below is the SAME
   * state as the calculator above — a visitor whose photo only works wide must
   * be able to discover that here, at the moment they see it, without scrolling
   * back up. Changing it re-prices the whole quote.
   */
  setPlates: (x: number, y: number) => void;
  /**
   * Real photographs from the ready-designs catalogue. Prospects judge the
   * product by what they see here, so these must be actual images — the page
   * used to offer emoji-shaped starters (heart, star, smiley), which made the
   * result look like clip-art rather than a photo mosaic. When the catalogue is
   * empty this strip simply doesn't render and upload is the only path.
   */
  samples?: PreviewSample[];
}) {
  const { brickify } = useBrickWorker();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [, setResult] = useState<BrickifyResult | null>(null);
  const [working, setWorking] = useState(false);

  const price = computePrice(cols, rows, "physical").total;

  const [presetId, setPresetId] = useState("original");
  const preset =
    ENGINE_PRESETS.find((p) => p.id === presetId) ?? ENGINE_PRESETS[0];
  const settings = { ...DEFAULT_ENGINE_SETTINGS, ...preset.settings };

  const { colors, defaultEnabledIds } = usePaletteInventory(false);
  const visibleColors = colors.filter((c) => c.inStock);
  const [customEnabled, setCustomEnabled] = useState<Set<number> | null>(null);
  const [showColors, setShowColors] = useState(false);
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

  const pickSample = useCallback(async (url: string) => {
    setWorking(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
      setImageData(
        await fileToImageData(
          new File([blob], `sample.${ext}`, { type: blob.type || "image/png" }),
        ),
      );
    } catch {
      setWorking(false);
    }
  }, []);

  const {
    contrast,
    saturation,
    autoLevels,
    faceAware,
    lineArt,
    smoothGradients,
    detail,
    localContrast,
  } = settings;

  // Re-run the engine on any change — including cols/rows from the calculator.
  useEffect(() => {
    let cancelled = false;
    if (!imageData) return;
    const cropped = cropToAspect(imageData, cols, rows, 1, 0.5, 0.5);
    brickify(cropped, {
      cols,
      rows,
      palette: activePalette,
      preprocess: {
        contrast,
        saturation,
        autoLevels,
        faceAware,
        lineArt,
        localContrast,
      },
      detail,
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
    detail,
    localContrast,
    enabledKey,
    activePalette,
    brickify,
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Stage */}
      <div className="card flex flex-col items-center gap-5 p-6">
        {/* The frame takes the mosaic's real aspect ratio, so a wide format
            reads as wide before the visitor has committed to it. */}
        <label
          className="relative flex w-full max-w-md cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline bg-surface-muted"
          style={{ aspectRatio: `${cols} / ${rows}` }}
        >
          <canvas
            ref={canvasRef}
            className={`h-full w-full object-contain ${imageData ? "" : "hidden"}`}
          />
          {!imageData && (
            <span className="flex flex-col items-center gap-2 px-6 text-center">
              <span className="mi text-[34px] text-foreground/40">
                add_photo_alternate
              </span>
              <span className="font-heading font-bold">בחרו תמונה</span>
              <span className="text-sm text-foreground/55">
                דיוקן, ילדים, חיית מחמד, לוגו — כל דבר.
              </span>
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
        {working && <p className="text-sm text-foreground/55">מעבד…</p>}
        {samples.length > 0 && (
          <div className="flex w-full flex-col items-center gap-2.5">
            <span className="text-xs text-foreground/55">
              אין תמונה בהישג יד? נסו אחת מאלה
            </span>
            <div className="flex flex-wrap justify-center gap-2.5">
              {samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.title}
                  onClick={() => void pickSample(s.imageUrl)}
                  className="h-16 w-16 overflow-hidden rounded-xl border-2 border-outline transition-colors hover:border-secondary"
                >
                  {/* Plain img: these are Supabase public URLs, unoptimized. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="card flex h-fit flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <p className="font-heading font-bold">סגנון</p>
          <div className="grid grid-cols-2 gap-2">
            {ENGINE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (imageData) setWorking(true);
                  setPresetId(p.id);
                }}
                className={`min-h-[44px] rounded-xl border-2 px-3 font-heading text-sm font-bold transition-colors ${
                  p.id === presetId
                    ? "border-secondary bg-secondary text-on-secondary"
                    : "border-outline bg-surface hover:bg-surface-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-foreground/55">
            בעמוד היצירה העובד מקבל גם שליטה ידנית מלאה — ניגודיות, רוויה, חיתוך
            ובחירת צבעים.
          </p>
        </div>

        <div className="border-t border-outline pt-4">
          <button
            type="button"
            onClick={() => setShowColors((v) => !v)}
            className="flex w-full items-center justify-between font-heading font-bold"
          >
            <span>פלטת הצבעים ({enabled.size})</span>
            <span className="mi text-lg text-foreground/50">
              {showColors ? "expand_less" : "expand_more"}
            </span>
          </button>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/55">
            כל הצבעים שיש במלאי, מותאמים במרחב צבע OKLab — ולכן גוני עור יוצאים
            נכון ולא ורודים או ירוקים.
          </p>
          {showColors && (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleColors.map((c) => (
                <BrickSwatch
                  key={c.id}
                  hex={c.hex}
                  name={c.nameHe}
                  on={enabled.has(c.id)}
                  disabled={!c.inStock}
                  onClick={() => toggleColor(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Shape + size — same state as the calculator above. */}
        <div className="flex flex-col gap-2.5 border-t border-outline pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <p className="font-heading font-bold">צורה וגודל</p>
            <span className="text-xs text-foreground/55">
              ⁦{platesX * CM_PER_PLATE}×{platesY * CM_PER_PLATE}⁩ ס״מ ·{" "}
              {formatILS(price)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map((s) => {
              const on = s.x === platesX && s.y === platesY;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (imageData) setWorking(true);
                    setPlates(s.x, s.y);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 transition-colors ${
                    on
                      ? "border-secondary bg-secondary/5"
                      : "border-outline hover:bg-surface-muted"
                  }`}
                >
                  <span
                    className="block rounded-[3px]"
                    style={{
                      width: s.x * 9,
                      height: s.y * 9,
                      background: on ? "#1d4ed8" : "#c4cbd2",
                    }}
                  />
                  <span className="font-heading text-[11px] font-bold leading-none">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-foreground/55">
            תמונה רחבה תיראה טוב יותר בפורמט רחב. הבחירה כאן מעדכנת גם את
            המחשבון למעלה — כולל המחיר.
          </p>
        </div>

        <p className="text-xs text-foreground/55">
          תצוגה ב-⁦{cols}×{rows}⁩ לבנים.
        </p>
      </div>
    </div>
  );
}

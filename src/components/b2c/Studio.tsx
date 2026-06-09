"use client";
/**
 * B2C Studio — upload a photo, see a live OKLab brick preview, pick size +
 * fulfillment, fill details, and order. RTL Hebrew; logical properties only.
 *
 * The Brick Engine runs in a Web Worker (useBrickWorker); the resulting
 * pixel_map is persisted with the order and later trusted by the PDF route.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type BrickifyResult } from "@/lib/brick-engine";
import { BrickSwatch } from "@/components/b2c/BrickSwatch";
import { ColorBreakdown } from "@/components/b2c/ColorBreakdown";
import { getActivePalette } from "@/lib/brick-engine/palette";
import { useBrickWorker } from "@/lib/brick-engine/useBrickWorker";
import { usePaletteInventory } from "@/lib/brick-engine/usePaletteInventory";
import { renderBricks } from "@/lib/brick-render";
import { cropToAspect, fileToImageData } from "@/lib/image";
import { STARTERS, renderStarter } from "@/lib/starters";
import { computePrice, formatILS, PLATE_STUDS } from "@/lib/pricing";
import { fitPlateDims } from "@/lib/b2b";

// Physical size of one 24×24 baseplate (24 studs × 8mm pitch ≈ 19.2 cm).
const CM_PER_PLATE = 19.2;
const MAX_PLATES = 5;
import { createClient } from "@/lib/supabase/client";
import { uploadToSignedUrl } from "@/lib/supabase/storage";

/** Data the wizard captures from the design step to carry to checkout. */
export interface DesignPayload {
  file: File | null;
  pixelMap: number[][];
  cols: number;
  rows: number;
  price: number;
}

export interface StudioProps {
  /**
   * Embedded in the /create wizard (and the employee seat flow): hides the
   * details/checkout form and shows a CTA that reports the design up via
   * `onProceed`.
   */
  embedded?: boolean;
  onProceed?: (data: DesignPayload) => void;
  /**
   * Cap the total number of 24×24 plates (platesX × platesY). Used by the
   * employee seat flow so a worker can reframe within their company's purchased
   * budget (e.g. a 3×3 = 9-plate budget can be spent as 4×2) but never exceed it.
   */
  plateBudget?: number;
  /** Initial baseplate grid (defaults to 2×2). */
  initialPlatesX?: number;
  initialPlatesY?: number;
  /** Hide the price (employees don't pay — the company already did). */
  hidePricing?: boolean;
  /** Label for the embedded CTA (defaults to "המשך לשלב הבא ←"). */
  proceedLabel?: string;
}

export function Studio({
  embedded = false,
  onProceed,
  plateBudget,
  initialPlatesX,
  initialPlatesY,
  hidePricing = false,
  proceedLabel,
}: StudioProps = {}) {
  const { brickify } = useBrickWorker();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  // Baseplate grid: horizontal × vertical 24×24 plates.
  const [platesX, setPlatesX] = useState(initialPlatesX ?? 2);
  const [platesY, setPlatesY] = useState(initialPlatesY ?? 2);
  const cols = platesX * PLATE_STUDS;
  const rows = platesY * PLATE_STUDS;
  // Employee seat flow: the company allocated this employee a plate budget. They
  // pick width/height freely up to that budget — changing one axis auto-adjusts
  // the other so the area never exceeds the budget (see fitPlateDims).
  const budgetMode = plateBudget != null;
  function setDims(changed: "x" | "y", value: number) {
    if (imageData) setWorking(true);
    if (plateBudget == null) {
      (changed === "x" ? setPlatesX : setPlatesY)(value);
      return;
    }
    const next = fitPlateDims({
      changed,
      x: changed === "x" ? value : platesX,
      y: changed === "y" ? value : platesY,
      budget: plateBudget,
    });
    setPlatesX(next.x);
    setPlatesY(next.y);
  }
  // Pre-processing controls (defaults bias toward crisp, vivid output).
  const [contrast, setContrast] = useState(1.2);
  const [saturation, setSaturation] = useState(1.1);
  const [autoLevels, setAutoLevels] = useState(true);
  // Dithering off by default (it reads as speckle at stud resolution).
  const [dither, setDither] = useState(0);
  // Floyd–Steinberg error diffusion for smooth photographic gradients.
  const [smoothGradients, setSmoothGradients] = useState(false);
  // Face-aware contrast: keep facial features in portraits.
  const [faceAware, setFaceAware] = useState(false);
  // Line-art / text mode: crisp edges for logos & lettering.
  const [lineArt, setLineArt] = useState(false);
  // Zoom/crop (1 = fit; >1 crops tighter so the subject gets more studs).
  const [zoom, setZoom] = useState(1);
  // Crop center (0..1) for drag-to-pan when zoomed in.
  const [panX, setPanX] = useState(0.5);
  const [panY, setPanY] = useState(0.5);
  const dragRef = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<BrickifyResult | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAdjustments = () => {
    if (imageData) setWorking(true);
    setContrast(1.2);
    setSaturation(1.1);
    setAutoLevels(true);
    setDither(0);
    setSmoothGradients(false);
    setFaceAware(false);
    setLineArt(false);
    setZoom(1);
    setPanX(0.5);
    setPanY(0.5);
  };

  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

  function onPanStart(e: React.PointerEvent) {
    if (zoom <= 1 || !result) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPanMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.x) / rect.width / zoom;
    const dy = (e.clientY - d.y) / rect.height / zoom;
    if (imageData) setWorking(true);
    setPanX(clamp01(d.px - dx));
    setPanY(clamp01(d.py - dy));
  }
  function onPanEnd(e: React.PointerEvent) {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }

  function bumpZoom(delta: number) {
    if (imageData) setWorking(true);
    setZoom((z) => Math.max(1, Math.min(3, Math.round((z + delta) * 10) / 10)));
  }

  // Hidden dev test mode: ?testPalette=full feeds all 24 colors to the matcher.
  const [testFull] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("testPalette") === "full",
  );

  // Color scheme (supply-driven): catalog + live stock; user can add/remove.
  // Normal users only ever see/process in-stock colors (the 17 core).
  const { colors, defaultEnabledIds } = usePaletteInventory(testFull);
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
    (id: number, inStock: boolean) => {
      if (!inStock) return;
      const next = new Set(enabled);
      if (next.has(id)) {
        if (next.size <= 4) return; // keep a usable minimum
        next.delete(id);
      } else {
        next.add(id);
      }
      if (imageData) setWorking(true);
      setCustomEnabled(next);
    },
    [enabled, imageData],
  );

  // Customer details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Every order ships a physical kit (the instruction PDF is a free download).
  const price = computePrice(cols, rows, "physical");

  const onPick = useCallback(async (f: File) => {
    setError(null);
    setFile(f);
    setWorking(true);
    try {
      setImageData(await fileToImageData(f));
    } catch {
      setWorking(false);
      setError("לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.");
    }
  }, []);

  const pickStarter = useCallback(async (id: string) => {
    setError(null);
    setWorking(true);
    try {
      const r = await renderStarter(id);
      if (!r) throw new Error();
      setFile(r.file);
      setImageData(r.imageData);
    } catch {
      setWorking(false);
      setError("שגיאה בטעינת העיצוב.");
    }
  }, []);

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

  // Re-run the engine whenever the image or size changes. (`working` is set by
  // the handlers that trigger this, to avoid setState directly in the effect.)
  useEffect(() => {
    let cancelled = false;
    if (!imageData) return;
    // Crop to the chosen aspect + zoom so rectangular grids don't stretch and
    // the customer can frame the subject (more studs where it matters).
    const cropped = cropToAspect(imageData, cols, rows, zoom, panX, panY);
    brickify(cropped, {
      cols,
      rows,
      palette: activePalette,
      preprocess: { contrast, saturation, autoLevels, faceAware, lineArt },
      dither: dither > 0 ? { amount: dither } : null,
      fsDither: smoothGradients,
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        if (canvasRef.current) renderBricks(canvasRef.current, r.pixelMap);
      })
      .catch(() => !cancelled && setError("שגיאה בעיבוד התמונה."))
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
    dither,
    smoothGradients,
    faceAware,
    lineArt,
    zoom,
    panX,
    panY,
    enabledKey,
    activePalette,
    brickify,
  ]);

  async function handleOrder() {
    setError(null);
    if (!file || !result) return setError("נא להעלות תמונה תחילה.");
    if (!name.trim() || !email.trim())
      return setError("נא למלא שם וכתובת אימייל.");
    if (!street || !city || !zip)
      return setError("נא למלא כתובת למשלוח.");

    setSubmitting(true);
    try {
      // 1. Mint a signed upload URL and upload the original photo.
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!signRes.ok) throw new Error("שגיאה בהכנת ההעלאה.");
      const { path, token } = (await signRes.json()) as {
        path: string;
        token: string;
      };
      await uploadToSignedUrl(createClient(), path, token, file);

      // 2. Create the order + get checkout URL.
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "b2c",
          customer_name: name,
          contact_email: email,
          total_price: price.total,
          fulfillment_type: "physical",
          image_url: path,
          pixel_map: result.pixelMap,
          shipping_address: { street, city, zip },
        }),
      });
      if (!res.ok) throw new Error("שגיאה ביצירת ההזמנה.");
      const { url, orderId } = (await res.json()) as {
        url?: string;
        orderId: string;
      };
      window.location.assign(url ?? `/order/${orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 p-6 md:grid-cols-2">
      {/* Preview / upload stage */}
      <section className="flex flex-col gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
          }}
        />

        <div
          className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-outline bg-[#eceef0] shadow-inner"
          style={{
            aspectRatio: `${cols} / ${rows}`,
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.06) 1.4px, transparent 1.6px)",
            backgroundSize: "14px 14px",
          }}
        >
          {/* Canvas always mounted so its ref is stable for the first paint. */}
          <canvas
            ref={canvasRef}
            onPointerDown={onPanStart}
            onPointerMove={onPanMove}
            onPointerUp={onPanEnd}
            className={`h-full w-full object-contain ${result ? "" : "hidden"} ${
              zoom > 1 ? "cursor-grab active:cursor-grabbing touch-none" : ""
            }`}
          />

          {!result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-zinc-500">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl text-primary">
                  +
                </span>
                <span className="font-heading font-medium">העלו תמונה</span>
                <span className="text-xs">JPG · PNG · WEBP</span>
              </button>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs">או בחרו עיצוב מוכן:</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTERS.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => void pickStarter(st.id)}
                      className="flex items-center gap-1 rounded-full border border-outline bg-surface px-3 py-1 text-xs text-foreground transition-colors hover:bg-surface-muted"
                    >
                      <span>{STARTER_EMOJI[st.id]}</span>
                      {st.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Zoom controls + drag hint (start/right corner) */}
          {result && (
            <div className="absolute bottom-3 start-3 flex items-center gap-1 rounded-full bg-surface/90 p-1 shadow">
              <button
                type="button"
                aria-label="הקטן"
                onClick={() => bumpZoom(-0.2)}
                className="h-8 w-8 rounded-full text-lg leading-none hover:bg-surface-muted"
              >
                −
              </button>
              <span className="w-10 text-center text-xs tabular-nums">
                {zoom.toFixed(1)}×
              </span>
              <button
                type="button"
                aria-label="הגדל"
                onClick={() => bumpZoom(0.2)}
                className="h-8 w-8 rounded-full text-lg leading-none hover:bg-surface-muted"
              >
                +
              </button>
            </div>
          )}
          {result && zoom > 1 && (
            <span className="absolute top-3 end-3 rounded-full bg-surface/90 px-3 py-1 text-xs shadow">
              גררו להזזת המסגרת ✋
            </span>
          )}
        </div>

        {working && <p className="text-sm text-zinc-500">מעבד…</p>}
        {result && (
          <>
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span>
                {result.cols}×{result.rows} אריחים · {result.cols * result.rows}{" "}
                חלקים
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="underline"
              >
                החלפת תמונה
              </button>
            </div>
            <ColorBreakdown pixelMap={result.pixelMap} palette={activePalette} />
          </>
        )}
      </section>

      {/* Controls */}
      <section className="card flex flex-col gap-5 p-6">
        <h2 className="font-heading text-2xl font-bold">
          {hidePricing ? "עצבו את הפסיפס שלכם" : "הזמינו את הפסיפס שלכם"}
        </h2>

        {testFull && (
          <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            🧪 מצב בדיקה — פלטת 24 צבעים מלאה (כולל 7 צבעי בוסט שאינם במלאי).
            לבדיקה בלבד, לא להזמנה.
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">מספר לוחות בסיס</p>
            <span className="text-xs text-zinc-500">
              {cols}×{rows} אריחים
            </span>
          </div>

          <div className="flex flex-wrap gap-6">
            {(
              [
                ["לרוחב", "x"] as const,
                ["לגובה", "y"] as const,
              ] as const
            ).map(([label, axis]) => {
              const value = axis === "x" ? platesX : platesY;
              const other = axis === "x" ? platesY : platesX;
              // Budget mode: an axis can grow while area stays within budget
              // (the other axis would auto-shrink). Otherwise cap at MAX_PLATES.
              const canIncrease = budgetMode
                ? (value + 1) * 1 <= plateBudget! && value < plateBudget!
                : value < MAX_PLATES;
              const hint = budgetMode
                ? other > 1 && (value + 1) * other > plateBudget!
                  ? "↔"
                  : ""
                : "";
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm text-zinc-500">{label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="הפחת"
                      disabled={value <= 1}
                      onClick={() => setDims(axis, value - 1)}
                      className="h-8 w-8 rounded-full border border-zinc-300 text-lg leading-none disabled:opacity-30 dark:border-zinc-700"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-medium">{value}</span>
                    <button
                      type="button"
                      aria-label="הוסף"
                      disabled={!canIncrease}
                      onClick={() => setDims(axis, value + 1)}
                      className="h-8 w-8 rounded-full border border-zinc-300 text-lg leading-none disabled:opacity-30 dark:border-zinc-700"
                    >
                      +
                    </button>
                    {hint && (
                      <span
                        className="text-xs text-zinc-400"
                        title="הגדלה כאן תקטין את הצד השני כדי להישאר בתקציב"
                      >
                        {hint}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            גודל סופי: {Math.round(platesX * CM_PER_PLATE)}×
            {Math.round(platesY * CM_PER_PLATE)} ס&quot;מ · {platesX * platesY}{" "}
            לוחות
            {budgetMode ? ` (עד ${plateBudget})` : ""}
          </p>
        </div>

        {/* Pre-processing: higher contrast keeps edges crisp; saturation keeps
            colors vivid. Disabled until an image is loaded. */}
        <div className="grid gap-3 border-t border-outline pt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">התאמות תמונה</p>
            <button
              type="button"
              className="text-xs text-zinc-500 underline"
              onClick={resetAdjustments}
            >
              איפוס לברירת מחדל
            </button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              זום / חיתוך: {zoom.toFixed(1)}×
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setZoom(Number(e.target.value));
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              ניגודיות: {contrast.toFixed(2)}
            </span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={contrast}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setContrast(Number(e.target.value));
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              רוויה: {saturation.toFixed(2)}
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={saturation}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setSaturation(Number(e.target.value));
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              פיזור (Dithering): {dither === 0 ? "כבוי" : dither.toFixed(3)}
            </span>
            <input
              type="range"
              min={0}
              max={0.05}
              step={0.005}
              value={dither}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setDither(Number(e.target.value));
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={autoLevels}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setAutoLevels(e.target.checked);
              }}
            />
            שיפור אוטומטי (ניגודיות חכמה)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={faceAware}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setFaceAware(e.target.checked);
              }}
            />
            הדגשת פנים (לדיוקנאות)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={smoothGradients}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setSmoothGradients(e.target.checked);
              }}
            />
            מעברי צבע חלקים (לתמונות)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={lineArt}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setLineArt(e.target.checked);
              }}
            />
            מצב טקסט / קו (ללוגו וכיתוב)
          </label>
        </div>

        {/* Color scheme — supply-driven. In-stock colors can be toggled;
            out-of-stock are disabled. Default scheme is our recommended set. */}
        <div className="border-t border-outline pt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              צבעים ({enabled.size})
            </p>
            <button
              type="button"
              className="text-xs text-zinc-500 underline"
              onClick={() => {
                if (imageData) setWorking(true);
                setCustomEnabled(null);
              }}
            >
              איפוס לברירת מחדל
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleColors.map((c) => (
              <BrickSwatch
                key={c.id}
                hex={c.hex}
                name={c.name}
                on={enabled.has(c.id)}
                disabled={!c.inStock}
                onClick={() => toggleColor(c.id, c.inStock)}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            צבע פעיל מסומן במסגרת; צבע עם קו חוצה אינו בשימוש. לחצו כדי
            להוסיף/להסיר.
          </p>
        </div>

        {!hidePricing && (
          <div className="rounded-lg border border-outline bg-surface-muted px-3 py-2 text-sm text-foreground/70">
            📦 כל הזמנה כוללת ערכה פיזית עם כל הלבנים + חוברת הוראות. קובץ ההוראות
            (PDF) זמין להורדה חינם בעמוד ההזמנה.
          </div>
        )}

        {!embedded && (
          <div className="grid gap-3 border-t border-outline pt-5">
            <p className="text-sm font-medium">פרטים ומשלוח</p>
            <input
              className="input"
              placeholder="שם מלא"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="email"
              dir="ltr"
              className="input text-start"
              placeholder="אימייל"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input col-span-2"
                placeholder="רחוב ומספר"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <input
                className="input"
                placeholder="עיר"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <input
                className="input"
                placeholder="מיקוד"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-outline pt-4">
          {hidePricing ? (
            <span className="text-sm text-zinc-500">
              {result ? `${result.cols}×${result.rows} אריחים` : ""}
            </span>
          ) : (
            <span className="font-heading text-2xl font-bold">
              {formatILS(price.total)}
            </span>
          )}
          {embedded ? (
            <button
              type="button"
              onClick={() =>
                result &&
                onProceed?.({
                  file,
                  pixelMap: result.pixelMap,
                  cols,
                  rows,
                  price: price.total,
                })
              }
              disabled={!result}
              className="btn btn-primary"
            >
              {proceedLabel ?? "המשך לשלב הבא ←"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleOrder()}
              disabled={submitting || !result}
              className="btn btn-primary"
            >
              {submitting ? "מעבד…" : "הוספה לעגלה 🛒"}
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

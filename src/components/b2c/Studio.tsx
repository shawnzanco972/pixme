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
import { ColorBreakdown } from "@/components/b2c/ColorBreakdown";
import { getActivePalette } from "@/lib/brick-engine/palette";
import { useBrickWorker } from "@/lib/brick-engine/useBrickWorker";
import { usePaletteInventory } from "@/lib/brick-engine/usePaletteInventory";
import { renderBricks } from "@/lib/brick-render";
import { cropToAspect, fileToImageData } from "@/lib/image";
import { computePrice, formatILS, PLATE_STUDS } from "@/lib/pricing";

// Physical size of one 24×24 baseplate (24 studs × 8mm pitch ≈ 19.2 cm).
const CM_PER_PLATE = 19.2;
const MAX_PLATES = 5;
import { createClient } from "@/lib/supabase/client";
import { uploadToSignedUrl } from "@/lib/supabase/storage";

export function Studio() {
  const { brickify } = useBrickWorker();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  // Baseplate grid (like brick.me): horizontal × vertical 24×24 plates.
  const [platesX, setPlatesX] = useState(2);
  const [platesY, setPlatesY] = useState(2);
  const cols = platesX * PLATE_STUDS;
  const rows = platesY * PLATE_STUDS;
  // Pre-processing controls (defaults bias toward crisp, vivid output).
  const [contrast, setContrast] = useState(1.2);
  const [saturation, setSaturation] = useState(1.1);
  const [autoLevels, setAutoLevels] = useState(true);
  // Dithering off by default (it reads as speckle at stud resolution).
  const [dither, setDither] = useState(0);
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
      preprocess: { contrast, saturation, autoLevels },
      dither: dither > 0 ? { amount: dither } : null,
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl text-primary">
                +
              </span>
              <span className="font-heading font-medium">העלו תמונה</span>
              <span className="text-sm">JPG · PNG · WEBP</span>
            </button>
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
        <h2 className="font-heading text-2xl font-bold">הזמינו את הפסיפס שלכם</h2>

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
                ["לרוחב", platesX, setPlatesX] as const,
                ["לגובה", platesY, setPlatesY] as const,
              ] as const
            ).map(([label, value, setter]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm text-zinc-500">{label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="הפחת"
                    disabled={value <= 1}
                    onClick={() => {
                      if (imageData) setWorking(true);
                      setter(Math.max(1, value - 1));
                    }}
                    className="h-8 w-8 rounded-full border border-zinc-300 text-lg leading-none disabled:opacity-30 dark:border-zinc-700"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-medium">{value}</span>
                  <button
                    type="button"
                    aria-label="הוסף"
                    disabled={value >= MAX_PLATES}
                    onClick={() => {
                      if (imageData) setWorking(true);
                      setter(Math.min(MAX_PLATES, value + 1));
                    }}
                    className="h-8 w-8 rounded-full border border-zinc-300 text-lg leading-none disabled:opacity-30 dark:border-zinc-700"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            גודל סופי: {Math.round(platesX * CM_PER_PLATE)}×
            {Math.round(platesY * CM_PER_PLATE)} ס&quot;מ ·{" "}
            {platesX * platesY} לוחות
          </p>
        </div>

        {/* Pre-processing: higher contrast keeps edges crisp; saturation keeps
            colors vivid. Disabled until an image is loaded. */}
        <div className="grid gap-3">
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
        </div>

        {/* Color scheme — supply-driven. In-stock colors can be toggled;
            out-of-stock are disabled. Default scheme is our recommended set. */}
        <div>
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
          <div className="flex flex-wrap gap-1.5">
            {visibleColors.map((c) => {
              const on = enabled.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!c.inStock}
                  title={
                    c.inStock
                      ? c.name + (on ? " (פעיל)" : "")
                      : `${c.name} — אזל מהמלאי`
                  }
                  onClick={() => toggleColor(c.id, c.inStock)}
                  className={`h-7 w-7 rounded-md border transition ${
                    on
                      ? "ring-2 ring-offset-1 ring-black dark:ring-white"
                      : "opacity-45"
                  } ${!c.inStock ? "cursor-not-allowed opacity-20" : ""}`}
                  style={{ backgroundColor: c.hex, borderColor: "#0003" }}
                >
                  {!c.inStock ? (
                    <span className="text-[10px] leading-none text-zinc-700">
                      ✕
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            לחצו כדי להוסיף/להסיר צבע. צבעים שאזלו מהמלאי מושבתים.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          📦 כל הזמנה כוללת ערכה פיזית עם כל הלבנים + חוברת הוראות. קובץ ההוראות
          (PDF) זמין להורדה חינם בעמוד ההזמנה.
        </div>

        <div className="grid gap-3">
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

        <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <span className="font-heading text-2xl font-bold">
            {formatILS(price.total)}
          </span>
          <button
            type="button"
            onClick={() => void handleOrder()}
            disabled={submitting || !result}
            className="btn btn-primary"
          >
            {submitting ? "מעבד…" : "הוספה לעגלה 🛒"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

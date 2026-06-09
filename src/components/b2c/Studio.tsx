"use client";
/**
 * B2C Studio — upload a photo, see a live OKLab brick preview, pick size +
 * fulfillment, fill details, and order. RTL Hebrew; logical properties only.
 *
 * The Brick Engine runs in a Web Worker (useBrickWorker); the resulting
 * pixel_map is persisted with the order and later trusted by the PDF route.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type BrickifyResult } from "@/lib/brick-engine";
import { BrickSwatch } from "@/components/b2c/BrickSwatch";
import { MosaicThumb } from "@/components/MosaicThumb";
import { ColorBreakdown } from "@/components/b2c/ColorBreakdown";
import { getActivePalette } from "@/lib/brick-engine/palette";
import { useBrickWorker } from "@/lib/brick-engine/useBrickWorker";
import { usePaletteInventory } from "@/lib/brick-engine/usePaletteInventory";
import { renderBricks } from "@/lib/brick-render";
import { cropToAspect, fileToImageData } from "@/lib/image";
import { STARTERS, renderStarter } from "@/lib/starters";
import { computePrice, formatILS, PLATE_STUDS } from "@/lib/pricing";
import { fitPlateDims } from "@/lib/b2b";
import {
  DEFAULT_ENGINE_SETTINGS,
  type DesignSettings,
  type EngineSettings,
} from "@/lib/design-settings";

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
  /**
   * Pre-load a ready-made design's artwork (public URL). Fetched once on mount
   * and pushed through the normal pipeline, exactly like an uploaded photo.
   */
  initialImageUrl?: string;
  /** Filename hint for the pre-loaded artwork (used as the order's image). */
  initialImageName?: string;
  /**
   * Admin-authored engine settings to seed the studio controls with (crop/zoom,
   * contrast, etc.). The customer can still change anything.
   */
  initialSettings?: Partial<EngineSettings>;
  /**
   * Ready-made designs to offer as a "suggestions" strip below the studio.
   * Clicking one swaps it into the engine with its saved settings.
   */
  library?: StudioLibraryItem[];
  /**
   * Authoring mode (admin): replace the order/proceed CTA with a "save as
   * default" button that reports the current settings via `onSaveSettings`.
   */
  authoring?: boolean;
  onSaveSettings?: (settings: DesignSettings) => void;
}

/** A ready-made design offered in the studio's suggestions strip. */
export interface StudioLibraryItem {
  id: string;
  title: string;
  imageUrl: string;
  platesX: number;
  platesY: number;
  settings: EngineSettings;
}

export function Studio({
  embedded = false,
  onProceed,
  plateBudget,
  initialPlatesX,
  initialPlatesY,
  hidePricing = false,
  proceedLabel,
  initialImageUrl,
  initialImageName,
  initialSettings,
  library,
  authoring = false,
  onSaveSettings,
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
  // Pre-processing controls (defaults bias toward crisp, vivid output). When a
  // ready-made design is opened, its saved settings seed these instead.
  const seed = { ...DEFAULT_ENGINE_SETTINGS, ...initialSettings };
  const [contrast, setContrast] = useState(seed.contrast);
  const [saturation, setSaturation] = useState(seed.saturation);
  const [autoLevels, setAutoLevels] = useState(seed.autoLevels);
  // Dithering off by default (it reads as speckle at stud resolution).
  const [dither, setDither] = useState(seed.dither);
  // Floyd–Steinberg error diffusion for smooth photographic gradients.
  const [smoothGradients, setSmoothGradients] = useState(seed.smoothGradients);
  // Face-aware contrast: keep facial features in portraits.
  const [faceAware, setFaceAware] = useState(seed.faceAware);
  // Line-art / text mode: crisp edges for logos & lettering.
  const [lineArt, setLineArt] = useState(seed.lineArt);
  // Detail preservation: commit high-contrast cells to text/stroke colors.
  const [detail, setDetail] = useState(seed.detail);
  // Zoom/crop (1 = fit; >1 crops tighter so the subject gets more studs).
  const [zoom, setZoom] = useState(seed.zoom);
  // Crop center (0..1) for drag-to-pan when zoomed in.
  const [panX, setPanX] = useState(seed.panX);
  const [panY, setPanY] = useState(seed.panY);
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
    setDetail(DEFAULT_ENGINE_SETTINGS.detail);
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

  // "Compare to original" — show the source image the mosaic was built from so
  // the customer can judge the likeness before ordering.
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setOriginalUrl(null);
      setShowOriginal(false);
      return;
    }
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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

  // Imperatively push a settings snapshot into the controls (used when the
  // customer picks a different design from the suggestions strip).
  const applySettings = useCallback((s: EngineSettings) => {
    setContrast(s.contrast);
    setSaturation(s.saturation);
    setAutoLevels(s.autoLevels);
    setDither(s.dither);
    setSmoothGradients(s.smoothGradients);
    setFaceAware(s.faceAware);
    setLineArt(s.lineArt);
    setDetail(s.detail);
    setZoom(s.zoom);
    setPanX(s.panX);
    setPanY(s.panY);
  }, []);

  // Current settings + dimensions snapshot (admin authoring "save default").
  const currentSettings = useCallback(
    (): DesignSettings => ({
      platesX,
      platesY,
      contrast,
      saturation,
      autoLevels,
      dither,
      smoothGradients,
      faceAware,
      lineArt,
      detail,
      zoom,
      panX,
      panY,
    }),
    [
      platesX,
      platesY,
      contrast,
      saturation,
      autoLevels,
      dither,
      smoothGradients,
      faceAware,
      lineArt,
      detail,
      zoom,
      panX,
      panY,
    ],
  );

  // Swap a suggested design into the engine: fetch its artwork, apply its saved
  // size + settings, and re-run the pipeline (same path as an upload).
  const loadLibraryItem = useCallback(
    async (item: StudioLibraryItem) => {
      setError(null);
      setWorking(true);
      try {
        const res = await fetch(item.imageUrl);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
        const f = new File([blob], `${item.title}.${ext}`, {
          type: blob.type || "image/png",
        });
        setFile(f);
        if (plateBudget == null) {
          setPlatesX(item.platesX);
          setPlatesY(item.platesY);
        }
        applySettings(item.settings);
        setImageData(await fileToImageData(f));
      } catch {
        setWorking(false);
        setError("שגיאה בטעינת העיצוב.");
      }
    },
    [applySettings, plateBudget],
  );

  // Pre-load a ready-made design's artwork on mount (homepage → /create?design).
  // Fetch the public image, wrap it as a File, and run it through onPick so the
  // rest of the studio (crop/zoom/size/checkout) behaves like a normal upload.
  useEffect(() => {
    if (!initialImageUrl) return;
    let cancelled = false;
    setWorking(true);
    (async () => {
      try {
        const res = await fetch(initialImageUrl);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        if (cancelled) return;
        const ext = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
        const f = new File([blob], initialImageName ?? `design.${ext}`, {
          type: blob.type || "image/png",
        });
        setFile(f);
        setImageData(await fileToImageData(f));
      } catch {
        if (!cancelled) {
          setWorking(false);
          setError("לא הצלחנו לטעון את העיצוב שנבחר.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once for the provided URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImageUrl]);

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
      detail,
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
    detail,
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

  // Color breakdown + order summary. Rendered in two responsive slots: under
  // the canvas on desktop (lg+), below the settings sidebar on mobile/tablet —
  // so settings stay reachable before the checkout card on small screens.
  const breakdownAndOrder = (
    <>
      {result && (
        <div className="px-1">
          <ColorBreakdown pixelMap={result.pixelMap} palette={activePalette} />
        </div>
      )}

      {/* Order summary + primary action — framed in brand red so it stands out. */}
      <div className="card flex flex-col gap-3 border-2 border-primary p-4">
        {!hidePricing && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/60">
                סה&quot;כ לתשלום
              </span>
              <span className="font-heading text-3xl font-black text-primary">
                {formatILS(price.total)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                משלוח חינם
              </span>
              {result && (
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-foreground/60">
                  {(result.cols * result.rows).toLocaleString("he-IL")} לבנים
                </span>
              )}
            </div>
          </>
        )}
        {hidePricing && result && (
          <span className="text-sm text-foreground/60">
            {Math.round(platesX * CM_PER_PLATE)}×
            {Math.round(platesY * CM_PER_PLATE)} ס&quot;מ ·{" "}
            {(result.cols * result.rows).toLocaleString("he-IL")} לבנים
          </span>
        )}

        {authoring ? (
          <button
            type="button"
            onClick={() => result && onSaveSettings?.(currentSettings())}
            disabled={!result}
            className="btn btn-primary w-full"
          >
            שמירת הגדרות ברירת מחדל
          </button>
        ) : embedded ? (
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
            className="btn btn-primary w-full"
          >
            {proceedLabel ?? "המשך לשלב הבא ←"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleOrder()}
            disabled={submitting || !result}
            className="btn btn-primary w-full"
          >
            {submitting ? "מעבד…" : "הוספה לעגלה"}
          </button>
        )}

        {!hidePricing && (
          <p className="text-xs leading-relaxed text-foreground/55">
            כל הזמנה כוללת ערכה פיזית עם כל הלבנים + חוברת הוראות (PDF) להורדה
            חינם בעמוד ההזמנה.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
    <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
      {/* Canvas stage (DOM-first; flex-row-reverse puts it on the LEFT in RTL) */}
      <section className="flex min-w-0 flex-1 flex-col gap-3">
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

        {/* Canvas toolbar — title + live stud count + zoom tools. */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="font-heading text-base font-bold">הפסיפס שלי</div>
            <div className="truncate text-xs text-foreground/60">
              {result
                ? `${Math.round(platesX * CM_PER_PLATE)}×${Math.round(platesY * CM_PER_PLATE)} ס״מ · ${(result.cols * result.rows).toLocaleString("he-IL")} לבנים`
                : "תצוגה מקדימה חיה"}
            </div>
          </div>
          {result && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="הקטן"
                onClick={() => bumpZoom(-0.2)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline bg-surface text-lg leading-none hover:bg-surface-muted active:translate-y-px"
              >
                −
              </button>
              <span className="w-11 text-center text-xs tabular-nums text-foreground/70">
                {zoom.toFixed(1)}×
              </span>
              <button
                type="button"
                aria-label="הגדל"
                onClick={() => bumpZoom(0.2)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline bg-surface text-lg leading-none hover:bg-surface-muted active:translate-y-px"
              >
                +
              </button>
              <button
                type="button"
                aria-label="התאמה למסך"
                onClick={() => {
                  if (imageData) setWorking(true);
                  setZoom(1);
                  setPanX(0.5);
                  setPanY(0.5);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline bg-surface text-base leading-none hover:bg-surface-muted active:translate-y-px"
              >
                ⤢
              </button>
            </div>
          )}
        </div>

        {/* Canvas + cm guideline rulers (W along the top, H along the start
            edge). The wrapper reserves space for the rulers via logical padding
            so they line up with the recessed baseplate exactly. */}
        <div
          className="relative"
          style={result ? { paddingTop: 28, paddingInlineStart: 40 } : undefined}
        >
          {result && (
            <>
              {/* Width ruler (top) */}
              <div className="pointer-events-none absolute top-0 end-0 start-[40px] flex h-7 items-center">
                <div className="flex w-full items-center gap-2 text-[11px] font-medium text-foreground/55">
                  <span className="h-2 w-px bg-foreground/25" />
                  <span className="h-px flex-1 bg-foreground/15" />
                  <span className="whitespace-nowrap">
                    {Math.round(platesX * CM_PER_PLATE)} ס&quot;מ
                  </span>
                  <span className="h-px flex-1 bg-foreground/15" />
                  <span className="h-2 w-px bg-foreground/25" />
                </div>
              </div>
              {/* Height ruler (inline-start = right in RTL) */}
              <div className="pointer-events-none absolute bottom-0 start-0 top-7 flex w-10 justify-center">
                <div className="flex h-full flex-col items-center gap-2 text-[11px] font-medium text-foreground/55">
                  <span className="h-px w-2 bg-foreground/25" />
                  <span className="w-px flex-1 bg-foreground/15" />
                  <span
                    style={{ writingMode: "vertical-rl" }}
                    className="whitespace-nowrap"
                  >
                    {Math.round(platesY * CM_PER_PLATE)} ס&quot;מ
                  </span>
                  <span className="w-px flex-1 bg-foreground/15" />
                  <span className="h-px w-2 bg-foreground/25" />
                </div>
              </div>
            </>
          )}

          {/* Recessed baseplate — the mosaic sits "into" the plate. Square
              corners once an image is loaded (the product is square; rounded
              corners could mislead); rounded only in the empty state. */}
          <div
            className={`relative flex items-center justify-center overflow-hidden border border-outline ${
              result ? "rounded-none" : "rounded-2xl"
            }`}
            style={{
              aspectRatio: `${cols} / ${rows}`,
              background: "var(--color-surface-muted)",
              boxShadow: "inset 0 4px 20px rgba(25,28,30,0.06)",
              backgroundImage:
                "radial-gradient(circle, rgba(0,0,0,0.06) 1.4px, transparent 1.6px)",
              backgroundSize: "14px 14px",
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPanStart}
              onPointerMove={onPanMove}
              onPointerUp={onPanEnd}
              className={`h-full w-full object-contain ${result ? "" : "hidden"} ${
                zoom > 1 ? "cursor-grab touch-none active:cursor-grabbing" : ""
              }`}
            />

            {/* Compare overlay — original source image on top of the mosaic. */}
            {result && showOriginal && originalUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl}
                  alt="התמונה המקורית"
                  className="absolute inset-0 h-full w-full bg-surface object-contain"
                />
                <span className="absolute top-3 start-3 rounded-full bg-surface/90 px-3 py-1 text-xs shadow">
                  תמונה מקורית
                </span>
              </>
            )}

            {!result && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-foreground/55"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl text-primary">
                  +
                </span>
                <span className="font-heading font-semibold text-foreground">
                  העלו תמונה
                </span>
                <span className="text-xs">או בחרו עיצוב מוכן מהצד</span>
              </button>
            )}

            {result && zoom > 1 && (
              <span className="absolute top-3 end-3 rounded-full bg-surface/90 px-3 py-1 text-xs shadow">
                גררו להזזת המסגרת
              </span>
            )}
          </div>
        </div>

        {working && (
          <p className="px-1 text-sm text-foreground/55">מעבד…</p>
        )}

        {/* Desktop slot: breakdown + checkout under the canvas. */}
        <div className="hidden flex-col gap-3 lg:flex">{breakdownAndOrder}</div>
      </section>

      {/* Sidebar — upload, board, palette, settings, order (RTL start = right) */}
      <aside className="flex w-full flex-col gap-4 lg:w-[372px] lg:shrink-0">
        {/* Upload card */}
        <div className="card flex flex-col gap-3 p-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-center text-primary transition-colors hover:border-primary hover:bg-primary/10"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.8" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="font-heading text-base font-bold text-foreground">
              {file ? "החלפת תמונה" : "העלו תמונה"}
            </span>
            <span className="text-xs text-foreground/55">
              {file ? "JPG · PNG · WEBP" : "או בחרו מהדוגמאות למטה"}
            </span>
          </button>

          {file ? (
            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="self-center text-sm text-secondary underline"
            >
              {showOriginal ? "תצוגת הפסיפס" : "השוואה לתמונה המקורית"}
            </button>
          ) : (
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
          )}
        </div>

        {testFull && (
          <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            מצב בדיקה — פלטת 24 צבעים מלאה (כולל 7 צבעי בוסט שאינם במלאי). לבדיקה
            בלבד, לא להזמנה.
          </div>
        )}

        {/* Board size — our plate logic (W × H baseplates). */}
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-bold">גודל הלוח</h3>
            <span className="text-xs font-medium text-foreground/60">
              {Math.round(platesX * CM_PER_PLATE)}×
              {Math.round(platesY * CM_PER_PLATE)} ס&quot;מ
            </span>
          </div>
          <div className="flex items-center justify-center gap-4 rounded-xl border border-outline bg-surface-muted p-3">
            {(
              [
                ["x", "רוחב"],
                ["y", "גובה"],
              ] as const
            ).map(([axis, label], i) => {
              const value = axis === "x" ? platesX : platesY;
              const other = axis === "x" ? platesY : platesX;
              // Budget mode (employee seat): grow within the plate budget; the
              // other axis auto-shrinks. Otherwise cap at MAX_PLATES.
              const canIncrease = budgetMode
                ? value + 1 <= plateBudget! && value < plateBudget!
                : value < MAX_PLATES;
              const shrinksOther =
                budgetMode && other > 1 && (value + 1) * other > plateBudget!;
              const stepBtn =
                "flex h-9 w-9 items-center justify-center rounded-lg border border-outline bg-surface text-xl leading-none transition-transform hover:bg-surface-muted active:translate-y-px disabled:opacity-30";
              return (
                <Fragment key={axis}>
                  {i === 1 && (
                    <span className="font-heading text-lg text-foreground/40">
                      ×
                    </span>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="הוסף"
                        disabled={!canIncrease}
                        onClick={() => setDims(axis, value + 1)}
                        className={stepBtn}
                        title={
                          shrinksOther
                            ? "הגדלה כאן תקטין את הצד השני כדי להישאר בתקציב"
                            : undefined
                        }
                      >
                        +
                      </button>
                      <span className="w-6 text-center font-heading text-xl font-bold">
                        {value}
                      </span>
                      <button
                        type="button"
                        aria-label="הפחת"
                        disabled={value <= 1}
                        onClick={() => setDims(axis, value - 1)}
                        className={stepBtn}
                      >
                        −
                      </button>
                    </div>
                    <span className="text-[11px] text-foreground/50">
                      {label}
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
          <p className="text-center text-xs text-foreground/60">
            מידות פיזיות: {Math.round(platesX * CM_PER_PLATE)}×
            {Math.round(platesY * CM_PER_PLATE)} ס&quot;מ
            {budgetMode ? ` (עד ${plateBudget} לוחות)` : ""}
          </p>
        </div>

        {/* Advanced image settings — disabled until an image is loaded. */}
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-bold">הגדרות מתקדמות</h3>
            <button
              type="button"
              className="text-xs text-foreground/50 underline"
              onClick={resetAdjustments}
            >
              איפוס
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
              חידוד פרטים (טקסט וקווים): {Math.round(detail * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={detail}
              disabled={!imageData}
              onChange={(e) => {
                if (imageData) setWorking(true);
                setDetail(Number(e.target.value));
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

        {/* Color palette — stud swatches; click to add/remove a color. */}
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-bold">פלטת צבעים</h3>
            <button
              type="button"
              className="text-xs text-foreground/50 underline"
              onClick={() => {
                if (imageData) setWorking(true);
                setCustomEnabled(null);
              }}
            >
              איפוס
            </button>
          </div>
          <p className="text-xs text-foreground/55">
            לחצו על לבנה כדי להוסיף או להסיר צבע מהפסיפס.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {visibleColors.map((c) => (
              <BrickSwatch
                key={c.id}
                hex={c.hex}
                name={c.nameHe}
                on={enabled.has(c.id)}
                disabled={!c.inStock}
                onClick={() => toggleColor(c.id, c.inStock)}
              />
            ))}
          </div>
          <span className="text-xs text-foreground/45">
            {enabled.size} צבעים פעילים
          </span>
        </div>

        {!embedded && (
          <div className="card flex flex-col gap-3 p-4">
            <h3 className="font-heading text-base font-bold">פרטים ומשלוח</h3>
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

        {/* Mobile/tablet slot: breakdown + checkout below the settings. */}
        <div className="flex flex-col gap-3 lg:hidden">{breakdownAndOrder}</div>
      </aside>
    </div>

      {/* Suggestions strip — pick a ready-made design to load into the engine. */}
      {library && library.length > 0 && (
        <div className="mt-10 rounded-3xl border border-outline bg-surface-muted/60 p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-1 text-center sm:text-start">
            <h3 className="font-heading text-xl font-bold sm:text-2xl">
              🧱 עיצובים מוכנים
            </h3>
            <p className="text-sm text-foreground/70">
              בלי מצלמה? בחרו יצירה מוכנה והתחילו לערוך — אפשר לשנות גודל וצבעים.
            </p>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {library.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void loadLibraryItem(item)}
                className="group flex shrink-0 flex-col items-center gap-2"
                title={item.title}
              >
                {/* No surrounding box — the mosaic renders at its true ratio so
                    wide designs take more width, and the hover effect can't be
                    clipped by a frame. */}
                <div className="flex h-40 items-end justify-center sm:h-48">
                  <MosaicThumb
                    imageUrl={item.imageUrl}
                    platesX={item.platesX}
                    platesY={item.platesY}
                    settings={item.settings}
                    studPx={5}
                    className="max-h-full max-w-[22rem] rounded-md shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg"
                  />
                </div>
                <span className="max-w-44 truncate text-sm font-medium text-foreground/80">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

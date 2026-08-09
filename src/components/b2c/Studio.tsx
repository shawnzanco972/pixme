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
  ENGINE_PRESETS,
  type DesignSettings,
  type EngineSettings,
} from "@/lib/design-settings";

// Physical size of one 24×24 baseplate (24 studs × 8mm pitch ≈ 19.2 cm).
const CM_PER_PLATE = 19.2;
const MAX_PLATES = 5;
// Promoted board sizes shown as quick-pick cards (redesign). 3×3 is the hero.
const SIZE_PRESETS: { x: number; y: number; name: string; popular?: boolean }[] =
  [
    { x: 2, y: 2, name: "קטן" },
    { x: 3, y: 2, name: "רחב" },
    { x: 2, y: 3, name: "גבוה" },
    { x: 3, y: 3, name: "רגיל", popular: true },
    { x: 4, y: 4, name: "גדול" },
    { x: 5, y: 5, name: "ענק" },
  ];
// Bidi isolate so a "77×38" pair doesn't reorder to "38×77" inside an RTL run.
const pair = (a: number | string, b: number | string) =>
  `⁦${a}×${b}⁩`;
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
  // Redesign: the image-tuning panel is collapsed by default (advanced users
  // expand it). Auto-opens once an image is loaded so controls are discoverable.
  const [advOpen, setAdvOpen] = useState(false);
  // On mobile the palette grid is collapsible too (it's long); always shown on
  // desktop. Default collapsed on mobile.
  const [palOpen, setPalOpen] = useState(false);
  // Desktop: the colour breakdown floats above the price box and is collapsed
  // by default — customers care about the artwork, not the parts list.
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  /**
   * Drag-to-reframe is LOCKED by default. An unlocked canvas has to swallow
   * touch gestures to pan, which makes the page impossible to scroll past on a
   * phone; locking it keeps scrolling natural until you deliberately opt in.
   */
  const [panLocked, setPanLocked] = useState(true);

  // Which named look is currently applied (null = custom / hand-tuned).
  const [presetId, setPresetId] = useState<string>("original");

  /** Apply a curated look (contrast/saturation/auto-levels/mode toggles). */
  const applyPreset = (id: string) => {
    const p = ENGINE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (imageData) setWorking(true);
    setPresetId(id);
    setContrast(p.settings.contrast);
    setSaturation(p.settings.saturation);
    setAutoLevels(p.settings.autoLevels);
    setFaceAware(p.settings.faceAware);
    setSmoothGradients(p.settings.smoothGradients);
    setLineArt(p.settings.lineArt);
    setDither(p.settings.dither);
  };

  const resetAdjustments = () => {
    if (imageData) setWorking(true);
    setPresetId("original");
    setContrast(DEFAULT_ENGINE_SETTINGS.contrast);
    setSaturation(DEFAULT_ENGINE_SETTINGS.saturation);
    setAutoLevels(DEFAULT_ENGINE_SETTINGS.autoLevels);
    setDither(DEFAULT_ENGINE_SETTINGS.dither);
    setSmoothGradients(DEFAULT_ENGINE_SETTINGS.smoothGradients);
    setFaceAware(DEFAULT_ENGINE_SETTINGS.faceAware);
    setLineArt(DEFAULT_ENGINE_SETTINGS.lineArt);
    setDetail(DEFAULT_ENGINE_SETTINGS.detail);
    setZoom(1);
    setPanX(0.5);
    setPanY(0.5);
  };

  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /**
   * Drag-to-pan. Re-running the whole engine on every pointermove made this
   * unusable on phones (each move queued a worker pass, so the frame you were
   * dragging to only appeared seconds later). Instead we translate the already
   * rendered canvas with a CSS transform for instant feedback — no React
   * re-render, no worker — and commit the real pan (one engine pass) on release.
   */
  function onPanStart(e: React.PointerEvent) {
    if (panLocked || zoom <= 1 || !result) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPanMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !canvasRef.current) return;
    const el = canvasRef.current;
    const rect = el.getBoundingClientRect();
    // Clamp the preview to the pan range actually available at this zoom, so
    // the image can't be dragged past its own edges.
    const maxX = rect.width * (1 - 1 / zoom);
    const maxY = rect.height * (1 - 1 / zoom);
    const rawX = e.clientX - d.x;
    const rawY = e.clientY - d.y;
    const tx = Math.max(-maxX * (1 - d.px), Math.min(maxX * d.px, rawX));
    const ty = Math.max(-maxY * (1 - d.py), Math.min(maxY * d.py, rawY));
    el.style.transform = `translate(${tx}px, ${ty}px)`;
  }
  function onPanEnd(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (!d || !canvasRef.current) return;
    const el = canvasRef.current;
    const rect = el.getBoundingClientRect();
    // Read back the preview offset and convert it to a crop-centre delta.
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform);
    el.style.transform = "";
    if (!m) return;
    const dx = Number(m[1]) / rect.width / zoom;
    const dy = Number(m[2]) / rect.height / zoom;
    if (dx === 0 && dy === 0) return;
    if (imageData) setWorking(true);
    setPanX(clamp01(d.px - dx));
    setPanY(clamp01(d.py - dy));
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
  /** Usable, but the supplier hasn't confirmed they can make them yet. */
  const pendingCount = visibleColors.filter((c) => !c.confirmed).length;
  const [customEnabled, setCustomEnabled] = useState<Set<number> | null>(null);
  const enabled = customEnabled ?? defaultEnabledIds;
  /**
   * Adaptive palette. The engine picks the best N colours from the in-stock set
   * for THIS image. Measured on a portrait, accuracy plateaus around 20 colours
   * — past that the extra bricks are never chosen — so the default trades no
   * visible quality for a kit that's far quicker to pack (one bag per colour).
   */
  const [autoPalette, setAutoPalette] = useState(true);
  /**
   * Colour budget scales with the board. A small mosaic has far fewer studs to
   * spend, so a big palette just produces near-ties that scatter as speckle:
   * measured on a 2×2 portrait, dropping 24 → 14 colours took isolated single
   * studs from 14.4% to 11.7%. Big boards can carry more colour without noise.
   * The customer can still override with the slider.
   */
  const suggestedColorCount = useMemo(() => {
    const n = Math.round(Math.sqrt(cols * rows) * 0.22 + 4);
    return Math.max(12, Math.min(30, n));
  }, [cols, rows]);
  const [colorCountOverride, setColorCountOverride] = useState<number | null>(
    null,
  );
  const colorCount = colorCountOverride ?? suggestedColorCount;
  /** Colours the engine actually selected for the current image (auto mode). */
  const [autoUsedIds, setAutoUsedIds] = useState<Set<number>>(new Set());
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
      adaptive: autoPalette ? { count: colorCount } : null,
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setAutoUsedIds(new Set(r.palette.map((c) => c.id)));
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
    autoPalette,
    colorCount,
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

  // Order summary + primary action. On desktop it floats in the bottom-left
  // corner (see the fixed stack below); on mobile the price and CTA live in the
  // fixed bottom bar instead.
  const orderCard = (
    <>
      <div className="card flex w-full flex-col gap-4 border-[3px] border-primary p-5 shadow-[0_8px_0_0_#e7d3d6]">
        {!hidePricing && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground/60">
                סה&quot;כ לתשלום
              </span>
              <span className="font-heading text-[42px] font-black leading-none text-primary">
                {formatILS(price.total)}
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  <span className="mi text-[16px]">local_shipping</span>
                  משלוח חינם
                </span>
                {result && (
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground/60">
                    {(result.cols * result.rows).toLocaleString("he-IL")} לבנים
                  </span>
                )}
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground/60">
                  {platesX * platesY} לוחות בסיס
                </span>
              </div>
            </div>
          </>
        )}
        {hidePricing && result && (
          <span className="text-sm text-foreground/60">
            {pair(
              Math.round(platesX * CM_PER_PLATE),
              Math.round(platesY * CM_PER_PLATE),
            )}{" "}
            ס&quot;מ · {(result.cols * result.rows).toLocaleString("he-IL")} לבנים
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

  // Tuning controls, declared once so the panel stays readable. Ranges are
  // deliberately tighter than before (contrast used to run 0.5–2, which made
  // every nudge a big jump); finer steps make the sliders feel accurate.
  const SLIDERS = [
    {
      key: "zoom" as const,
      label: "זום / חיתוך",
      min: 1,
      max: 3,
      step: 0.05,
      set: setZoom,
      fmt: (v: number) => `${v.toFixed(2)}×`,
    },
    {
      key: "contrast" as const,
      label: "ניגודיות",
      min: 0.7,
      max: 1.6,
      step: 0.02,
      set: setContrast,
      fmt: (v: number) => (v === 1 ? "רגיל" : v.toFixed(2)),
    },
    {
      key: "saturation" as const,
      label: "רוויה",
      min: 0,
      max: 1.6,
      step: 0.02,
      set: setSaturation,
      fmt: (v: number) => (v === 1 ? "רגיל" : v.toFixed(2)),
    },
    {
      key: "detail" as const,
      label: "חידוד פרטים (טקסט וקווים)",
      min: 0,
      max: 1,
      step: 0.05,
      set: setDetail,
      fmt: (v: number) => `${Math.round(v * 100)}%`,
    },
    {
      key: "dither" as const,
      label: "פיזור (Dithering)",
      min: 0,
      max: 0.05,
      step: 0.005,
      set: setDither,
      fmt: (v: number) => (v === 0 ? "כבוי" : v.toFixed(3)),
    },
  ];
  const sliderValue = (k: (typeof SLIDERS)[number]["key"]): number =>
    k === "zoom"
      ? zoom
      : k === "contrast"
        ? contrast
        : k === "saturation"
          ? saturation
          : k === "detail"
            ? detail
            : dither;

  const TOGGLES = [
    {
      key: "autoLevels",
      label: "שיפור אוטומטי (ניגודיות חכמה)",
      value: autoLevels,
      set: setAutoLevels,
    },
    {
      key: "faceAware",
      label: "הדגשת פנים (לדיוקנאות)",
      value: faceAware,
      set: setFaceAware,
    },
    {
      key: "smoothGradients",
      label: "מעברי צבע חלקים (לתמונות)",
      value: smoothGradients,
      set: setSmoothGradients,
    },
    {
      key: "lineArt",
      label: "מצב טקסט / קו (ללוגו וכיתוב)",
      value: lineArt,
      set: setLineArt,
    },
  ];

  // Primary action + label, shared by the desktop order card and the mobile
  // fixed bottom bar (authoring → save, embedded → proceed, else → order).
  const primaryAction = () => {
    if (authoring) {
      if (result) onSaveSettings?.(currentSettings());
      return;
    }
    if (embedded) {
      if (result)
        onProceed?.({ file, pixelMap: result.pixelMap, cols, rows, price: price.total });
      return;
    }
    void handleOrder();
  };
  const ctaLabel = authoring
    ? "שמירת הגדרות"
    : embedded
      ? (proceedLabel ?? "המשך")
      : submitting
        ? "מעבד…"
        : "הוספה לעגלה";
  const ctaDisabled = submitting || !result;
  /**
   * The canvas only exists once there's something to show. An empty baseplate
   * asking for an upload just duplicated the upload card below it, and read as
   * a broken box on small screens.
   */
  const hasImage = Boolean(imageData || result);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 pb-28 sm:p-6 lg:pb-28">
      {/* Lives outside the canvas section so the upload button still works
          before any image exists (the section is unmounted until then). */}
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
    <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
      {/* Canvas stage (DOM-first; flex-row-reverse puts it on the LEFT in RTL).
          On mobile/tablet it's a full-bleed panel PINNED below the site header,
          so the artwork stays visible while you work the settings underneath.
          Opaque (not translucent) + a hard bottom edge so it reads as its own
          section rather than something floating over the page. */}
      {hasImage && (
      <section className="flex min-w-0 flex-1 flex-col gap-3 max-lg:sticky max-lg:top-16 max-lg:z-30 max-lg:self-start max-lg:-mx-4 max-lg:border-b-2 max-lg:border-outline max-lg:bg-surface max-lg:px-4 max-lg:pb-3 max-lg:pt-1 max-lg:shadow-[0_10px_18px_-14px_rgba(25,28,30,0.5)] sm:max-lg:-mx-6 sm:max-lg:px-6">

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
              {/* Reframe lock — while locked the canvas never swallows touch
                  gestures, so the page scrolls normally over the artwork. */}
              <button
                type="button"
                aria-pressed={!panLocked}
                title={
                  zoom > 1
                    ? panLocked
                      ? "פתיחת נעילה להזזת התמונה"
                      : "נעילת ההזזה"
                    : "הגדילו את הזום כדי להזיז את התמונה"
                }
                disabled={zoom <= 1}
                onClick={() => setPanLocked((v) => !v)}
                className={`flex h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium leading-none transition-colors active:translate-y-px disabled:opacity-40 ${
                  !panLocked && zoom > 1
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-outline bg-surface hover:bg-surface-muted"
                }`}
              >
                <span className="mi text-[18px]">
                  {panLocked ? "lock" : "lock_open"}
                </span>
                <span className="max-sm:hidden">
                  {panLocked ? "נעול" : "הזזה"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Canvas + cm guideline rulers (W along the top, H along the start
            edge). The wrapper reserves space for the rulers via logical padding
            so they line up with the recessed baseplate exactly. */}
        <div className={`relative ${result ? "lg:pt-7 lg:ps-10" : ""}`}>
          {result && (
            <>
              {/* Width ruler (top) — desktop only; mobile keeps the canvas tall. */}
              <div className="pointer-events-none absolute top-0 end-0 start-[40px] flex h-7 items-center max-lg:hidden">
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
              {/* Height ruler (inline-start = right in RTL) — desktop only. */}
              <div className="pointer-events-none absolute bottom-0 start-0 top-7 flex w-10 justify-center max-lg:hidden">
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
            className={`relative mx-auto flex items-center justify-center overflow-hidden border border-outline [--canvas-h:38vh] lg:[--canvas-h:400vh] ${
              result ? "rounded-none" : "rounded-2xl"
            }`}
            style={{
              // Never taller than --canvas-h (so the canvas section fits the
              // first screen on any phone/tablet) and never wider than its
              // column. Height follows from the aspect ratio, so the board is
              // always fully visible and centred whatever the plate shape.
              width: `min(100%, calc(var(--canvas-h) * ${cols} / ${rows}))`,
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
                !panLocked && zoom > 1
                  ? "cursor-grab touch-none active:cursor-grabbing"
                  : ""
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

            {/* First pass: the board exists but the worker hasn't returned yet. */}
            {!result && (
              <span className="absolute inset-0 flex items-center justify-center text-sm text-foreground/55">
                בונים את הפסיפס…
              </span>
            )}

            {/* Baseplate seams. The kit ships as platesX × platesY separate
                24×24 boards, so show where they join — it makes the physical
                product legible ("this is 9 panels") instead of one flat image. */}
            {result && (platesX > 1 || platesY > 1) && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: [
                    `repeating-linear-gradient(to right, rgba(255,255,255,.42) 0 1px, transparent 1px ${100 / platesX}%)`,
                    `repeating-linear-gradient(to bottom, rgba(255,255,255,.42) 0 1px, transparent 1px ${100 / platesY}%)`,
                    `repeating-linear-gradient(to right, rgba(0,0,0,.30) 0 1px, transparent 1px ${100 / platesX}%)`,
                    `repeating-linear-gradient(to bottom, rgba(0,0,0,.30) 0 1px, transparent 1px ${100 / platesY}%)`,
                  ].join(","),
                  backgroundPosition: "0 0, 0 0, 1px 0, 0 1px",
                }}
              />
            )}

            {result && zoom > 1 && !panLocked && (
              <span className="absolute top-3 end-3 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-on-secondary shadow">
                גררו להזזת המסגרת
              </span>
            )}
          </div>
        </div>

        {working && result && (
          <p className="px-1 text-sm text-foreground/55">מעבד…</p>
        )}

      </section>
      )}

      {/* Sidebar — upload, board, palette, settings, order (RTL start = right).
          Before an image exists there's no canvas beside it, so it takes the
          full width and centres instead of hugging one edge. */}
      <aside
        className={`flex w-full flex-col gap-4 ${
          hasImage ? "lg:w-[372px] lg:shrink-0" : "lg:mx-auto lg:max-w-2xl"
        }`}
      >
        {/* Upload card */}
        <div className="card flex flex-col gap-3 p-4">
          <h3 className="flex items-center gap-2 font-heading text-base font-bold">
            <span className="mi text-[21px] text-primary">image</span>
            התמונה
          </h3>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary min-h-[56px] w-full text-base"
          >
            <span className="mi text-[22px]">add_photo_alternate</span>
            {file ? "החלפת תמונה" : "העלו תמונה"}
          </button>
          <span className="text-center text-xs text-foreground/55">
            {file ? "JPG · PNG · WEBP" : "או התחילו מעיצוב מוכן:"}
          </span>

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
            <h3 className="flex items-center gap-2 font-heading text-base font-bold">
              <span className="mi text-[21px] text-secondary">grid_view</span>
              גודל הלוח
            </h3>
            <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
              {pair(
                Math.round(platesX * CM_PER_PLATE),
                Math.round(platesY * CM_PER_PLATE),
              )}{" "}
              ס&quot;מ
            </span>
          </div>

          {/* Quick-pick preset sizes (redesign). Hidden in budget mode, where the
              area is constrained and both axes must stay within the allowance. */}
          {!budgetMode && (
            <div className="-mt-3.5 flex gap-2 overflow-x-auto pb-1 pt-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-0 lg:flex-wrap lg:overflow-visible lg:pt-2">
              {SIZE_PRESETS.map((p) => {
                const on = p.x === platesX && p.y === platesY;
                const cell = p.x >= 5 ? 7 : p.x >= 4 ? 8 : 10;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      if (imageData) setWorking(true);
                      setPlatesX(p.x);
                      setPlatesY(p.y);
                    }}
                    className={`relative flex w-[96px] flex-none flex-col items-center gap-1.5 rounded-2xl border-2 px-2 pb-2.5 pt-3 transition-transform active:translate-y-px ${
                      on
                        ? "border-secondary bg-secondary/5"
                        : "border-outline bg-surface"
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2.5 start-0 end-0 mx-auto w-max rounded-full bg-accent px-2 py-0.5 text-[11px] font-black text-[#4a3500] shadow-[0_2px_0_0_#c99a13]">
                        הנמכר ביותר
                      </span>
                    )}
                    <span className="flex h-[42px] items-center justify-center">
                      <span
                        className="grid gap-0.5"
                        style={{
                          gridTemplateColumns: `repeat(${p.x}, ${cell}px)`,
                        }}
                      >
                        {Array.from({ length: p.x * p.y }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              width: cell,
                              height: cell,
                              borderRadius: 2,
                              background: on ? "#1d4ed8" : "#b9c2cb",
                              boxShadow:
                                "inset 0 1px 1px rgba(255,255,255,.4), inset 0 -1px 2px rgba(0,0,0,.28)",
                            }}
                          />
                        ))}
                      </span>
                    </span>
                    <span
                      className={`font-heading text-[13px] font-black ${on ? "text-secondary" : "text-foreground"}`}
                    >
                      {p.name}
                    </span>
                    <span className="text-[11px] text-foreground/55">
                      {pair(
                        Math.round(p.x * CM_PER_PLATE),
                        Math.round(p.y * CM_PER_PLATE),
                      )}{" "}
                      ס&quot;מ
                    </span>
                    <span
                      className={`font-heading text-[13px] font-bold ${on ? "text-secondary" : "text-foreground"}`}
                    >
                      {formatILS(
                        computePrice(
                          p.x * PLATE_STUDS,
                          p.y * PLATE_STUDS,
                          "physical",
                        ).total,
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

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
          <button
            type="button"
            onClick={() => setAdvOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-start"
          >
            <h3 className="flex items-center gap-2 font-heading text-base font-bold">
              <span className="mi text-[21px]" style={{ color: "#9a7400" }}>
                tune
              </span>
              כיוונון התמונה
            </h3>
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/55">
              {advOpen ? "סגירה" : "ניגודיות, רוויה, זום"}
              <span
                className="mi text-[22px]"
                style={{ rotate: advOpen ? "180deg" : "0deg" }}
              >
                expand_more
              </span>
            </span>
          </button>
          {advOpen && (
            <div className="flex flex-col gap-4">
              {/* One-tap looks. "מקורי" is the default and is pure fidelity —
                  no contrast/saturation push, so skin stays skin. */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">סגנון</span>
                <div className="flex flex-wrap gap-2">
                  {ENGINE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!imageData}
                      onClick={() => applyPreset(p.id)}
                      className={`rounded-full border-2 px-3.5 py-1.5 font-heading text-sm font-semibold transition-colors disabled:opacity-40 ${
                        presetId === p.id
                          ? "border-secondary bg-secondary/10 text-secondary"
                          : "border-outline bg-surface text-foreground/70 hover:bg-surface-muted"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {SLIDERS.map((s) => (
                <label
                  key={s.key}
                  // Generous vertical padding + a horizontal gutter around the
                  // track: it leaves dead space to start a scroll gesture in,
                  // so a thumb never lands straight on a slider.
                  className="flex flex-col gap-1.5 py-1.5"
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
                    {s.label}
                    <span className="font-heading text-sm font-bold text-secondary">
                      {s.fmt(sliderValue(s.key))}
                    </span>
                  </span>
                  {/* px gutter: leaves a dead strip at each edge of the row to
                      start a scroll gesture in, so a thumb never lands on the
                      track by accident. (Sizing lives here, not on the input —
                      the .slider rule sets width:100%.) */}
                  <span className="block px-3">
                    <input
                      className="slider"
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={sliderValue(s.key)}
                      disabled={!imageData}
                      onChange={(e) => {
                        if (imageData) setWorking(true);
                        setPresetId("custom");
                        s.set(Number(e.target.value));
                      }}
                    />
                  </span>
                </label>
              ))}

              {TOGGLES.map((t) => (
                <label
                  key={t.key}
                  className="flex min-h-[44px] items-center justify-between gap-3 text-sm font-medium"
                >
                  {t.label}
                  <input
                    type="checkbox"
                    className="h-5 w-5 flex-none accent-[var(--color-secondary)]"
                    checked={t.value}
                    disabled={!imageData}
                    onChange={(e) => {
                      if (imageData) setWorking(true);
                      setPresetId("custom");
                      t.set(e.target.checked);
                    }}
                  />
                </label>
              ))}

              <button
                type="button"
                onClick={resetAdjustments}
                className="self-start text-xs font-medium text-foreground/50 underline"
              >
                איפוס הכיוונונים
              </button>
            </div>
          )}
        </div>

        {/* Color palette — stud swatches; click to add/remove a color. */}
        <div className="card flex flex-col gap-3 p-4">
          <button
            type="button"
            onClick={() => setPalOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-start"
          >
            <h3 className="flex items-center gap-2 font-heading text-base font-bold">
              <span className="mi text-[21px] text-success">palette</span>
              פלטת צבעים
            </h3>
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/55 lg:hidden">
              {autoPalette ? autoUsedIds.size || colorCount : enabled.size} פעילים
              <span
                className="mi text-[22px]"
                style={{ rotate: palOpen ? "180deg" : "0deg" }}
              >
                expand_more
              </span>
            </span>
          </button>
          <div
            className={`flex flex-col gap-3 ${palOpen ? "" : "max-lg:hidden"}`}
          >
            {/* Auto vs manual. In auto the engine picks the best N colours for
                this specific photo; in manual the customer curates the set. */}
            <div className="flex gap-2">
              {(
                [
                  [true, "אוטומטי"],
                  [false, "בחירה ידנית"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (imageData) setWorking(true);
                    setAutoPalette(mode);
                  }}
                  className={`flex-1 rounded-xl border-2 px-3 py-2 font-heading text-sm font-semibold transition-colors ${
                    autoPalette === mode
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-outline bg-surface text-foreground/70 hover:bg-surface-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {autoPalette ? (
              <label className="flex flex-col gap-1.5 py-1.5">
                <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
                  מספר צבעים
                  <span className="font-heading text-sm font-bold text-secondary">
                    {colorCount}
                  </span>
                </span>
                <span className="block px-3">
                  <input
                    className="slider"
                    type="range"
                    min={6}
                    max={visibleColors.length}
                    step={1}
                    value={Math.min(colorCount, visibleColors.length)}
                    disabled={!imageData}
                    onChange={(e) => {
                      if (imageData) setWorking(true);
                      setColorCountOverride(Number(e.target.value));
                    }}
                  />
                </span>
                <span className="text-xs leading-relaxed text-foreground/55">
                  פחות צבעים = מראה נקי ובולט וערכה פשוטה יותר להרכבה. יותר
                  צבעים = מעברים עדינים יותר. מעל ~20 צבעים ההבדל כמעט לא מורגש.
                </span>
              </label>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-foreground/55">
                  לחצו על לבנה כדי להוסיף או להסיר צבע מהפסיפס.
                </p>
                <button
                  type="button"
                  className="flex-none text-xs text-foreground/50 underline"
                  onClick={() => {
                    if (imageData) setWorking(true);
                    setCustomEnabled(null);
                  }}
                >
                  איפוס
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              {visibleColors.map((c) => (
                <BrickSwatch
                  key={c.id}
                  hex={c.hex}
                  name={c.nameHe}
                  // In auto mode the swatches become a read-out of what the
                  // engine actually chose for this image.
                  on={autoPalette ? autoUsedIds.has(c.id) : enabled.has(c.id)}
                  disabled={!c.inStock}
                  readOnly={autoPalette}
                  pending={!c.confirmed}
                  onClick={() => toggleColor(c.id, c.inStock)}
                />
              ))}
            </div>
            <span className="text-xs text-foreground/45">
              {autoPalette
                ? `${autoUsedIds.size || colorCount} צבעים נבחרו אוטומטית מתוך ${visibleColors.length}`
                : `${enabled.size} צבעים פעילים`}
            </span>
            {/* Internal supply status — every colour is usable, the pip just
                marks the ones the supplier hasn't confirmed yet. */}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-foreground/45">
                <span
                  className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
                {pendingCount} צבעים ממתינים לאישור הספק
              </span>
            )}
          </div>
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

        {/* Mobile: color breakdown stays in-flow; price + CTA move to the fixed
            bottom bar so they're always reachable while editing. */}
        {result && (
          <div className="px-1 lg:hidden">
            <ColorBreakdown pixelMap={result.pixelMap} palette={activePalette} />
          </div>
        )}
        {error && (
          <p className="px-1 text-sm text-red-600 lg:hidden">{error}</p>
        )}
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

      {/* Desktop floating cart — bottom-LEFT corner (end-* is left in RTL), so
          the canvas stays the isolated focus of the page. The colour breakdown
          sits directly above it and is collapsed by default: it's reference
          detail, not something a customer needs while designing. */}
      <div className="fixed bottom-6 end-6 z-40 hidden w-[340px] flex-col gap-3 lg:flex">
        {result && (
          <div className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setBreakdownOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start"
            >
              <span className="font-heading text-sm font-bold">
                פירוט צבעים
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/55">
                {enabled.size} צבעים
                <span
                  className="mi text-[20px]"
                  style={{ rotate: breakdownOpen ? "0deg" : "180deg" }}
                >
                  expand_more
                </span>
              </span>
            </button>
            {breakdownOpen && (
              <div className="max-h-[45vh] overflow-y-auto border-t border-outline p-3">
                <ColorBreakdown
                  pixelMap={result.pixelMap}
                  palette={activePalette}
                />
              </div>
            )}
          </div>
        )}
        {orderCard}
      </div>

      {/* Mobile fixed action bar — total + primary CTA, always reachable while
          the canvas stays pinned at the top. Hidden on desktop (lg). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-outline bg-surface/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex flex-none flex-col gap-0.5">
            {!hidePricing ? (
              <>
                <span className="font-heading text-2xl font-black leading-none text-primary">
                  {formatILS(price.total)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                  <span className="mi text-[15px]">local_shipping</span>
                  משלוח חינם
                </span>
              </>
            ) : (
              <span className="text-xs text-foreground/60">
                {pair(
                  Math.round(platesX * CM_PER_PLATE),
                  Math.round(platesY * CM_PER_PLATE),
                )}{" "}
                ס״מ
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={primaryAction}
            disabled={ctaDisabled}
            className="btn btn-primary min-h-[52px] flex-1 text-base"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

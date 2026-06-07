"use client";
/**
 * B2C Studio — upload a photo, see a live OKLab brick preview, pick size +
 * fulfillment, fill details, and order. RTL Hebrew; logical properties only.
 *
 * The Brick Engine runs in a Web Worker (useBrickWorker); the resulting
 * pixel_map is persisted with the order and later trusted by the PDF route.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { type BrickifyResult } from "@/lib/brick-engine";
import { useBrickWorker } from "@/lib/brick-engine/useBrickWorker";
import { renderBricks } from "@/lib/brick-render";
import { fileToImageData } from "@/lib/image";
import { computePrice, formatILS, SIZES, type MosaicSize } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";
import { uploadToSignedUrl } from "@/lib/supabase/storage";
import type { FulfillmentType } from "@/lib/supabase/types.helpers";

export function Studio() {
  const { brickify } = useBrickWorker();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [size, setSize] = useState<MosaicSize>(48);
  // Pre-processing controls (defaults bias toward crisp, vivid output).
  const [contrast, setContrast] = useState(1.2);
  const [saturation, setSaturation] = useState(1.1);
  // Dithering off by default (it reads as speckle at stud resolution).
  const [dither, setDither] = useState(0);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("digital");
  const [result, setResult] = useState<BrickifyResult | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const price = computePrice(size, fulfillment);

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
    brickify(imageData, {
      cols: size,
      rows: size,
      preprocess: { contrast, saturation },
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
  }, [imageData, size, contrast, saturation, dither, brickify]);

  async function handleOrder() {
    setError(null);
    if (!file || !result) return setError("נא להעלות תמונה תחילה.");
    if (!name.trim() || !email.trim())
      return setError("נא למלא שם וכתובת אימייל.");
    if (fulfillment === "physical" && (!street || !city || !zip))
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
          fulfillment_type: fulfillment,
          image_url: path,
          pixel_map: result.pixelMap,
          shipping_address:
            fulfillment === "physical" ? { street, city, zip } : null,
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
      {/* Preview / upload */}
      <section className="flex flex-col gap-4">
        <label className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
          {/* Canvas is always mounted so its ref is stable for the first paint. */}
          <canvas
            ref={canvasRef}
            className={`h-full w-full object-contain ${result ? "" : "hidden"}`}
          />
          {!result && (
            <span className="px-6 text-center text-zinc-500">
              לחצו כדי להעלות תמונה
              <br />
              <span className="text-sm">JPG · PNG · WEBP</span>
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
        {result && (
          <p className="text-sm text-zinc-500">
            {result.cols}×{result.rows} אריחים · {result.cols * result.rows}{" "}
            חלקים
          </p>
        )}
      </section>

      {/* Controls */}
      <section className="flex flex-col gap-5">
        <h2 className="font-heading text-2xl font-bold">הזמינו את הפסיפס שלכם</h2>

        <div>
          <p className="mb-2 text-sm font-medium">גודל</p>
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (imageData) setWorking(true);
                  setSize(s);
                }}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  size === s
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {s}×{s}
                <span className="block text-xs opacity-70">
                  {s === 24 ? "מיני" : s === 48 ? "רגיל 2×2" : "גדול 3×3"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Pre-processing: higher contrast keeps edges crisp; saturation keeps
            colors vivid. Disabled until an image is loaded. */}
        <div className="grid gap-3">
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
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">סוג אספקה</p>
          <div className="flex gap-2">
            {(
              [
                ["digital", "דיגיטלי (PDF)"],
                ["physical", "ערכה פיזית"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFulfillment(val)}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  fulfillment === val
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="שם מלא"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            dir="ltr"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-start dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="אימייל"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fulfillment === "physical" && (
            <div className="grid grid-cols-2 gap-3">
              <input
                className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="רחוב ומספר"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <input
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="עיר"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <input
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="מיקוד"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <span className="text-2xl font-bold">{formatILS(price.total)}</span>
          <button
            type="button"
            onClick={() => void handleOrder()}
            disabled={submitting || !result}
            className="rounded-full bg-black px-8 py-3 text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {submitting ? "מעבד…" : "להזמנה"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

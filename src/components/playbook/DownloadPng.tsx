"use client";

/**
 * Rasterises a brand SVG to a transparent PNG in the browser and downloads it.
 *
 * Why client-side rather than shipping .png files: rasterising SVG text needs
 * the Rubik font available to the rasteriser. In the browser it is loaded and
 * correct by construction (we await document.fonts.ready); in Node it is not
 * guaranteed, and a silently font-substituted logo is worse than no file.
 * As a bonus the user picks the size, so there is no "we only shipped 1600px".
 */

import { useState } from "react";

const SIZES = [800, 1600, 3200];

export function DownloadPng({ name, label }: { name: string; label: string }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(width: number) {
    setBusy(width);
    setErr(null);
    try {
      if (document.fonts?.ready) await document.fonts.ready;

      const res = await fetch(`/brand/${name}.svg`);
      if (!res.ok) throw new Error(`SVG not found (${res.status})`);
      const markup = await res.text();

      const vb = markup
        .match(/viewBox="([\d.\s-]+)"/)?.[1]
        .trim()
        .split(/\s+/)
        .map(Number);
      if (!vb) throw new Error("no viewBox");
      const ratio = vb[3] / vb[2];

      // btoa() is latin1-only and the Hebrew lockup contains non-latin1 glyphs,
      // so encode as UTF-8 bytes first or it throws InvalidCharacterError.
      const b64 = btoa(
        String.fromCharCode(...new TextEncoder().encode(markup)),
      );

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((ok, bad) => {
        img.onload = () => ok();
        img.onerror = () => bad(new Error("rasterise failed"));
        img.src = `data:image/svg+xml;base64,${b64}`;
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round(width * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-${width}.png`;
      a.click();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs text-foreground/50">PNG:</span>
      {SIZES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => run(s)}
          disabled={busy !== null}
          aria-label={`${label} — PNG ברוחב ${s} פיקסלים`}
          className="rounded-md border border-outline px-2 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
        >
          {busy === s ? "…" : `${s}px`}
        </button>
      ))}
      {err && <span className="text-xs text-primary">{err}</span>}
    </span>
  );
}

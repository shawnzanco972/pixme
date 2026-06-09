"use client";
/**
 * Admin manager for the ready-made designs gallery.
 *
 * Add new artwork (image + title + default baseplate size), reorder via
 * sort_order, toggle visibility, and delete. Brick count is derived from the
 * default size (24 studs per plate edge) — the same number the customer sees.
 *
 * All mutations go through /api/admin/designs (service-role writes); this
 * component keeps an optimistic local copy so the grid updates immediately.
 */
import { useRef, useState } from "react";

import { Studio } from "@/components/b2c/Studio";
import { MosaicThumb } from "@/components/MosaicThumb";
import {
  parseEngineSettings,
  type DesignSettings,
} from "@/lib/design-settings";
import type { ReadyDesign } from "@/lib/supabase/types.helpers";

const CM_PER_PLATE = 19.2;
const STUDS_PER_PLATE = 24;

export interface DesignItem extends ReadyDesign {
  imageUrl: string;
}

function brickCount(px: number, py: number): number {
  return px * STUDS_PER_PLATE * py * STUDS_PER_PLATE;
}
function cmLabel(px: number, py: number): string {
  return `${Math.round(px * CM_PER_PLATE)}×${Math.round(py * CM_PER_PLATE)} ס״מ`;
}

const PLATE_OPTIONS = [1, 2, 3, 4, 5];

export function DesignsManager({ initial }: { initial: DesignItem[] }) {
  const [designs, setDesigns] = useState<DesignItem[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DesignItem | null>(null);

  // Add form state
  const [title, setTitle] = useState("");
  const [px, setPx] = useState(2);
  const [py, setPy] = useState(2);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !file) {
      setError("צריך כותרת ותמונה.");
      return;
    }
    setAdding(true);
    try {
      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("file", file);
      fd.set("default_plates_x", String(px));
      fd.set("default_plates_y", String(py));
      fd.set("sort_order", String(designs.length));
      const res = await fetch("/api/admin/designs", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "שגיאה");
      setDesigns((d) => [...d, { ...json.design, imageUrl: preview ?? "" }]);
      // Reset the form.
      setTitle("");
      setFile(null);
      setPreview(null);
      setPx(2);
      setPy(2);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאה");
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, fields: Partial<ReadyDesign>) {
    setBusyId(id);
    setError(null);
    // Optimistic update.
    setDesigns((list) =>
      list.map((d) => (d.id === id ? { ...d, ...fields } : d)),
    );
    try {
      const res = await fetch("/api/admin/designs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "שגיאה");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את העיצוב?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/designs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "שגיאה");
      }
      setDesigns((list) => list.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקה");
    } finally {
      setBusyId(null);
    }
  }

  async function setHero(id: string) {
    setBusyId(id);
    setError(null);
    // Optimistic: exactly one hero.
    setDesigns((list) =>
      list.map((d) => ({ ...d, is_hero: d.id === id })),
    );
    try {
      const res = await fetch("/api/admin/designs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_hero: true }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "שגיאה");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהגדרת ראשי");
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings(id: string, s: DesignSettings) {
    const { platesX, platesY, ...engine } = s;
    setBusyId(id);
    setError(null);
    setDesigns((list) =>
      list.map((d) =>
        d.id === id
          ? {
              ...d,
              default_plates_x: platesX,
              default_plates_y: platesY,
              settings: engine,
            }
          : d,
      ),
    );
    try {
      const res = await fetch("/api/admin/designs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          default_plates_x: platesX,
          default_plates_y: platesY,
          settings: engine,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "שגיאה");
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירת הגדרות");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </p>
      )}

      {/* Add new design */}
      <form onSubmit={add} className="card flex flex-col gap-4 p-4">
        <h2 className="font-heading text-lg font-semibold">הוספת עיצוב</h2>
        <div className="grid gap-4 md:grid-cols-[160px_1fr]">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline bg-surface-muted text-sm text-zinc-500 hover:border-primary"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              "בחרו תמונה"
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">כותרת</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="לדוגמה: חתול פיקסל"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">רוחב (לוחות)</span>
                <select
                  className="input"
                  value={px}
                  onChange={(e) => setPx(Number(e.target.value))}
                >
                  {PLATE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">גובה (לוחות)</span>
                <select
                  className="input"
                  value={py}
                  onChange={(e) => setPy(Number(e.target.value))}
                >
                  {PLATE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-sm text-zinc-600">
              {cmLabel(px, py)} · {brickCount(px, py).toLocaleString("he-IL")} לבנים
            </p>

            <div>
              <button
                type="submit"
                disabled={adding}
                className="btn btn-primary"
              >
                {adding ? "מעלה…" : "הוספה לגלריה"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Existing designs */}
      {designs.length === 0 ? (
        <p className="text-sm text-zinc-500">עדיין אין עיצובים בגלריה.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <div
              key={d.id}
              className={`card flex flex-col gap-3 p-3 ${
                d.active ? "" : "opacity-60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-surface-muted p-1">
                <MosaicThumb
                  imageUrl={d.imageUrl}
                  platesX={d.default_plates_x}
                  platesY={d.default_plates_y}
                  settings={parseEngineSettings(d.settings)}
                  className="max-h-full max-w-full rounded"
                />
              </div>
              <input
                className="input text-sm font-medium"
                defaultValue={d.title}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== d.title) patch(d.id, { title: v });
                }}
              />
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs">
                  <span className="text-zinc-500">רוחב</span>
                  <select
                    className="input"
                    value={d.default_plates_x}
                    onChange={(e) =>
                      patch(d.id, { default_plates_x: Number(e.target.value) })
                    }
                  >
                    {PLATE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs">
                  <span className="text-zinc-500">גובה</span>
                  <select
                    className="input"
                    value={d.default_plates_y}
                    onChange={(e) =>
                      patch(d.id, { default_plates_y: Number(e.target.value) })
                    }
                  >
                    {PLATE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-xs text-zinc-600">
                {cmLabel(d.default_plates_x, d.default_plates_y)} ·{" "}
                {brickCount(
                  d.default_plates_x,
                  d.default_plates_y,
                ).toLocaleString("he-IL")}{" "}
                לבנים
              </p>
              <button
                type="button"
                onClick={() => setEditing(d)}
                className="btn btn-ghost w-full text-sm"
              >
                ✎ עריכת ברירת מחדל
              </button>
              <button
                type="button"
                disabled={busyId === d.id || d.is_hero}
                onClick={() => setHero(d.id)}
                className={`w-full rounded-lg px-3 py-1.5 text-sm ${
                  d.is_hero
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-zinc-600 hover:bg-surface-muted"
                }`}
              >
                {d.is_hero ? "★ מוצג בכותרת הראשית" : "☆ הצג בכותרת הראשית"}
              </button>
              <div className="mt-auto flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={d.active}
                    onChange={(e) => patch(d.id, { active: e.target.checked })}
                  />
                  מוצג באתר
                </label>
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => remove(d.id)}
                  className="text-sm text-primary hover:underline"
                >
                  מחיקה
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings editor — opens the real studio in authoring mode, pre-loaded
          with the artwork + saved settings. "Save" persists them as the
          customer's starting point. */}
      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-2 md:p-6">
          <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline p-3">
              <h3 className="font-heading text-lg font-semibold">
                ברירת מחדל — {editing.title}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-1 text-sm hover:bg-surface-muted"
              >
                סגירה ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Studio
                embedded
                hidePricing
                authoring
                initialImageUrl={editing.imageUrl}
                initialImageName={`${editing.title}.png`}
                initialPlatesX={editing.default_plates_x}
                initialPlatesY={editing.default_plates_y}
                initialSettings={parseEngineSettings(editing.settings)}
                onSaveSettings={(s) => void saveSettings(editing.id, s)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

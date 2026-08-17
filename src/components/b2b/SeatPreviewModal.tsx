"use client";
/**
 * Full-size review of one employee's mosaic, opened from their row.
 *
 * Approving a gift from a 110px thumbnail is guesswork — you can't tell whether
 * a face reads at stud resolution until you see it big. So the manager gets the
 * mosaic at the largest size the viewport allows, with the approve / send-back
 * controls right there: look, decide, act, without hunting back to the row.
 */
import { useEffect, useRef } from "react";

import { renderBricks } from "@/lib/brick-render";

export function SeatPreviewModal({
  name,
  pixelMap,
  sizeLabel,
  canReview,
  busy,
  onApprove,
  onReject,
  onClose,
}: {
  name: string;
  pixelMap: number[][];
  sizeLabel: string;
  /** Only a seat awaiting review gets the decision buttons. */
  canReview: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (canvasRef.current) renderBricks(canvasRef.current, pixelMap);
  }, [pixelMap]);

  // Escape closes; focus lands on the close button so keyboard users aren't
  // stranded behind the overlay.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cols = pixelMap[0]?.length ?? 1;
  const rows = pixelMap.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`הפסיפס של ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-auto rounded-3xl bg-surface p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-black">{name}</h2>
            <p className="text-sm text-foreground/60">
              {sizeLabel} · ⁦{cols}×{rows}⁩ לבנים
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="btn btn-ghost min-h-10 w-10 px-0"
          >
            <span className="mi text-[20px]">close</span>
          </button>
        </div>

        {/* Framed like a hung mosaic so the manager judges the real thing. */}
        <div
          className="rounded-2xl p-3 sm:p-4"
          style={{
            background:
              "linear-gradient(150deg, #3c424a 0%, #23272d 48%, #14171b 100%)",
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg"
            style={{ aspectRatio: `${cols} / ${rows}`, imageRendering: "pixelated" }}
          />
        </div>

        <p className="text-center text-xs text-foreground/55">
          כך ייראה הפסיפס המורכב. התרחקו מהמסך צעד — מקרוב רואים לבנים, מרחוק
          רואים את התמונה.
        </p>

        {canReview && (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="btn btn-ghost text-primary"
            >
              החזרה לעובד
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="btn btn-primary"
            >
              אישור העיצוב
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

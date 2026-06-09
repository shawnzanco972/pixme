"use client";
/**
 * One employee seat on the owner dashboard: mosaic preview, dimensions, status,
 * the personal seat link, and the owner's review controls (approve — optionally
 * with a fulfillment date — request changes, or reopen an approval). Approving a
 * single seat lets the owner place that employee's order independently (e.g. a
 * birthday gift) without waiting for the whole roster.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MosaicThumb } from "@/components/b2b/MosaicThumb";
import type { SeatStatus } from "@/lib/b2b";

export interface SeatReviewRow {
  id: string;
  name: string;
  email: string | null;
  inviteToken: string;
  status: SeatStatus;
  submissionId: string | null;
  pixelMap: number[][] | null;
  scheduledFor: string | null;
  /** Plates currently allocated to this seat (owner-set or default share). */
  effectivePlates: number;
  /** Most plates this seat can be raised to without exceeding the pool. */
  maxPlates: number;
}

const STATUS_LABEL: Record<SeatStatus, string> = {
  not_started: "טרם התחיל",
  submitted: "ממתין לאישור",
  ready: "אושר",
  rejected: "נדחה",
};

const STATUS_CLASS: Record<SeatStatus, string> = {
  not_started: "bg-surface-muted text-zinc-600",
  submitted: "bg-secondary/10 text-secondary",
  ready: "bg-success/15 text-success",
  rejected: "bg-red-100 text-red-700",
};

type Action = "approve" | "reject" | "reopen" | "schedule";

export function SeatRow({
  token,
  row,
  emailConfigured,
}: {
  token: string;
  row: SeatReviewRow;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(
    row.scheduledFor ? row.scheduledFor.slice(0, 10) : "",
  );

  const cols = row.pixelMap?.[0]?.length ?? null;
  const rows = row.pixelMap?.length ?? null;

  const seatUrl = () =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/seat/${row.inviteToken}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(seatUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function sendInvite() {
    try {
      const res = await fetch("/api/b2b/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken: token, rosterId: row.id }),
      });
      if (res.ok) {
        setInvited(true);
        setTimeout(() => setInvited(false), 1500);
      }
    } catch {
      /* best-effort */
    }
  }

  async function allocate(plates: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/b2b/owner/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerToken: token,
          rosterId: row.id,
          action: "allocate",
          plates,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function act(action: Action) {
    if (!row.submissionId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/b2b/owner/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerToken: token,
          submissionId: row.submissionId,
          action,
          scheduledFor: scheduledFor || null,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
      {/* Preview */}
      <div className="w-full shrink-0 sm:w-28">
        {row.pixelMap ? (
          <MosaicThumb pixelMap={row.pixelMap} className="w-full" />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-outline bg-surface-muted text-xs text-zinc-400">
            אין עיצוב
          </div>
        )}
      </div>

      {/* Info + actions */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            {row.email && (
              <p className="truncate text-xs text-zinc-500" dir="ltr">
                {row.email}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}
          >
            {STATUS_LABEL[row.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {cols && rows && (
            <span>
              {cols}×{rows} אריחים
            </span>
          )}
          <label className="flex items-center gap-1">
            לוחות:
            <select
              value={row.effectivePlates}
              disabled={busy}
              onChange={(e) => void allocate(Number(e.target.value))}
              className="rounded border border-outline bg-surface px-1.5 py-0.5 text-xs"
              title="גודל המוקצה לעובד (מתוך מאגר הלוחות של הפרויקט)"
            >
              {Array.from({ length: row.maxPlates }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seat link controls */}
          {(row.status === "not_started" || row.status === "rejected") && (
            <a
              href={`/seat/${row.inviteToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost text-xs"
              title="העלו תמונה במקום העובד (גם להפתעה)"
            >
              עיצוב עבורו
            </a>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            className="btn btn-ghost text-xs"
          >
            {copied ? "הועתק!" : "העתקת קישור"}
          </button>
          {emailConfigured && row.email && (
            <button
              type="button"
              onClick={() => void sendInvite()}
              className="btn btn-ghost text-xs"
            >
              {invited ? "נשלח!" : "שליחת הזמנה"}
            </button>
          )}

          {/* Review controls (only once the employee submitted) */}
          {(row.status === "submitted" || row.status === "ready") && (
            <>
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                תאריך:
                <input
                  type="date"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="rounded border border-outline px-2 py-1 bg-surface text-xs"
                />
              </label>
              {row.status === "submitted" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("approve")}
                    className="btn btn-primary text-xs"
                  >
                    אישור והזמנה
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("reject")}
                    className="btn btn-ghost text-xs text-red-600"
                  >
                    בקשת שינוי
                  </button>
                </>
              )}
              {row.status === "ready" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("schedule")}
                    className="btn btn-ghost text-xs"
                  >
                    עדכון תאריך
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("reopen")}
                    className="btn btn-ghost text-xs"
                  >
                    ביטול אישור
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

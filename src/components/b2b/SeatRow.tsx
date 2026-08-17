"use client";
/**
 * One employee seat on the owner dashboard.
 *
 * Layout follows the owner's actual job: see the design, know whose move it is,
 * and act. Sharing the personal link is first-class (copy / WhatsApp / email)
 * because the company sends those links itself — we hold nothing about the
 * employee beyond the name and email the company already had.
 *
 * Sizes are shown in CENTIMETRES, never in "plates": plate credits are internal
 * vocabulary (see 0013_plate_allocation.sql) and the company bought a mosaic of
 * a certain size, not a number of baseplates.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MosaicThumb } from "@/components/b2b/MosaicThumb";
import { SeatPreviewModal } from "@/components/b2b/SeatPreviewModal";
import { CM_PER_PLATE, plateSizeLabel, type SeatStatus } from "@/lib/b2b";
import { SEAT_STATUS_META } from "@/lib/b2b-status";

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
  // --- Support diagnostics (admin view only) -------------------------------
  /** When the employee last saved/submitted. */
  updatedAt?: string | null;
  /** When the owner approved. */
  approvedAt?: string | null;
  /** Shipment batch this seat went out in, if any. */
  shipmentId?: string | null;
}

type Action = "approve" | "reject" | "reopen" | "schedule";

export function SeatRow({
  token,
  row,
  emailConfigured,
  selected,
  onSelect,
  onError,
  admin = false,
}: {
  token: string;
  row: SeatReviewRow;
  emailConfigured: boolean;
  selected: boolean;
  onSelect: (id: string, on: boolean) => void;
  onError: (msg: string) => void;
  /**
   * Operator view. Adds the things you need when an employee writes "the link
   * doesn't work": their exact seat page (openable at any status, not just the
   * unsubmitted ones), and the timestamps that say where they actually got to.
   */
  admin?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [name, setName] = useState(row.name);
  const [email, setEmail] = useState(row.email ?? "");
  const [scheduledFor, setScheduledFor] = useState(
    row.scheduledFor ? row.scheduledFor.slice(0, 10) : "",
  );

  const meta = SEAT_STATUS_META[row.status];
  const cols = row.pixelMap?.[0]?.length ?? null;
  const rows = row.pixelMap?.length ?? null;
  // What the employee actually used vs. what they were given — the difference
  // is slack the owner can hand to someone else.
  const usedPlates = cols && rows ? Math.round((cols / 24) * (rows / 24)) : null;
  const slack = usedPlates != null ? row.effectivePlates - usedPlates : 0;
  const locked = row.status === "released";

  const seatUrl = () =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/seat/${row.inviteToken}`;

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/b2b/owner/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken: token, ...payload }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        onError(j.error ?? "הפעולה נכשלה.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      onError("שגיאת רשת. נסו שוב.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(seatUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onError("הדפדפן חסם את ההעתקה — סמנו את הקישור ידנית.");
    }
  }

  function shareWhatsApp() {
    const text = `היי ${row.name}, הכנו לך מתנה 🎁\nבוחרים תמונה אהובה והיא הופכת לפסיפס לבנים שתרכיבו בבית.\nהקישור האישי שלך: ${seatUrl()}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
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
        setTimeout(() => setInvited(false), 1800);
      } else onError("שליחת המייל נכשלה.");
    } catch {
      onError("שליחת המייל נכשלה.");
    }
  }

  const act = (action: Action) =>
    post({
      submissionId: row.submissionId,
      action,
      scheduledFor: scheduledFor || null,
    });

  return (
    <li
      className={`card flex flex-col gap-3 p-3 sm:flex-row sm:items-start ${
        selected ? "ring-2 ring-secondary" : ""
      }`}
    >
      {/* Select + preview */}
      <div className="flex shrink-0 items-start gap-3">
        <input
          type="checkbox"
          aria-label={`בחירת ${row.name}`}
          checked={selected}
          onChange={(e) => onSelect(row.id, e.target.checked)}
          className="mt-1 h-5 w-5"
        />
        <div className="w-24 sm:w-28">
          {row.pixelMap ? (
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="group relative block w-full"
              title="הגדלה לבדיקה"
              aria-label={`הגדלת הפסיפס של ${row.name}`}
            >
              <MosaicThumb pixelMap={row.pixelMap} className="w-full" />
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="mi text-[22px] text-white">zoom_in</span>
              </span>
            </button>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-outline bg-surface-muted text-center text-[11px] text-foreground/45">
              עוד אין
              <br />
              עיצוב
            </div>
          )}
        </div>
      </div>

      {/* Info + actions */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          {editing ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
              <input
                className="input h-10 min-h-10 flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם"
              />
              <input
                className="input h-10 min-h-10 flex-1 text-start"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@company.co.il"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !name.trim()}
                  onClick={async () => {
                    const ok = await post({
                      rosterId: row.id,
                      action: "rename",
                      name,
                      email: email || null,
                    });
                    if (ok) setEditing(false);
                  }}
                  className="btn btn-primary min-h-10 px-3 text-xs"
                >
                  שמירה
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setName(row.name);
                    setEmail(row.email ?? "");
                    setEditing(false);
                  }}
                  className="btn btn-ghost min-h-10 px-3 text-xs"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-heading font-bold">{row.name}</p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`עריכת ${row.name}`}
                  className="text-foreground/35 transition-colors hover:text-secondary"
                >
                  <span className="mi text-[15px]">edit</span>
                </button>
              </div>
              {row.email ? (
                <p className="truncate text-xs text-foreground/55" dir="ltr">
                  {row.email}
                </p>
              ) : (
                <p className="text-xs text-foreground/40">בלי אימייל</p>
              )}
            </div>
          )}
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}
          >
            <span className="mi text-[14px]">{meta.icon}</span>
            {meta.label}
          </span>
        </div>

        {/* Size line — centimetres, never "plates" */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/55">
          <label className="flex items-center gap-1.5">
            גודל:
            <select
              value={row.effectivePlates}
              disabled={busy || locked}
              onChange={(e) =>
                void post({
                  rosterId: row.id,
                  action: "allocate",
                  plates: Number(e.target.value),
                })
              }
              className="rounded-lg border border-outline bg-surface px-2 py-1 text-xs disabled:opacity-50"
              title="הגודל שהוקצה לעובד הזה"
            >
              {Array.from({ length: Math.max(1, row.maxPlates) }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {plateSizeLabel(n)}
                  </option>
                ),
              )}
            </select>
          </label>
          {cols && rows && (
            <span>
              עיצב ⁦{Math.round((cols * CM_PER_PLATE) / 24)}×
              {Math.round((rows * CM_PER_PLATE) / 24)}⁩ ס״מ
            </span>
          )}
          {slack > 0 && (
            <span className="text-[#8a6d00]">
              ניצל פחות מהמוקצה — אפשר להעביר לעובד אחר
            </span>
          )}
        </div>

        {/* Share the personal link */}
        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="btn btn-ghost min-h-9 gap-1.5 px-2.5 text-xs"
            >
              <span className="mi text-[15px]">link</span>
              {copied ? "הועתק!" : "העתקת קישור"}
            </button>
            <button
              type="button"
              onClick={shareWhatsApp}
              className="btn btn-ghost min-h-9 gap-1.5 px-2.5 text-xs"
            >
              <span className="mi text-[15px]">chat</span>
              וואטסאפ
            </button>
            {emailConfigured && row.email && (
              <button
                type="button"
                onClick={() => void sendInvite()}
                className="btn btn-ghost min-h-9 gap-1.5 px-2.5 text-xs"
              >
                <span className="mi text-[15px]">mail</span>
                {invited ? "נשלח!" : row.status === "not_started" ? "שליחת הזמנה" : "שליחה חוזרת"}
              </button>
            )}
            {(row.status === "not_started" || row.status === "rejected") && (
              <>
                <a
                  href={`/seat/${row.inviteToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost min-h-9 gap-1.5 px-2.5 text-xs"
                  title="העלו תמונה במקומו — למשל כשזו הפתעה"
                >
                  <span className="mi text-[15px]">add_a_photo</span>
                  עיצוב עבורו
                </a>
                {row.status === "not_started" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void post({ rosterId: row.id, action: "remove" })
                    }
                    className="btn btn-ghost min-h-9 gap-1.5 px-2.5 text-xs text-primary"
                    title="הסרת העובד ושחרור המקום"
                  >
                    <span className="mi text-[15px]">person_remove</span>
                    הסרה
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Review controls */}
        {(row.status === "submitted" || row.status === "ready") && (
          <div className="flex flex-wrap items-center gap-2 border-t border-outline pt-2">
            <label className="flex items-center gap-1.5 text-xs text-foreground/55">
              לשלוח בתאריך:
              <input
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="rounded-lg border border-outline bg-surface px-2 py-1 text-xs"
              />
            </label>
            {row.status === "submitted" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("approve")}
                  className="btn btn-primary min-h-9 px-3 text-xs"
                >
                  אישור העיצוב
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("reject")}
                  className="btn btn-ghost min-h-9 px-3 text-xs text-primary"
                  title="מחזיר לעובד לעיצוב מחדש"
                >
                  בקשת שינוי
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("schedule")}
                  className="btn btn-ghost min-h-9 px-3 text-xs"
                >
                  עדכון תאריך
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("reopen")}
                  className="btn btn-ghost min-h-9 px-3 text-xs"
                >
                  ביטול אישור
                </button>
              </>
            )}
          </div>
        )}

        {locked && !admin && (
          <p className="border-t border-outline pt-2 text-xs text-foreground/55">
            הפסיפס הזה כבר בייצור — אי אפשר לשנות אותו.
          </p>
        )}

        {/* Operator diagnostics */}
        {admin && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-outline pt-2 text-xs text-foreground/50">
            <a
              href={`/seat/${row.inviteToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-secondary underline"
            >
              פתיחת עמוד העובד
            </a>
            <button
              type="button"
              onClick={() => void copy()}
              className="underline"
            >
              {copied ? "הועתק!" : "העתקת הקישור שלו"}
            </button>
            {row.updatedAt && (
              <span>
                עודכן {new Date(row.updatedAt).toLocaleString("he-IL")}
              </span>
            )}
            {row.approvedAt && (
              <span>
                אושר {new Date(row.approvedAt).toLocaleDateString("he-IL")}
              </span>
            )}
            {row.shipmentId && (
              <span dir="ltr" title="מזהה משלוח">
                #{row.shipmentId.slice(0, 8)}
              </span>
            )}
            {!row.submissionId && <span>אין עדיין עיצוב</span>}
          </div>
        )}
      </div>

      {zoomed && row.pixelMap && (
        <SeatPreviewModal
          name={row.name}
          pixelMap={row.pixelMap}
          sizeLabel={plateSizeLabel(row.effectivePlates)}
          canReview={row.status === "submitted"}
          busy={busy}
          onApprove={async () => {
            if (await act("approve")) setZoomed(false);
          }}
          onReject={async () => {
            if (await act("reject")) setZoomed(false);
          }}
          onClose={() => setZoomed(false)}
        />
      )}
    </li>
  );
}

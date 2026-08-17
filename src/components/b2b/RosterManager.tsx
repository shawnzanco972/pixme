"use client";
/**
 * Owner-side roster management.
 *
 * The dashboard's job, in order: (1) get the links out, (2) see whose move it
 * is, (3) approve designs, (4) decide what ships now. Step 4 is deliberately
 * separate from step 3 — a company approves 20 designs in one sitting but may
 * release 19 for the holidays and one single set for the boss today.
 *
 * Everything is bulk-capable because the realistic roster is 25–100 people:
 * filter, select-all-in-view, approve/release the selection in ONE request, and
 * export the links so the office manager can mail-merge them.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SeatRow, type SeatReviewRow } from "@/components/b2b/SeatRow";
import { isReleasable, plateSizeLabel } from "@/lib/b2b";
import { SEAT_FILTERS, type SeatFilter } from "@/lib/b2b-status";

export function RosterManager({
  token,
  rows,
  seatsLeft,
  emailConfigured,
  totalCredits,
  admin = false,
}: {
  token: string;
  rows: SeatReviewRow[];
  seatsLeft: number;
  emailConfigured: boolean;
  /** Total plate pool for the project (internal capacity, owner-facing only). */
  totalCredits: number;
  /** Operator view — reveals per-seat support diagnostics on every row. */
  admin?: boolean;
}) {
  const router = useRouter();
  const [names, setNames] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [credits, setCredits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<SeatFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shipNote, setShipNote] = useState("");

  // Pool accounting: each seat consumes its allocation; a seat can be raised up
  // to whatever's left for the others.
  const usedTotal = rows.reduce((s, r) => s + r.effectivePlates, 0);
  const poolLeft = totalCredits - usedTotal;
  const withMax = rows.map((r) => ({
    ...r,
    maxPlates: Math.max(1, totalCredits - (usedTotal - r.effectivePlates)),
  }));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withMax.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [withMax, filter, query]);

  const counts = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      all: rows.length,
      submitted: by("submitted"),
      ready: by("ready"),
      not_started: by("not_started"),
      released: by("released"),
    } as Record<SeatFilter, number>;
  }, [rows]);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedPending = selectedRows.filter((r) => r.status === "submitted");
  const selectedReady = selectedRows.filter((r) => isReleasable(r.status));
  const allVisibleSelected =
    visible.length > 0 && visible.every((r) => selected.has(r.id));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Select every seat in one state — the two real bulk jobs are "approve all
   *  the pending ones" and "ship all the approved ones". */
  function selectByStatus(status: string) {
    setSelected(
      new Set(rows.filter((r) => r.status === status).map((r) => r.id)),
    );
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
      return next;
    });
  }

  async function post(payload: Record<string, unknown>, okMsg: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/b2b/owner/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken: token, ...payload }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        released?: number;
        updated?: number;
      };
      if (!res.ok) {
        setError(j.error ?? "הפעולה נכשלה.");
        return;
      }
      setNotice(okMsg);
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  const approveSelected = () =>
    post(
      {
        action: "approve",
        submissionIds: selectedPending.map((r) => r.submissionId),
        scheduledFor: null,
      },
      `${selectedPending.length} עיצובים אושרו.`,
    );

  const releaseSelected = () =>
    post(
      {
        action: "ship",
        submissionIds: selectedReady.map((r) => r.submissionId),
        note: shipNote || null,
      },
      `${selectedReady.length} ערכות נשלחו לייצור. נעדכן אתכם כשהן יוצאות.`,
    );

  /**
   * Copy the seat links for the selection (or everyone).
   *
   * Just the URLs, one per line — "העתקת קישורים" has to produce something you
   * can paste into a message. The name/email columns belong in the CSV export,
   * where a spreadsheet is the point; mixing them into the clipboard made a
   * plain paste look like corrupted output.
   */
  async function copyLinks() {
    const src = selectedRows.length > 0 ? selectedRows : rows;
    const origin = window.location.origin;
    const text = src.map((r) => `${origin}/seat/${r.inviteToken}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice(
        src.length === 1
          ? "הקישור הועתק."
          : `הועתקו ${src.length} קישורים, אחד בכל שורה. לטבלה עם שמות — ייצוא CSV.`,
      );
    } catch {
      setError("הדפדפן חסם את ההעתקה.");
    }
  }

  /** Download the roster as CSV (BOM'd so Excel reads Hebrew correctly). */
  function exportCsv() {
    const origin = window.location.origin;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = rows
      .map((r) =>
        [r.name, r.email ?? "", `${origin}/seat/${r.inviteToken}`, r.status]
          .map(esc)
          .join(","),
      )
      .join("\n");
    const csv = `﻿${["שם", "אימייל", "קישור אישי", "סטטוס"].map(esc).join(",")}\n${body}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pixipic-roster.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function buyCredits() {
    const n = Math.floor(Number(credits) || 0);
    if (n <= 0) return;
    await post({ action: "buy_credits", plates: n }, "הקיבולת עודכנה.");
    setCredits("");
  }

  async function addEmployees() {
    setError(null);
    setNotice(null);
    // One person per line. Accepts "Name", "Name, email" and Excel's
    // tab-separated paste — office managers paste straight from a spreadsheet.
    const entries = names
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, email] = line.split(/[\t,;]/).map((s) => s.trim());
        return { name, email: email || null };
      })
      .filter((e) => e.name);

    if (entries.length === 0) return setError("נא להזין לפחות שם אחד.");
    if (entries.length > seatsLeft)
      return setError(`נותרו ${seatsLeft} מקומות בלבד בחבילה.`);

    setAdding(true);
    try {
      const res = await fetch("/api/b2b/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken: token, entries }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        added?: number;
        invited?: number;
      };
      if (!res.ok) throw new Error(j.error ?? "שגיאה בהוספת עובדים.");
      setNames("");
      setNotice(
        j.invited
          ? `נוספו ${j.added} עובדים · הזמנה נשלחה ל-${j.invited} מהם.`
          : `נוספו ${j.added} עובדים. שלחו להם את הקישור האישי.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="mt-6 flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-black">העובדים</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLinks()}
            disabled={rows.length === 0}
            className="btn btn-ghost min-h-10 gap-1.5 px-3 text-xs"
          >
            <span className="mi text-[16px]">content_copy</span>
            העתקת {selectedRows.length > 0 ? "הקישורים שנבחרו" : "כל הקישורים"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="btn btn-ghost min-h-10 gap-1.5 px-3 text-xs"
          >
            <span className="mi text-[16px]">download</span>
            ייצוא CSV
          </button>
          <span className="text-sm text-foreground/55">
            {seatsLeft} מקומות פנויים
          </span>
        </div>
      </div>

      {/* Filters + search */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SEAT_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full border-2 px-3.5 py-1.5 font-heading text-xs font-bold transition-colors ${
                  filter === f.id
                    ? "border-secondary bg-secondary text-on-secondary"
                    : "border-outline bg-surface hover:bg-surface-muted"
                }`}
              >
                {f.label} ({counts[f.id] ?? 0})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input h-10 min-h-10 max-w-xs flex-1"
              placeholder="חיפוש לפי שם או אימייל…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {visible.length > 0 && (
              <button
                type="button"
                onClick={toggleAllVisible}
                className={`btn min-h-10 gap-1.5 px-3 text-xs ${
                  allVisibleSelected ? "btn-secondary" : "btn-ghost"
                }`}
              >
                <span className="mi text-[17px]">
                  {allVisibleSelected ? "check_box" : "select_all"}
                </span>
                {allVisibleSelected
                  ? "ביטול הבחירה"
                  : filter === "all"
                    ? `בחירת כל ${visible.length} העובדים`
                    : `בחירת ${visible.length} המסוננים`}
              </button>
            )}
            {/* One-tap shortcuts for the two bulk jobs that actually happen. */}
            {filter === "all" && counts.submitted > 0 && (
              <button
                type="button"
                onClick={() => selectByStatus("submitted")}
                className="btn btn-ghost min-h-10 px-3 text-xs"
              >
                בחירת {counts.submitted} הממתינים לאישור
              </button>
            )}
            {filter === "all" && counts.ready > 0 && (
              <button
                type="button"
                onClick={() => selectByStatus("ready")}
                className="btn btn-ghost min-h-10 px-3 text-xs"
              >
                בחירת {counts.ready} המוכנים לשליחה
              </button>
            )}
          </div>
        </div>
      )}

      {notice && (
        <p className="rounded-xl bg-success/10 p-3 text-sm text-success">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-primary/10 p-3 text-sm text-primary">
          {error}
        </p>
      )}

      {/* Bulk action bar — only when something's selected */}
      {selectedRows.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-secondary bg-surface p-4 shadow-lg">
          <span className="font-heading text-sm font-bold">
            נבחרו {selectedRows.length}
          </span>
          {selectedPending.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void approveSelected()}
              className="btn btn-ghost min-h-10 px-3 text-xs"
            >
              אישור {selectedPending.length} עיצובים
            </button>
          )}
          {selectedReady.length > 0 && (
            <>
              <input
                className="input h-10 min-h-10 max-w-[14rem] flex-1 text-sm"
                placeholder="הערה למשלוח (לא חובה)"
                value={shipNote}
                onChange={(e) => setShipNote(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void releaseSelected()}
                className="btn btn-primary min-h-10 gap-1.5 px-3 text-xs"
              >
                <span className="mi text-[16px]">local_shipping</span>
                שליחה לייצור ({selectedReady.length})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="btn btn-ghost min-h-10 px-3 text-xs"
          >
            ניקוי בחירה
          </button>
        </div>
      )}

      {/* Capacity — expressed as sizes, never as "plates" */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline bg-surface-muted/50 p-3 text-sm">
        <span className="text-foreground/70">
          קיבולת הפרויקט: <b>{usedTotal}</b> מתוך {totalCredits} מוקצית
          {poolLeft > 0 && (
            <span className="text-success">
              {" "}
              · נותר מקום לעוד פסיפס בגודל {plateSizeLabel(poolLeft)}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="+ קיבולת"
            aria-label="הוספת קיבולת"
            className="w-24 rounded-lg border border-outline bg-surface px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void buyCredits()}
            disabled={busy || !credits}
            className="btn btn-ghost min-h-9 px-3 text-xs"
          >
            הגדלת הפרויקט
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <span className="mi text-[34px] text-foreground/30">group_add</span>
          <p className="font-heading font-bold">עוד לא הוספתם עובדים</p>
          <p className="max-w-md text-sm text-foreground/60">
            הדביקו את רשימת השמות למטה (אפשר ישר מאקסל). כל עובד יקבל קישור אישי
            משלו — אתם שולחים אותו במייל, בוואטסאפ או בסלאק.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="card p-6 text-center text-sm text-foreground/55">
          אין עובדים שמתאימים לסינון הזה.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((r) => (
            <SeatRow
              key={r.id}
              token={token}
              row={r}
              emailConfigured={emailConfigured}
              selected={selected.has(r.id)}
              onSelect={toggle}
              onError={setError}
              admin={admin}
            />
          ))}
        </ul>
      )}

      {seatsLeft > 0 && (
        <div className="card flex flex-col gap-3 p-5">
          <label className="font-heading font-bold" htmlFor="roster-add">
            הוספת עובדים
          </label>
          <p className="-mt-2 text-xs text-foreground/55">
            שורה לכל עובד. אפשר להדביק ישר מאקסל, או לכתוב “שם, אימייל” כדי
            שנשלח לו את ההזמנה אוטומטית.
          </p>
          <textarea
            id="roster-add"
            className="input min-h-24 py-3"
            placeholder={"דנה כהן\nיוסי לוי, yossi@company.co.il"}
            value={names}
            onChange={(e) => setNames(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground/55">
              נותרו {seatsLeft} מקומות
            </span>
            <button
              type="button"
              onClick={() => void addEmployees()}
              disabled={adding}
              className="btn btn-primary"
            >
              {adding ? "מוסיף…" : "הוספה"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";
/**
 * Owner-side roster management: review each employee's submission (preview,
 * approve/schedule/reject via SeatRow) and add new employees (up to the
 * purchased seat count). Writes go through the owner_token-gated API; after a
 * change we refresh the server component to re-read statuses.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SeatRow, type SeatReviewRow } from "@/components/b2b/SeatRow";

export function RosterManager({
  token,
  rows,
  seatsLeft,
  emailConfigured,
}: {
  token: string;
  rows: SeatReviewRow[];
  seatsLeft: number;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [names, setNames] = useState("");
  const [adding, setAdding] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingReview = rows.filter((r) => r.status === "submitted");

  async function approveAll() {
    if (pendingReview.length === 0) return;
    setApprovingAll(true);
    try {
      for (const r of pendingReview) {
        if (!r.submissionId) continue;
        await fetch("/api/b2b/owner/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerToken: token,
            submissionId: r.submissionId,
            action: "approve",
            scheduledFor: null,
          }),
        });
      }
      router.refresh();
    } finally {
      setApprovingAll(false);
    }
  }

  async function addEmployees() {
    setError(null);
    // One name per line; optional "Name, email".
    const entries = names
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, email] = line.split(",").map((s) => s.trim());
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
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "שגיאה בהוספת עובדים.");
      }
      setNames("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="mt-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold">העובדים</h2>
        <div className="flex items-center gap-3">
          {pendingReview.length > 0 && (
            <button
              type="button"
              onClick={() => void approveAll()}
              disabled={approvingAll}
              className="btn btn-primary text-xs"
            >
              {approvingAll
                ? "מאשר…"
                : `אישור הכל (${pendingReview.length})`}
            </button>
          )}
          <span className="text-sm text-zinc-500">
            {seatsLeft} מקומות פנויים
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-zinc-500">
          עדיין לא הוספתם עובדים. הוסיפו שמות למטה — כל עובד יקבל קישור אישי
          לעיצוב הפסיפס שלו.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <SeatRow
              key={r.id}
              token={token}
              row={r}
              emailConfigured={emailConfigured}
            />
          ))}
        </ul>
      )}

      {seatsLeft > 0 && (
        <div className="card flex flex-col gap-3 p-4">
          <label className="text-sm font-medium">
            הוספת עובדים (שם אחד בכל שורה, אפשר גם “שם, אימייל”)
          </label>
          <textarea
            className="input min-h-24"
            placeholder={"דנה כהן\nיוסי לוי, yossi@company.co.il"}
            value={names}
            onChange={(e) => setNames(e.target.value)}
          />
          <div className="flex items-center justify-between">
            {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
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

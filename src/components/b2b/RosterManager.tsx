"use client";
/**
 * Owner-side roster management: list employees with their status + personalized
 * seat link, and add new employees (up to the purchased seat count). Writes go
 * through /api/b2b/roster (service-role, owner_token-gated); after a change we
 * refresh the server component to re-read statuses.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { RosterRow } from "@/app/b2b/project/[token]/page";
import type { SeatStatus } from "@/lib/b2b";

const STATUS_LABEL: Record<SeatStatus, string> = {
  not_started: "טרם התחיל",
  submitted: "נשלח",
  ready: "מוכן",
  rejected: "נדחה",
};

const STATUS_CLASS: Record<SeatStatus, string> = {
  not_started: "bg-surface-muted text-zinc-600",
  submitted: "bg-secondary/10 text-secondary",
  ready: "bg-success/15 text-success",
  rejected: "bg-red-100 text-red-700",
};

export function RosterManager({
  token,
  rows,
  seatsLeft,
  emailConfigured,
}: {
  token: string;
  rows: RosterRow[];
  seatsLeft: number;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [names, setNames] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);

  async function sendInvite(rosterId: string) {
    try {
      const res = await fetch("/api/b2b/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken: token, rosterId }),
      });
      if (res.ok) {
        setInvited(rosterId);
        setTimeout(() => setInvited(null), 1500);
      }
    } catch {
      /* best-effort */
    }
  }

  const seatUrl = (inviteToken: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/seat/${inviteToken}`;

  async function copy(inviteToken: string) {
    try {
      await navigator.clipboard.writeText(seatUrl(inviteToken));
      setCopied(inviteToken);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — ignore */
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
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold">העובדים</h2>
        <span className="text-sm text-zinc-500">{seatsLeft} מקומות פנויים</span>
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-zinc-500">
          עדיין לא הוספתם עובדים. הוסיפו שמות למטה — כל עובד יקבל קישור אישי
          להעלאת תמונה.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="card flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                {r.email && (
                  <p className="truncate text-xs text-zinc-500" dir="ltr">
                    {r.email}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
                {r.status === "not_started" && (
                  <a
                    href={`/seat/${r.inviteToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost text-xs"
                    title="העלו תמונה במקום העובד (גם להפתעה)"
                  >
                    העלו עבורו
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void copy(r.inviteToken)}
                  className="btn btn-ghost text-xs"
                >
                  {copied === r.inviteToken ? "הועתק!" : "העתקת קישור"}
                </button>
                {emailConfigured && r.email && (
                  <button
                    type="button"
                    onClick={() => void sendInvite(r.id)}
                    className="btn btn-ghost text-xs"
                  >
                    {invited === r.id ? "נשלח!" : "שליחת הזמנה"}
                  </button>
                )}
              </div>
            </li>
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
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <span />
            )}
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

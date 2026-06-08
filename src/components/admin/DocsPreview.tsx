"use client";
/**
 * Docs tab helper: given an order id + track, POSTs to the existing PDF routes
 * and opens the generated instruction manual / packing list in a new tab so the
 * operator can preview output without leaving the dashboard.
 */
import { useState } from "react";

export function DocsPreview() {
  const [orderId, setOrderId] = useState("");
  const [track, setTrack] = useState<"b2c" | "b2b">("b2c");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(endpoint: string, label: string) {
    if (!orderId.trim()) {
      setError("נא להזין מזהה הזמנה.");
      return;
    }
    setError(null);
    setBusy(label);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), track }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "שגיאה בהפקת המסמך.");
      }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          מזהה הזמנה
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            dir="ltr"
            placeholder="order id…"
            className="w-72 rounded border border-outline bg-surface px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          מסלול
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value as "b2c" | "b2b")}
            className="rounded border border-outline bg-surface px-2 py-1 text-sm"
          >
            <option value="b2c">B2C / הגשת עובד</option>
            <option value="b2b">B2B</option>
          </select>
        </label>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void open("/api/generate-instructions", "instructions")}
          className="btn btn-primary h-9 min-h-9 px-4 text-sm"
        >
          {busy === "instructions" ? "מפיק…" : "חוברת הוראות"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void open("/api/packing-list", "packing")}
          className="btn btn-ghost h-9 min-h-9 px-4 text-sm"
        >
          {busy === "packing" ? "מפיק…" : "רשימת אריזה"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">
        להגשת עובד — השתמשו במזהה ההגשה ובמסלול B2C.
      </p>
    </div>
  );
}

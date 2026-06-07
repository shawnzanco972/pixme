"use client";
/**
 * Client button that POSTs the order id to /api/generate-instructions and
 * triggers a PDF download. The order id (a secret UUID) acts as the access
 * token, matching the guest, no-login model.
 */
import { useState } from "react";

export function DownloadInstructions({
  orderId,
  track = "b2c",
  label = "הורדת הוראות הרכבה (PDF)",
}: {
  orderId: string;
  track?: "b2c" | "b2b";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, track }),
      });
      if (!res.ok) throw new Error("שגיאה ביצירת ה‑PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pixme-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        className="rounded-full bg-black px-6 py-3 text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {loading ? "מכין…" : label}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

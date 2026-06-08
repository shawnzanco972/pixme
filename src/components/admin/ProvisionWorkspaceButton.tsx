"use client";
/**
 * Admin: manually provision a B2B workspace for an order — mirrors the iCount
 * webhook (mark paid + create workspace + email the owner). Lets you test the
 * whole B2B flow before payments are live. `maxSlots` is unused now (the server
 * derives it from the order) but kept for the call-site API.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProvisionWorkspaceButton({
  orderId,
}: {
  orderId: string;
  maxSlots?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function provision() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "שגיאה ביצירת סביבת העבודה.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={provision}
        disabled={busy}
        className="rounded-full bg-black px-5 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {busy ? "יוצר…" : "צור סביבת עבודה"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

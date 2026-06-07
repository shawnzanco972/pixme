"use client";
/**
 * Admin: manually provision a B2B workspace for an order (what the iCount
 * webhook does on payment). Lets you test the B2B flow before payments are live.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function ProvisionWorkspaceButton({
  orderId,
  maxSlots,
}: {
  orderId: string;
  maxSlots: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function provision() {
    setBusy(true);
    setError(null);
    const sb = createClient();
    const { error: insErr } = await sb.from("b2b_workspaces").insert({
      b2b_order_id: orderId,
      max_slots: maxSlots,
      active: true,
      expiration_date: new Date(Date.now() + TTL_MS).toISOString(),
    });
    // Mark the order paid too, so it reflects an active B2B account.
    await sb.from("b2b_orders").update({ status: "paid" }).eq("id", orderId);
    setBusy(false);
    if (insErr) setError(insErr.message);
    else router.refresh();
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

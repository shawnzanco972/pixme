"use client";
/**
 * Admin action: mark a B2C order as fulfilled (shipped). Uses the cookie-bound
 * client; the "Admins update orders" RLS policy authorizes it.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/supabase/types.helpers";

export function FulfillButton({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (status === "fulfilled") {
    return <span className="text-sm text-green-600">✓ נשלח</span>;
  }

  async function markFulfilled() {
    setBusy(true);
    const sb = createClient();
    const { error } = await sb
      .from("b2c_orders")
      .update({ status: "fulfilled" })
      .eq("id", orderId);
    setBusy(false);
    if (!error) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={markFulfilled}
      disabled={busy}
      className="rounded-full bg-black px-5 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
    >
      {busy ? "מעדכן…" : "סמן כנשלח"}
    </button>
  );
}

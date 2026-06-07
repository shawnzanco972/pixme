"use client";
/**
 * Admin: change a B2C order's status (manage the full lifecycle / testing).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/supabase/types.helpers";

const OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "ממתין לתשלום" },
  { value: "paid", label: "שולם" },
  { value: "fulfilled", label: "נשלח" },
  { value: "cancelled", label: "בוטל" },
  { value: "refunded", label: "הוחזר" },
];

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<OrderStatus>(status);
  const [busy, setBusy] = useState(false);

  async function change(next: OrderStatus) {
    setValue(next);
    setBusy(true);
    const sb = createClient();
    const { error } = await sb
      .from("b2c_orders")
      .update({ status: next })
      .eq("id", orderId);
    setBusy(false);
    if (error) setValue(status);
    else router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">סטטוס:</span>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => void change(e.target.value as OrderStatus)}
        className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

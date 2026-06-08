/**
 * Clients tab — /admin/clients. The CRM view: one row per client (clients
 * table, upserted on payment) enriched with derived aggregates — order count
 * and lifetime value computed from the order tables by email. Notes are
 * editable inline.
 */
import { redirect } from "next/navigation";

import { ClientNotes } from "@/components/admin/ClientNotes";
import { day } from "@/lib/admin-format";
import { formatILS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Agg {
  orders: number;
  spent: number;
}

export default async function AdminClients() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: clients }, { data: b2c }, { data: b2b }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, email, name, company, notes, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("b2c_orders").select("contact_email, total_price, status"),
    supabase.from("b2b_orders").select("contact_email, amount_paid, status"),
  ]);

  const paid = (s: string) => s === "paid" || s === "fulfilled";
  const agg = new Map<string, Agg>();
  const add = (email: string | null, spent: number, isPaid: boolean) => {
    if (!email) return;
    const key = email.toLowerCase();
    const cur = agg.get(key) ?? { orders: 0, spent: 0 };
    cur.orders += 1;
    if (isPaid) cur.spent += spent;
    agg.set(key, cur);
  };
  for (const o of b2c ?? []) add(o.contact_email, Number(o.total_price), paid(o.status));
  for (const o of b2b ?? []) add(o.contact_email, Number(o.amount_paid), paid(o.status));

  const rows = clients ?? [];

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-bold">לקוחות ({rows.length})</h1>

      <div className="overflow-x-auto rounded-xl border border-outline">
        <table className="w-full text-start text-sm">
          <thead className="bg-surface-muted text-zinc-600">
            <tr>
              <th className="p-3 text-start">לקוח</th>
              <th className="p-3 text-start">אימייל</th>
              <th className="p-3 text-start">הזמנות</th>
              <th className="p-3 text-start">ערך כולל</th>
              <th className="p-3 text-start">מאז</th>
              <th className="p-3 text-start" style={{ minWidth: 200 }}>הערות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const a = agg.get(c.email.toLowerCase()) ?? { orders: 0, spent: 0 };
              return (
                <tr key={c.id} className="border-t border-outline align-top">
                  <td className="p-3 font-medium">
                    {c.name || c.company || "—"}
                    {c.company && c.name ? (
                      <span className="text-zinc-500"> · {c.company}</span>
                    ) : null}
                  </td>
                  <td className="p-3 text-zinc-600" dir="ltr">{c.email}</td>
                  <td className="p-3">{a.orders}</td>
                  <td className="p-3 font-medium">{formatILS(Math.round(a.spent))}</td>
                  <td className="p-3 text-zinc-500">{day(c.created_at)}</td>
                  <td className="p-3">
                    <ClientNotes email={c.email} initial={c.notes} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-400">
                  אין לקוחות עדיין. לקוח נוצר אוטומטית עם ההזמנה הראשונה ששולמה.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

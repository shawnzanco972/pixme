/**
 * Finance tab — /admin/finance. The money ledger, backed by the transactions
 * table (written once per order on payment) plus derived monthly revenue and
 * outstanding (pending) order totals.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { day } from "@/lib/admin-format";
import { formatILS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export default async function AdminFinance() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: txns }, { data: pendingB2c }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, order_track, order_id, icount_invoice_id, gross, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("b2c_orders").select("total_price").eq("status", "pending"),
  ]);

  const rows = txns ?? [];
  const totalRevenue = rows.reduce((s, t) => s + Number(t.gross), 0);
  const thisMonth = monthKey(new Date().toISOString());
  const revenueThisMonth = rows
    .filter((t) => monthKey(t.created_at) === thisMonth)
    .reduce((s, t) => s + Number(t.gross), 0);

  // Outstanding = value sitting in pending orders (not yet paid).
  const outstanding =
    (pendingB2c ?? []).reduce((s, o) => s + Number(o.total_price), 0);

  // Revenue grouped by month (latest first).
  const byMonth = new Map<string, number>();
  for (const t of rows) {
    const m = monthKey(t.created_at);
    byMonth.set(m, (byMonth.get(m) ?? 0) + Number(t.gross));
  }
  const months = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const kpis: Array<[string, string]> = [
    ["הכנסות (סה״כ)", formatILS(Math.round(totalRevenue))],
    ["הכנסות החודש", formatILS(Math.round(revenueThisMonth))],
    ["עסקאות", String(rows.length)],
    ["ממתין לתשלום (B2C)", formatILS(Math.round(outstanding))],
  ];

  return (
    <main className="flex w-full flex-1 flex-col gap-8 p-6">
      <h1 className="font-heading text-2xl font-bold">כספים</h1>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-outline p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      {/* Revenue by month */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">הכנסות לפי חודש</h2>
        {months.length === 0 ? (
          <p className="text-sm text-zinc-400">אין עדיין עסקאות.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-zinc-600">
                <tr>
                  <th className="p-3 text-start">חודש</th>
                  <th className="p-3 text-start">הכנסה</th>
                </tr>
              </thead>
              <tbody>
                {months.map(([m, total]) => (
                  <tr key={m} className="border-t border-outline">
                    <td className="p-3" dir="ltr">{m}</td>
                    <td className="p-3 font-medium">
                      {formatILS(Math.round(total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ledger */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          ספר עסקאות ({rows.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-outline">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-zinc-600">
              <tr>
                <th className="p-3 text-start">תאריך</th>
                <th className="p-3 text-start">מסלול</th>
                <th className="p-3 text-start">סכום</th>
                <th className="p-3 text-start">חשבונית</th>
                <th className="p-3 text-start">הזמנה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-outline">
                  <td className="p-3">{day(t.created_at)}</td>
                  <td className="p-3 uppercase text-zinc-500">{t.order_track}</td>
                  <td className="p-3 font-medium">{formatILS(Number(t.gross))}</td>
                  <td className="p-3 text-zinc-500" dir="ltr">
                    {t.icount_invoice_id ?? "—"}
                  </td>
                  <td className="p-3">
                    <Link
                      href={
                        t.order_track === "b2b"
                          ? `/admin/b2b/${t.order_id}`
                          : `/admin/orders/${t.order_id}`
                      }
                      className="underline"
                    >
                      פתח
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-400">
                    אין עסקאות עדיין. עסקאות נרשמות אוטומטית עם אישור תשלום.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          עסקאות נכתבות פעם אחת לכל הזמנה עם אישור התשלום (וובהוק iCount או ארגז
          החול). החשבוניות עצמן מופקות ב־iCount.
        </p>
      </section>
    </main>
  );
}

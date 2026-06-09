/**
 * Orders tab — /admin/orders. B2C orders, B2B orders, and employee submissions.
 * Rows link to the existing detail pages (/admin/orders/[id], /admin/b2b/[id]).
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { DownloadInstructions } from "@/components/b2c/DownloadInstructions";
import { STATUS_HE, day } from "@/lib/admin-format";
import { formatILS } from "@/lib/pricing";
import { getAdminContext } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

function TestBadge() {
  return (
    <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      בדיקה
    </span>
  );
}

export default async function AdminOrders() {
  const { supabase, user } = await getAdminContext();
  if (!user) redirect("/admin/login");

  const [{ data: b2c }, { data: b2b }, { data: subs }] = await Promise.all([
    supabase
      .from("b2c_orders")
      .select(
        "id, customer_name, status, fulfillment_type, total_price, created_at, is_test",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("b2b_orders")
      .select(
        "id, company_name, status, licenses_purchased, amount_paid, created_at, is_test",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("employee_submissions")
      .select("id, employee_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col gap-8 p-6">
      <h1 className="font-heading text-2xl font-bold">הזמנות</h1>

      {/* B2C orders */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          הזמנות פרטיות ({b2c?.length ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-outline">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-zinc-600">
              <tr>
                <th className="p-3 text-start">תאריך</th>
                <th className="p-3 text-start">לקוח</th>
                <th className="p-3 text-start">סטטוס</th>
                <th className="p-3 text-start">אספקה</th>
                <th className="p-3 text-start">סכום</th>
              </tr>
            </thead>
            <tbody>
              {(b2c ?? []).map((o) => (
                <tr key={o.id} className="border-t border-outline">
                  <td className="p-3">{day(o.created_at)}</td>
                  <td className="p-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-medium underline"
                    >
                      {o.customer_name}
                    </Link>
                    {o.is_test && <TestBadge />}
                  </td>
                  <td className="p-3">
                    {STATUS_HE[o.status as OrderStatus] ?? o.status}
                  </td>
                  <td className="p-3">
                    {o.fulfillment_type === "physical" ? "פיזי" : "דיגיטלי"}
                  </td>
                  <td className="p-3">{formatILS(Number(o.total_price))}</td>
                </tr>
              ))}
              {(b2c ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-400">
                    אין הזמנות עדיין
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* B2B orders */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          הזמנות עסקיות ({b2b?.length ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-outline">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-zinc-600">
              <tr>
                <th className="p-3 text-start">תאריך</th>
                <th className="p-3 text-start">חברה</th>
                <th className="p-3 text-start">סטטוס</th>
                <th className="p-3 text-start">רישיונות</th>
                <th className="p-3 text-start">שולם</th>
              </tr>
            </thead>
            <tbody>
              {(b2b ?? []).map((o) => (
                <tr key={o.id} className="border-t border-outline">
                  <td className="p-3">{day(o.created_at)}</td>
                  <td className="p-3">
                    <Link
                      href={`/admin/b2b/${o.id}`}
                      className="font-medium underline"
                    >
                      {o.company_name}
                    </Link>
                    {o.is_test && <TestBadge />}
                  </td>
                  <td className="p-3">
                    {STATUS_HE[o.status as OrderStatus] ?? o.status}
                  </td>
                  <td className="p-3">{o.licenses_purchased}</td>
                  <td className="p-3">{formatILS(Number(o.amount_paid))}</td>
                </tr>
              ))}
              {(b2b ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-400">
                    אין הזמנות עדיין
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Employee submissions */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          הגשות עובדים ({subs?.length ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-outline">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-zinc-600">
              <tr>
                <th className="p-3 text-start">תאריך</th>
                <th className="p-3 text-start">עובד</th>
                <th className="p-3 text-start">סטטוס</th>
                <th className="p-3 text-start">הוראות</th>
              </tr>
            </thead>
            <tbody>
              {(subs ?? []).map((s) => (
                <tr key={s.id} className="border-t border-outline">
                  <td className="p-3">{day(s.created_at)}</td>
                  <td className="p-3">{s.employee_name}</td>
                  <td className="p-3">{s.status}</td>
                  <td className="p-3">
                    <DownloadInstructions
                      orderId={s.id}
                      track="b2b"
                      label="PDF"
                    />
                  </td>
                </tr>
              ))}
              {(subs ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-zinc-400">
                    אין הגשות עדיין
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/**
 * Admin dashboard — /admin (protected by middleware + Supabase Auth).
 *
 * Uses the cookie-bound server client, so all reads happen AS the signed-in
 * admin and are authorized by the "authenticated" RLS policies.
 */
import { redirect } from "next/navigation";

import { DownloadInstructions } from "@/components/b2c/DownloadInstructions";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { StockManager } from "@/components/admin/StockManager";
import { formatWeight } from "@/lib/packing";
import { formatILS } from "@/lib/pricing";
import { aggregateRestock } from "@/lib/restock";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, PixelMap } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

const STATUS_HE: Record<OrderStatus, string> = {
  pending: "ממתין",
  paid: "שולם",
  fulfilled: "נשלח",
  cancelled: "בוטל",
  refunded: "הוחזר",
};

function day(iso: string): string {
  return iso.slice(0, 10);
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: b2c }, { data: b2b }, { data: subs }, { data: restockRows }] =
    await Promise.all([
    supabase
      .from("b2c_orders")
      .select(
        "id, customer_name, status, fulfillment_type, total_price, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("b2b_orders")
      .select(
        "id, company_name, status, licenses_purchased, amount_paid, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("employee_submissions")
      .select("id, employee_name, status, workspace_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    // Restock: physical orders not yet fulfilled, with their pixel_map.
    supabase
      .from("b2c_orders")
      .select("pixel_map")
      .eq("fulfillment_type", "physical")
      .in("status", ["pending", "paid"]),
  ]);

  const restock = aggregateRestock(
    (restockRows ?? [])
      .map((r) => r.pixel_map as PixelMap | null)
      .filter((m): m is PixelMap => Array.isArray(m)),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold">לוח ניהול</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500" dir="ltr">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      </header>

      <StockManager />

      {/* Restock intelligence */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          רכש מלאי — הזמנות פיזיות ממתינות ({restock.orderCount})
        </h2>
        {restock.lines.length === 0 ? (
          <p className="text-sm text-zinc-400">אין הזמנות פיזיות לרכש כרגע.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-start text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-3 text-start">צבע</th>
                  <th className="p-3 text-start">חלקים</th>
                  <th className="p-3 text-start">להזמין (כולל רזרבה)</th>
                  <th className="p-3 text-start">משקל</th>
                </tr>
              </thead>
              <tbody>
                {restock.lines.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded border border-black/20"
                          style={{ backgroundColor: l.hex }}
                        />
                        {l.name}
                        {l.core ? (
                          <span className="text-xs text-zinc-400">★</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="p-3">{l.pieces.toLocaleString("he-IL")}</td>
                    <td className="p-3 font-medium">
                      {l.piecesWithSpare.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3">{formatWeight(l.grams)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                  <td className="p-3">סה״כ ({restock.lines.length} צבעים)</td>
                  <td className="p-3">
                    {restock.totalPieces.toLocaleString("he-IL")}
                  </td>
                  <td className="p-3" />
                  <td className="p-3">{formatWeight(restock.totalGrams)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          ★ = צבע בערכת הליבה המומלצת. כולל {Math.round(0.03 * 100)}% רזרבה.
        </p>
      </section>

      {/* B2C orders */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          הזמנות פרטיות ({b2c?.length ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-start text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="p-3 text-start">תאריך</th>
                <th className="p-3 text-start">לקוח</th>
                <th className="p-3 text-start">סטטוס</th>
                <th className="p-3 text-start">אספקה</th>
                <th className="p-3 text-start">סכום</th>
                <th className="p-3 text-start">הוראות</th>
              </tr>
            </thead>
            <tbody>
              {(b2c ?? []).map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="p-3">{day(o.created_at)}</td>
                  <td className="p-3">{o.customer_name}</td>
                  <td className="p-3">
                    {STATUS_HE[o.status as OrderStatus] ?? o.status}
                  </td>
                  <td className="p-3">
                    {o.fulfillment_type === "physical" ? "פיזי" : "דיגיטלי"}
                  </td>
                  <td className="p-3">{formatILS(Number(o.total_price))}</td>
                  <td className="p-3">
                    <DownloadInstructions orderId={o.id} label="PDF" />
                  </td>
                </tr>
              ))}
              {(b2c ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-zinc-400">
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
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-start text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
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
                <tr
                  key={o.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="p-3">{day(o.created_at)}</td>
                  <td className="p-3">{o.company_name}</td>
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
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-start text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="p-3 text-start">תאריך</th>
                <th className="p-3 text-start">עובד</th>
                <th className="p-3 text-start">סטטוס</th>
                <th className="p-3 text-start">הוראות</th>
              </tr>
            </thead>
            <tbody>
              {(subs ?? []).map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
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

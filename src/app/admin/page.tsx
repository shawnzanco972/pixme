/**
 * Admin dashboard — /admin (protected by middleware + Supabase Auth).
 *
 * Uses the cookie-bound server client, so all reads happen AS the signed-in
 * admin and are authorized by the "authenticated" RLS policies.
 */
import { redirect } from "next/navigation";

import { DownloadInstructions } from "@/components/b2c/DownloadInstructions";
import { ExportRestockCsv } from "@/components/admin/ExportRestockCsv";
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

  // On-hand inventory (grams) to compute the shortfall to reorder.
  const { data: stockRows } = await supabase
    .from("brick_stock")
    .select("id, on_hand_grams");
  const onHand = new Map<number, number>(
    (stockRows ?? []).map((r) => [r.id, Number(r.on_hand_grams)]),
  );
  const reorder = restock.lines.map((l) => {
    const onHandGrams = onHand.get(l.id) ?? 0;
    return {
      ...l,
      onHandGrams,
      toOrderGrams: Math.max(0, Math.round((l.grams - onHandGrams) * 10) / 10),
    };
  });
  const totalToOrder =
    Math.round(reorder.reduce((s, l) => s + l.toOrderGrams, 0) * 10) / 10;

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

      {/* Summary stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["הזמנות פרטיות", String(b2c?.length ?? 0)],
            [
              "לאריזה (פיזי)",
              String(
                (b2c ?? []).filter(
                  (o) =>
                    o.fulfillment_type === "physical" && o.status === "paid",
                ).length,
              ),
            ],
            [
              "הכנסות (ששולמו)",
              formatILS(
                (b2c ?? [])
                  .filter((o) => o.status !== "pending")
                  .reduce((s, o) => s + Number(o.total_price), 0),
              ),
            ],
            ["משקל לרכש", formatWeight(restock.totalGrams)],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <StockManager />

      {/* Restock intelligence */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">
            רכש מלאי — הזמנות פיזיות ממתינות ({restock.orderCount})
          </h2>
          <ExportRestockCsv rows={reorder} />
        </div>
        {reorder.length === 0 ? (
          <p className="text-sm text-zinc-400">אין הזמנות פיזיות לרכש כרגע.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-start text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-3 text-start">צבע</th>
                  <th className="p-3 text-start">נדרש (כולל רזרבה)</th>
                  <th className="p-3 text-start">במלאי</th>
                  <th className="p-3 text-start">להזמין</th>
                </tr>
              </thead>
              <tbody>
                {reorder.map((l) => (
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
                    <td className="p-3">{formatWeight(l.grams)}</td>
                    <td className="p-3 text-zinc-500">
                      {formatWeight(l.onHandGrams)}
                    </td>
                    <td
                      className={`p-3 font-medium ${
                        l.toOrderGrams > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {l.toOrderGrams > 0 ? formatWeight(l.toOrderGrams) : "✓"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                  <td className="p-3">סה״כ ({reorder.length} צבעים)</td>
                  <td className="p-3">{formatWeight(restock.totalGrams)}</td>
                  <td className="p-3" />
                  <td className="p-3">{formatWeight(totalToOrder)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          ★ = צבע ליבה. &quot;נדרש&quot; כולל {Math.round(0.03 * 100)}% רזרבה.
          &quot;להזמין&quot; = נדרש פחות מלאי קיים.
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
                  <td className="p-3">
                    <a
                      href={`/admin/orders/${o.id}`}
                      className="font-medium underline"
                    >
                      {o.customer_name}
                    </a>
                  </td>
                  <td className="p-3">
                    {STATUS_HE[o.status as OrderStatus] ?? o.status}
                  </td>
                  <td className="p-3">
                    {o.fulfillment_type === "physical" ? "פיזי" : "דיגיטלי"}
                  </td>
                  <td className="p-3">{formatILS(Number(o.total_price))}</td>
                  <td className="p-3">
                    <a
                      href={`/admin/orders/${o.id}`}
                      className="text-sm underline"
                    >
                      פתח
                    </a>
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
                <th className="p-3 text-start"></th>
              </tr>
            </thead>
            <tbody>
              {(b2b ?? []).map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="p-3">{day(o.created_at)}</td>
                  <td className="p-3">
                    <a
                      href={`/admin/b2b/${o.id}`}
                      className="font-medium underline"
                    >
                      {o.company_name}
                    </a>
                  </td>
                  <td className="p-3">
                    {STATUS_HE[o.status as OrderStatus] ?? o.status}
                  </td>
                  <td className="p-3">{o.licenses_purchased}</td>
                  <td className="p-3">{formatILS(Number(o.amount_paid))}</td>
                  <td className="p-3">
                    <a
                      href={`/admin/b2b/${o.id}`}
                      className="text-sm underline"
                    >
                      פתח
                    </a>
                  </td>
                </tr>
              ))}
              {(b2b ?? []).length === 0 && (
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

/**
 * Overview tab — /admin. The landing console: KPI cards, the low-stock alerts
 * panel (the priority), and the to-pack queue. Drill-downs live in the other
 * tabs. Protected by middleware + Supabase Auth.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { ALERT_CATEGORY_HE, day } from "@/lib/admin-format";
import { loadInventory } from "@/lib/inventory-data";
import { formatWeight } from "@/lib/packing";
import { formatILS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export default async function AdminOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: b2c }, { data: b2b }, inventory] = await Promise.all([
    supabase
      .from("b2c_orders")
      .select(
        "id, customer_name, status, fulfillment_type, total_price, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("b2b_orders")
      .select("id, company_name, status, amount_paid, created_at")
      .order("created_at", { ascending: false }),
    loadInventory(supabase),
  ]);

  const orders = b2c ?? [];
  const projects = b2b ?? [];
  const thisMonth = monthKey(new Date().toISOString());

  // KPIs ------------------------------------------------------------------
  const revenueThisMonth =
    orders
      .filter(
        (o) =>
          o.status !== "pending" &&
          o.status !== "cancelled" &&
          monthKey(o.created_at) === thisMonth,
      )
      .reduce((s, o) => s + Number(o.total_price), 0) +
    projects
      .filter((p) => monthKey(p.created_at) === thisMonth)
      .reduce((s, p) => s + Number(p.amount_paid), 0);

  const openOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "paid",
  ).length;

  const toPack = orders.filter(
    (o) => o.fulfillment_type === "physical" && o.status === "paid",
  );

  const projectsInProgress = projects.filter(
    (p) => p.status === "paid",
  ).length;

  const kpis: Array<[string, string]> = [
    ["הכנסות החודש", formatILS(Math.round(revenueThisMonth))],
    ["הזמנות פתוחות", String(openOrders)],
    ["לאריזה (פיזי, שולם)", String(toPack.length)],
    ["פרויקטים פעילים", String(projectsInProgress)],
    [
      "חוסר במלאי (התראות)",
      String(inventory.alerts.length),
    ],
  ];

  return (
    <main className="flex w-full flex-1 flex-col gap-8 p-6">
      <h1 className="font-heading text-2xl font-bold">סקירה</h1>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-outline p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      {/* Alerts panel (priority) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">
            🔔 התראות מלאי
          </h2>
          <Link href="/admin/inventory" className="text-sm underline">
            לניהול המלאי
          </Link>
        </div>
        {inventory.alerts.length === 0 ? (
          <p className="rounded-xl border border-outline bg-surface-muted p-4 text-sm text-zinc-500">
            אין התראות מלאי. כל הפריטים מעל סף ההזמנה מחדש. (הגדירו ספים בלשונית
            המלאי כדי לקבל התראות.)
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-zinc-600">
                <tr>
                  <th className="p-3 text-start">פריט</th>
                  <th className="p-3 text-start">סוג</th>
                  <th className="p-3 text-start">זמין</th>
                  <th className="p-3 text-start">סף</th>
                  <th className="p-3 text-start">חוסר</th>
                </tr>
              </thead>
              <tbody>
                {inventory.alerts.map((a) => (
                  <tr key={a.id} className="border-t border-outline">
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="p-3 text-zinc-500">
                      {ALERT_CATEGORY_HE[a.category] ?? a.category}
                    </td>
                    <td className="p-3">
                      {a.unit === "g"
                        ? formatWeight(a.available)
                        : `${a.available} ${a.unit}`}
                    </td>
                    <td className="p-3 text-zinc-500">
                      {a.unit === "g"
                        ? formatWeight(a.threshold)
                        : `${a.threshold} ${a.unit}`}
                    </td>
                    <td className="p-3 font-semibold text-red-600">
                      {a.unit === "g"
                        ? formatWeight(a.shortfall)
                        : `${a.shortfall} ${a.unit}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* To-pack queue */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          תור אריזה ({toPack.length})
        </h2>
        {toPack.length === 0 ? (
          <p className="text-sm text-zinc-400">אין הזמנות פיזיות לאריזה כרגע.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-zinc-600">
                <tr>
                  <th className="p-3 text-start">תאריך</th>
                  <th className="p-3 text-start">לקוח</th>
                  <th className="p-3 text-start">סכום</th>
                  <th className="p-3 text-start"></th>
                </tr>
              </thead>
              <tbody>
                {toPack.map((o) => (
                  <tr key={o.id} className="border-t border-outline">
                    <td className="p-3">{day(o.created_at)}</td>
                    <td className="p-3 font-medium">{o.customer_name}</td>
                    <td className="p-3">{formatILS(Number(o.total_price))}</td>
                    <td className="p-3">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="underline"
                      >
                        פתח
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          חוסר צבעים מחושב לפי דרישת הזמנות פיזיות ששולמו, פחות המלאי הקיים מול
          הסף שהוגדר.
        </p>
      </section>
    </main>
  );
}

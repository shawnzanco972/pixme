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
import { getAdminContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export default async function AdminOverview() {
  const { supabase, user } = await getAdminContext();
  if (!user) redirect("/admin/login");

  // Scoped, parallel queries — no full-table scans: each KPI fetches only the
  // rows (and columns) it needs, and counts are computed in the database.
  const monthStart = `${monthKey(new Date().toISOString())}-01`;
  const [
    { data: monthB2c },
    { data: monthB2b },
    { count: openOrders },
    { data: toPackRows },
    { count: projectsInProgress },
    { data: readySubs },
    inventory,
  ] = await Promise.all([
    supabase
      .from("b2c_orders")
      .select("total_price")
      .gte("created_at", monthStart)
      .not("status", "in", "(pending,cancelled)"),
    supabase
      .from("b2b_orders")
      .select("amount_paid")
      .gte("created_at", monthStart),
    supabase
      .from("b2c_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "paid"]),
    supabase
      .from("b2c_orders")
      .select("id, customer_name, total_price, created_at")
      .eq("fulfillment_type", "physical")
      .eq("status", "paid")
      .order("created_at", { ascending: false }),
    supabase
      .from("b2b_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid"),
    // B2B production queue: approved ("ready") employee kits we must build —
    // workspace → order joined in ONE round trip via FK embeds (was a
    // 3-query sequential waterfall).
    supabase
      .from("employee_submissions")
      .select(
        "id, employee_name, scheduled_for, b2b_workspaces(b2b_orders(company_name, project_name))",
      )
      .eq("status", "ready"),
    loadInventory(supabase),
  ]);

  const productionQueue = (readySubs ?? [])
    .map((s) => {
      const ord = s.b2b_workspaces?.b2b_orders;
      return {
        id: s.id,
        employee: s.employee_name,
        company: ord?.project_name || ord?.company_name || "—",
        scheduledFor: s.scheduled_for,
      };
    })
    // Soonest scheduled first; unscheduled (null) last.
    .sort((a, b) => {
      if (a.scheduledFor === b.scheduledFor) return 0;
      if (!a.scheduledFor) return 1;
      if (!b.scheduledFor) return -1;
      return a.scheduledFor < b.scheduledFor ? -1 : 1;
    });

  // KPIs ------------------------------------------------------------------
  const revenueThisMonth =
    (monthB2c ?? []).reduce((s, o) => s + Number(o.total_price), 0) +
    (monthB2b ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);

  const toPack = toPackRows ?? [];

  const kpis: Array<[string, string]> = [
    ["הכנסות החודש", formatILS(Math.round(revenueThisMonth))],
    ["הזמנות פתוחות", String(openOrders ?? 0)],
    ["לאריזה (פיזי, שולם)", String(toPack.length)],
    ["מתנות עסקיות לייצור", String(productionQueue.length)],
    ["פרויקטים פעילים", String(projectsInProgress ?? 0)],
    [
      "חוסר במלאי (התראות)",
      String(inventory.alerts.length),
    ],
  ];

  return (
    <main className="flex w-full flex-1 flex-col gap-8 p-6">
      <h1 className="font-heading text-2xl font-bold">סקירה</h1>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
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
          חוסר צבעים מחושב לפי דרישת הזמנות פיזיות ששולמו ומתנות עסקיות מאושרות,
          פחות המלאי הקיים מול הסף שהוגדר.
        </p>
      </section>

      {/* B2B production queue — approved employee kits to build, by date */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          תור ייצור עסקי ({productionQueue.length})
        </h2>
        {productionQueue.length === 0 ? (
          <p className="text-sm text-zinc-400">
            אין מתנות עסקיות מאושרות לייצור כרגע.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-zinc-600">
                <tr>
                  <th className="p-3 text-start">מתוזמן ל־</th>
                  <th className="p-3 text-start">חברה / פרויקט</th>
                  <th className="p-3 text-start">עובד</th>
                </tr>
              </thead>
              <tbody>
                {productionQueue.map((q) => (
                  <tr key={q.id} className="border-t border-outline">
                    <td className="p-3">
                      {q.scheduledFor ? (
                        day(q.scheduledFor)
                      ) : (
                        <span className="text-zinc-400">ללא תאריך</span>
                      )}
                    </td>
                    <td className="p-3 font-medium">{q.company}</td>
                    <td className="p-3">{q.employee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

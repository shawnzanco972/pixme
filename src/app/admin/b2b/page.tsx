/**
 * B2B console — /admin/b2b. Lists every project with status, seats, amount, and
 * quick links to the admin detail page and the owner's own dashboard (via the
 * stored owner_token, for assisting a customer). Detail/assist lives in the
 * existing /admin/b2b/[id] drill-down.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { STATUS_HE, day } from "@/lib/admin-format";
import { formatILS } from "@/lib/pricing";
import { getAdminContext } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

export default async function AdminB2bConsole() {
  const { supabase, user } = await getAdminContext();
  if (!user) redirect("/admin/login");

  const { data: projects } = await supabase
    .from("b2b_orders")
    .select(
      "id, company_name, project_name, status, licenses_purchased, amount_paid, owner_token, managed, created_at, is_test",
    )
    .order("created_at", { ascending: false });

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-bold">עסקים</h1>

      <div className="overflow-x-auto rounded-xl border border-outline">
        <table className="w-full text-start text-sm">
          <thead className="bg-surface-muted text-zinc-600">
            <tr>
              <th className="p-3 text-start">תאריך</th>
              <th className="p-3 text-start">חברה / פרויקט</th>
              <th className="p-3 text-start">סטטוס</th>
              <th className="p-3 text-start">מושבים</th>
              <th className="p-3 text-start">סכום</th>
              <th className="p-3 text-start">מנוהל</th>
              <th className="p-3 text-start">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id} className="border-t border-outline">
                <td className="p-3">{day(p.created_at)}</td>
                <td className="p-3">
                  <Link
                    href={`/admin/b2b/${p.id}`}
                    className="font-medium underline"
                  >
                    {p.company_name}
                  </Link>
                  {p.project_name ? (
                    <span className="text-zinc-500"> · {p.project_name}</span>
                  ) : null}
                  {p.is_test && (
                    <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      בדיקה
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {STATUS_HE[p.status as OrderStatus] ?? p.status}
                </td>
                <td className="p-3">{p.licenses_purchased}</td>
                <td className="p-3">{formatILS(Number(p.amount_paid))}</td>
                <td className="p-3">{p.managed ? "כן" : "לא"}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <Link
                      href={`/admin/b2b/${p.id}`}
                      className="underline"
                    >
                      ניהול
                    </Link>
                    <a
                      href={`/b2b/project/${p.owner_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary underline"
                    >
                      לוח הלקוח ↗
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {(projects ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-zinc-400">
                  אין פרויקטים עדיין
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

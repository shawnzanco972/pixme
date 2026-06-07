/**
 * Admin B2B order detail — /admin/b2b/[id].
 *
 * Shows the corporate order, its workspace(s) with the shareable employee link
 * (since email isn't wired yet, copy it here and send manually), slot usage, and
 * the employee submissions. Lets you manually provision a workspace for testing.
 */
import { notFound, redirect } from "next/navigation";

import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { DownloadInstructions } from "@/components/b2c/DownloadInstructions";
import { ProvisionWorkspaceButton } from "@/components/admin/ProvisionWorkspaceButton";
import { formatILS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

const STATUS_HE: Record<OrderStatus, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  fulfilled: "הושלם",
  cancelled: "בוטל",
  refunded: "הוחזר",
};

export default async function AdminB2bDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: order } = await supabase
    .from("b2b_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (!order) notFound();

  const { data: workspaces } = await supabase
    .from("b2b_workspaces")
    .select("*")
    .eq("b2b_order_id", id)
    .order("created_at", { ascending: true });

  const wsIds = (workspaces ?? []).map((w) => w.id);
  const { data: subs } = wsIds.length
    ? await supabase
        .from("employee_submissions")
        .select("id, employee_name, status, workspace_id, created_at")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <a href="/admin" className="text-sm text-zinc-500 underline">
        → חזרה ללוח הניהול
      </a>

      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold">{order.company_name}</h1>
        <p className="text-sm text-zinc-500" dir="ltr">
          {order.contact_email}
        </p>
        <p className="text-sm text-zinc-500">
          {STATUS_HE[order.status as OrderStatus]} · {order.licenses_purchased}{" "}
          רישיונות · {formatILS(Number(order.amount_paid))}
        </p>
      </header>

      {/* Workspaces */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">סביבות עבודה</h2>
          {(workspaces ?? []).length === 0 && (
            <ProvisionWorkspaceButton
              orderId={order.id}
              maxSlots={order.licenses_purchased}
            />
          )}
        </div>
        {(workspaces ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">
            אין סביבת עבודה עדיין. בדרך כלל נוצרת אוטומטית עם התשלום; ניתן ליצור
            ידנית לבדיקה.
          </p>
        ) : (
          (workspaces ?? []).map((w) => (
            <div
              key={w.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  ניצול: <b>{w.slots_used}</b> / {w.max_slots} ·{" "}
                  {w.active ? "פעילה" : "לא פעילה"}
                </span>
                <CopyLinkButton path={`/workspace/${w.id}`} />
              </div>
              <code className="break-all rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900" dir="ltr">
                /workspace/{w.id}
              </code>
            </div>
          ))
        )}
      </section>

      {/* Submissions */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">
          הגשות עובדים ({subs?.length ?? 0})
        </h2>
        {(subs ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">אין הגשות עדיין.</p>
        ) : (
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
                    <td className="p-3">{s.created_at.slice(0, 10)}</td>
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
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

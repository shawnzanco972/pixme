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
import { RosterManager } from "@/components/b2b/RosterManager";
import type { SeatReviewRow } from "@/components/b2b/SeatRow";
import {
  defaultAllocation,
  projectProgress,
  seatStatus,
  totalPlateCredits,
  type SeatStatus,
} from "@/lib/b2b";
import { isEmailConfigured } from "@/lib/email";
import { formatILS, presetStuds } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, PixelMap } from "@/lib/supabase/types.helpers";

const SEAT_HE: Record<SeatStatus, string> = {
  not_started: "טרם התחיל",
  submitted: "נשלח",
  ready: "מוכן",
  rejected: "נדחה",
};

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
        .select(
          "id, employee_name, status, workspace_id, roster_id, created_at, scheduled_for, pixel_map",
        )
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Pre-loaded roster + each seat's submission, for the assist panel.
  const { data: roster } = wsIds.length
    ? await supabase
        .from("employee_roster")
        .select("id, name, email, invite_token, workspace_id, plates_allocated")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const defaultAlloc = defaultAllocation(order);
  const totalCredits = totalPlateCredits(order);

  const subByRoster = new Map<string, NonNullable<typeof subs>[number]>();
  for (const s of subs ?? []) {
    if (s.roster_id) subByRoster.set(s.roster_id, s);
  }
  const seatRows: SeatReviewRow[] = (roster ?? []).map((r) => {
    const sub = subByRoster.get(r.id);
    const pm = sub?.pixel_map as PixelMap | null;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      inviteToken: r.invite_token,
      status: seatStatus(sub?.status),
      submissionId: sub?.id ?? null,
      pixelMap: Array.isArray(pm) ? pm : null,
      scheduledFor: sub?.scheduled_for ?? null,
      effectivePlates: r.plates_allocated ?? defaultAlloc,
      maxPlates: 0, // computed in RosterManager from the pool
    };
  });
  const progress = projectProgress(seatRows.map((s) => s.status));
  const seatsLeft = order.licenses_purchased - seatRows.length;

  const { cols, rows } = presetStuds({
    platesX: order.plates_x,
    platesY: order.plates_y,
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <a href="/admin" className="text-sm text-zinc-500 underline">
        → חזרה ללוח הניהול
      </a>

      <header className="flex flex-col gap-1">
        {order.project_name && (
          <p className="text-sm text-zinc-500">{order.project_name}</p>
        )}
        <h1 className="font-heading text-2xl font-bold">{order.company_name}</h1>
        <p className="text-sm text-zinc-500" dir="ltr">
          {order.contact_email}
        </p>
        <p className="text-sm text-zinc-500">
          {STATUS_HE[order.status as OrderStatus]} · {order.licenses_purchased}{" "}
          מקומות · {cols}×{rows} · {formatILS(Number(order.amount_paid))}
          {order.bundle_id ? ` · ${order.bundle_id}` : ""}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-zinc-500">לוח בקרה של הלקוח:</span>
          <CopyLinkButton path={`/b2b/project/${order.owner_token}`} />
        </div>
      </header>

      {/* Pending → not provisioned. Surface the one action that unblocks the
          whole flow (mark paid + create workspace + owner link). */}
      {order.status === "pending" && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div>
            <p className="font-medium text-amber-900">
              ההזמנה ממתינה לתשלום — הפרויקט עדיין לא הופעל
            </p>
            <p className="mt-1 text-sm text-amber-800">
              עד שיחובר iCount, סמנו כשולם והפעילו ידנית. הפעולה תיצור את סביבת
              העבודה ותפתח את לוח הבקרה של הלקוח (להוספת עובדים ושליחת קישורים).
            </p>
          </div>
          <ProvisionWorkspaceButton
            orderId={order.id}
            maxSlots={order.licenses_purchased}
          />
        </div>
      )}

      {/* Project team — full assist toolkit (add employees, approve, schedule,
          upload on a seat's behalf) via the owner token. */}
      {(workspaces ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">
              צוות הפרויקט ({seatRows.length}) — סיוע
            </h2>
            <span className="text-sm text-zinc-500">
              {progress.total - progress.notStarted}/{progress.total} שלחו ·{" "}
              {progress.ready} מוכנים
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${Math.round(progress.doneFraction * 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            פועלים בשם הלקוח — אותן פעולות כמו בלוח מנהל הפרויקט.
          </p>
          <RosterManager
            token={order.owner_token}
            rows={seatRows}
            seatsLeft={Math.max(0, seatsLeft)}
            emailConfigured={isEmailConfigured()}
            totalCredits={totalCredits}
          />
        </section>
      )}

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
              className="flex flex-col gap-2 rounded-xl border border-outline p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  ניצול: <b>{w.slots_used}</b> / {w.max_slots} ·{" "}
                  {w.active ? "פעילה" : "לא פעילה"}
                </span>
                <CopyLinkButton path={`/workspace/${w.id}`} />
              </div>
              <code className="break-all rounded bg-surface-muted p-2 text-xs" dir="ltr">
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
          <div className="overflow-x-auto rounded-xl border border-outline">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-zinc-600">
                <tr>
                  <th className="p-3 text-start">תאריך</th>
                  <th className="p-3 text-start">עובד</th>
                  <th className="p-3 text-start">סטטוס</th>
                  <th className="p-3 text-start">מתוזמן ל־</th>
                  <th className="p-3 text-start">הוראות</th>
                </tr>
              </thead>
              <tbody>
                {(subs ?? []).map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-outline"
                  >
                    <td className="p-3">{s.created_at.slice(0, 10)}</td>
                    <td className="p-3">{s.employee_name}</td>
                    <td className="p-3">{SEAT_HE[seatStatus(s.status)]}</td>
                    <td className="p-3 text-zinc-500">
                      {s.scheduled_for ? s.scheduled_for.slice(0, 10) : "—"}
                    </td>
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

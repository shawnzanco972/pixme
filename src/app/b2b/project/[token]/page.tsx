/**
 * Project owner dashboard — /b2b/project/[token].
 *
 * Access is the secret owner_token in the URL (no login). Rendered server-side
 * with the service-role key, so we can read the order, its workspace, the
 * roster and each employee's submission status without exposing any of it via
 * public RLS.
 *
 * The page answers three questions, in this order: what do I need to DO right
 * now, where does each person stand, and what has already gone to production.
 */
import { notFound } from "next/navigation";

import { RosterManager } from "@/components/b2b/RosterManager";
import type { SeatReviewRow } from "@/components/b2b/SeatRow";
import {
  CM_PER_PLATE,
  defaultAllocation,
  projectProgress,
  seatStatus,
  totalPlateCredits,
} from "@/lib/b2b";
import { isEmailConfigured } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";
import { toEnginePixelMap } from "@/lib/brick-engine/palette";
import type { StoredPixelMap } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

const SHIPMENT_LABEL: Record<string, string> = {
  requested: "התקבלה — ממתינה לייצור",
  in_production: "בייצור",
  shipped: "נשלחה",
  cancelled: "בוטלה",
};

export default async function ProjectDashboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("b2b_orders")
    .select(
      "id, company_name, project_name, status, plates_x, plates_y, licenses_purchased, extra_plate_credits",
    )
    .eq("owner_token", token)
    .maybeSingle();

  if (!order) notFound();

  const { data: ws } = await admin
    .from("b2b_workspaces")
    .select("id, max_slots, slots_used, active, expiration_date")
    .eq("b2b_order_id", order.id)
    .maybeSingle();

  const sizeLabel = `⁦${order.plates_x * CM_PER_PLATE}×${order.plates_y * CM_PER_PLATE}⁩ ס״מ`;

  // Not provisioned yet (payment pending) — no workspace exists.
  if (!ws) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-6 sm:p-8">
        <Header
          company={order.company_name}
          project={order.project_name}
          seats={order.licenses_purchased}
          sizeLabel={sizeLabel}
        />
        <div className="card mt-6 flex flex-col items-center gap-2 p-8 text-center">
          <span className="mi text-[34px] text-accent">hourglass_top</span>
          <p className="font-heading font-bold">התשלום בעיבוד</p>
          <p className="max-w-md text-sm text-foreground/60">
            לוח הבקרה ייפתח להוספת עובדים ברגע שהתשלום יאושר. שמרו את הקישור
            הזה — הוא לא ישתנה. רעננו בעוד כמה דקות.
          </p>
        </div>
      </main>
    );
  }

  // Roster + each seat's submission status.
  const { data: roster } = await admin
    .from("employee_roster")
    .select("id, name, email, invite_token, plates_allocated")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: true });

  const defaultAlloc = defaultAllocation(order);
  const totalCredits = totalPlateCredits(order);

  const { data: subs } = await admin
    .from("employee_submissions")
    .select(
      "id, roster_id, status, pixel_map, scheduled_for, shipment_id, is_draft",
    )
    .eq("workspace_id", ws.id);

  const subByRoster = new Map<string, NonNullable<typeof subs>[number]>();
  for (const s of subs ?? []) {
    if (s.roster_id) subByRoster.set(s.roster_id, s);
  }

  const rosterRows: SeatReviewRow[] = (roster ?? []).map((r) => {
    const sub = subByRoster.get(r.id);
    const pm = toEnginePixelMap(sub?.pixel_map as StoredPixelMap | null);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      inviteToken: r.invite_token,
      status: seatStatus(sub?.status, sub?.shipment_id, sub?.is_draft),
      submissionId: sub?.id ?? null,
      pixelMap: pm,
      scheduledFor: sub?.scheduled_for ?? null,
      effectivePlates: r.plates_allocated ?? defaultAlloc,
      maxPlates: 0, // computed in RosterManager from the pool
    };
  });

  // Shipments already released by this owner.
  const { data: shipments } = await admin
    .from("b2b_shipments")
    .select("id, status, note, created_at, shipped_at")
    .eq("b2b_order_id", order.id)
    .order("created_at", { ascending: false });

  const shipmentCounts = new Map<string, number>();
  for (const s of subs ?? []) {
    if (!s.shipment_id) continue;
    shipmentCounts.set(s.shipment_id, (shipmentCounts.get(s.shipment_id) ?? 0) + 1);
  }

  const progress = projectProgress(rosterRows.map((r) => r.status));
  const seatsLeft = order.licenses_purchased - rosterRows.length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6 sm:p-8">
      <Header
        company={order.company_name}
        project={order.project_name}
        seats={order.licenses_purchased}
        sizeLabel={sizeLabel}
      />

      {/* What needs doing right now */}
      {progress.total > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              n: progress.notStarted + progress.draft,
              label:
                progress.draft > 0
                  ? `טרם סיימו (${progress.draft} בעבודה)`
                  : "טרם העלו",
              icon: "schedule",
              color: "#6b7280",
            },
            {
              n: progress.submitted,
              label: "ממתין לאישורכם",
              icon: "rate_review",
              color: "#1d4ed8",
            },
            {
              n: progress.ready,
              label: "מוכן לשליחה",
              icon: "check_circle",
              color: "#9a7400",
            },
            {
              n: progress.released,
              label: "נשלח לייצור",
              icon: "local_shipping",
              color: "#2e7d32",
            },
          ].map((t) => (
            <div
              key={t.label}
              className="flex flex-col gap-1 rounded-2xl bg-surface p-4"
              style={{
                border: "1px solid var(--color-outline)",
                boxShadow: "0 4px 0 0 #eceff2",
              }}
            >
              <span className="mi text-[20px]" style={{ color: t.color }}>
                {t.icon}
              </span>
              <span className="font-heading text-2xl font-black">{t.n}</span>
              <span className="text-xs text-foreground/60">{t.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {progress.total > 0 && (
        <div className="card mt-4 flex flex-col gap-2.5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {/* Must match the tiles above: a draft is still the employee's
                move, so it does not count as handed in. */}
            <span className="font-heading font-bold">
              {progress.total - progress.notStarted - progress.draft} מתוך{" "}
              {progress.total} סיימו ושלחו
            </span>
            {progress.needsOwner > 0 && (
              <span className="text-secondary">
                {progress.needsOwner} מחכים לפעולה שלכם
              </span>
            )}
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${Math.round(progress.doneFraction * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-secondary/30 bg-secondary/5 p-4 text-sm">
        <p className="font-heading font-bold">🔒 זהו הקישור הפרטי לפרויקט</p>
        <p className="mt-1 leading-relaxed text-foreground/70">
          הוסיפו אותו לסימניות — אין כאן סיסמה, והוא הכניסה היחידה. כל מי שיש לו
          את הקישור יכול לנהל את הפרויקט, אז שתפו רק עם מי שאחראי מטעמכם.
        </p>
      </div>

      <RosterManager
        token={token}
        rows={rosterRows}
        seatsLeft={Math.max(0, seatsLeft)}
        emailConfigured={isEmailConfigured()}
        totalCredits={totalCredits}
      />

      {/* Shipments already released */}
      {(shipments ?? []).length > 0 && (
        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-heading text-xl font-black">משלוחים</h2>
          <p className="-mt-1 text-sm text-foreground/60">
            כל משלוח מגיע אליכם למשרד בקרטון אחד, ממוין לפי שמות.
          </p>
          <ul className="flex flex-col gap-2">
            {(shipments ?? []).map((s) => (
              <li
                key={s.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-heading font-bold">
                    {shipmentCounts.get(s.id) ?? 0} ערכות
                  </p>
                  <p className="text-xs text-foreground/55">
                    שוחרר ב-
                    {new Date(s.created_at).toLocaleDateString("he-IL")}
                    {s.note ? ` · ${s.note}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground/70">
                  {SHIPMENT_LABEL[s.status] ?? s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Header({
  company,
  project,
  seats,
  sizeLabel,
}: {
  company: string;
  project: string | null;
  seats: number;
  sizeLabel: string;
}) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-sm text-foreground/55">{company}</p>
      <h1 className="font-heading text-3xl font-black tracking-[-0.02em]">
        {project ?? "פרויקט הפסיפסים שלכם"}
      </h1>
      <p className="text-sm text-foreground/60">
        {seats} עובדים · פסיפס {sizeLabel} לכל אחד
      </p>
    </header>
  );
}

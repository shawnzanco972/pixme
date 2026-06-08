/**
 * Project owner dashboard — /b2b/project/[token].
 *
 * Access is the secret owner_token in the URL (no login). Rendered server-side
 * with the service-role key, so we can read the order, its workspace, the
 * roster and each employee's submission status without exposing any of it via
 * public RLS. The owner adds employees (→ personalized seat links) and watches
 * who has / hasn't submitted.
 */
import { notFound } from "next/navigation";

import { RosterManager } from "@/components/b2b/RosterManager";
import { projectProgress, seatStatus, type SeatStatus } from "@/lib/b2b";
import { bundleStuds } from "@/lib/b2b-bundles";
import { isEmailConfigured } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface RosterRow {
  id: string;
  name: string;
  email: string | null;
  inviteToken: string;
  status: SeatStatus;
}

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
      "id, company_name, project_name, status, plates_x, plates_y, licenses_purchased",
    )
    .eq("owner_token", token)
    .maybeSingle();

  if (!order) notFound();

  const { data: ws } = await admin
    .from("b2b_workspaces")
    .select("id, max_slots, slots_used, active, expiration_date")
    .eq("b2b_order_id", order.id)
    .maybeSingle();

  const { cols, rows } = bundleStuds({
    platesX: order.plates_x,
    platesY: order.plates_y,
  });

  // Not provisioned yet (payment pending) — no workspace exists.
  if (!ws) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 p-8">
        <Header
          company={order.company_name}
          project={order.project_name}
          seats={order.licenses_purchased}
          cols={cols}
          rows={rows}
        />
        <p className="card mt-6 p-6 text-center text-amber-800">
          התשלום בעיבוד. לוח הבקרה ייפתח להוספת עובדים ברגע שהתשלום יאושר.
          רעננו את העמוד בעוד מספר דקות.
        </p>
      </main>
    );
  }

  // Roster + each seat's submission status.
  const { data: roster } = await admin
    .from("employee_roster")
    .select("id, name, email, invite_token")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: true });

  const { data: subs } = await admin
    .from("employee_submissions")
    .select("roster_id, status")
    .eq("workspace_id", ws.id);

  const statusByRoster = new Map<string, string>();
  for (const s of subs ?? []) {
    if (s.roster_id) statusByRoster.set(s.roster_id, s.status);
  }

  const rosterRows: RosterRow[] = (roster ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    inviteToken: r.invite_token,
    status: seatStatus(statusByRoster.get(r.id)),
  }));

  const progress = projectProgress(rosterRows.map((r) => r.status));
  const seatsLeft = order.licenses_purchased - rosterRows.length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6 sm:p-8">
      <Header
        company={order.company_name}
        project={order.project_name}
        seats={order.licenses_purchased}
        cols={cols}
        rows={rows}
      />

      {/* Progress */}
      <div className="card mt-6 flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {progress.total - progress.notStarted} מתוך {progress.total} שלחו
          </span>
          <span className="text-zinc-500">
            {progress.ready} מוכנים · {progress.notStarted} ממתינים
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${Math.round(progress.doneFraction * 100)}%` }}
          />
        </div>
      </div>

      <RosterManager
        token={token}
        rows={rosterRows}
        seatsLeft={Math.max(0, seatsLeft)}
        emailConfigured={isEmailConfigured()}
      />
    </main>
  );
}

function Header({
  company,
  project,
  seats,
  cols,
  rows,
}: {
  company: string;
  project: string | null;
  seats: number;
  cols: number;
  rows: number;
}) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-sm text-zinc-500">{company}</p>
      <h1 className="font-heading text-3xl font-bold">
        {project ?? "פרויקט הפסיפסים שלכם"}
      </h1>
      <p className="text-sm text-zinc-600">
        {seats} עובדים · פסיפס {cols}×{rows} לבנים לכל עובד
      </p>
    </header>
  );
}

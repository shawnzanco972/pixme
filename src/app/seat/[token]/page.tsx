/**
 * Employee seat portal — /seat/[token].
 *
 * The token is a roster invite_token. We validate it server-side (service role),
 * find the company's purchased size, and render the FULL design studio scoped to
 * that plate budget — the employee gets the same experience as a retail customer
 * (reframe, recolor, adjust), just capped to the paid size and without payment.
 *
 * The seat stays editable until the project owner approves it (status "ready"),
 * at which point this locks to a done state.
 */
import { SeatStudio } from "@/components/b2b/SeatStudio";
import { workspaceStatus } from "@/lib/b2b";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SeatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: seat } = await admin
    .from("employee_roster")
    .select("id, name, workspace_id, submission_id")
    .eq("invite_token", token)
    .maybeSingle();

  let platesX = 2;
  let platesY = 2;
  let companyName = "";
  let live = false;
  let slotOpen = false;
  let status: string | null = null;

  if (seat) {
    const { data: ws } = await admin
      .from("b2b_workspaces")
      .select("id, active, expiration_date, max_slots, slots_used, b2b_order_id")
      .eq("id", seat.workspace_id)
      .maybeSingle();
    const wsStatus = workspaceStatus(ws);
    slotOpen = wsStatus.open;
    live = Boolean(ws?.active) && !wsStatus.expired;

    if (ws) {
      const { data: order } = await admin
        .from("b2b_orders")
        .select("company_name, project_name, plates_x, plates_y")
        .eq("id", ws.b2b_order_id)
        .maybeSingle();
      if (order) {
        companyName = order.project_name || order.company_name;
        platesX = order.plates_x;
        platesY = order.plates_y;
      }
    }

    if (seat.submission_id) {
      const { data: sub } = await admin
        .from("employee_submissions")
        .select("status")
        .eq("id", seat.submission_id)
        .maybeSingle();
      status = sub?.status ?? null;
    }
  }

  const hasSubmission = Boolean(seat?.submission_id);
  const approved = status === "ready";
  const rejected = status === "rejected";
  // New submitters need a free slot; an existing submission can always be edited
  // (it already holds a slot) until the owner approves it.
  const canEdit = live && !approved && (hasSubmission || slotOpen);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <header className="text-center">
        <h1 className="font-heading text-3xl font-bold">
          {seat ? `שלום ${seat.name}!` : "העלאת תמונה לפסיפס"}
        </h1>
        {companyName && (
          <p className="mt-2 text-sm text-zinc-500">{companyName}</p>
        )}
      </header>

      {!seat && (
        <p className="mx-auto max-w-md rounded-xl bg-red-50 p-4 text-center text-red-700">
          הקישור אינו תקין.
        </p>
      )}

      {seat && approved && (
        <div className="card mx-auto max-w-md p-8 text-center">
          <h2 className="font-heading text-2xl font-bold">העיצוב אושר! ✅</h2>
          <p className="mt-2 text-zinc-600">
            מנהל הפרויקט אישר את הפסיפס שלך. אי אפשר עוד לערוך.
          </p>
        </div>
      )}

      {seat && !approved && !canEdit && (
        <p className="mx-auto max-w-md rounded-xl bg-amber-50 p-4 text-center text-amber-800">
          הפרויקט אינו פעיל כרגע. פנו למנהל הפרויקט בחברה.
        </p>
      )}

      {seat && canEdit && (
        <SeatStudio
          inviteToken={token}
          plateBudget={platesX * platesY}
          initialPlatesX={platesX}
          initialPlatesY={platesY}
          alreadySubmitted={hasSubmission && !rejected}
          rejected={rejected}
        />
      )}
    </main>
  );
}

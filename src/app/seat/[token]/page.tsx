/**
 * Employee seat portal — /seat/[token].
 *
 * The token is a roster invite_token. We validate it server-side (service
 * role), look up the locked mosaic size from the project's bundle, and render a
 * single-photo upload. The employee can't choose a size — the company already
 * paid for it. Re-opening after submitting shows a done state.
 */
import { SeatSubmit } from "@/components/b2b/SeatSubmit";
import { workspaceStatus } from "@/lib/b2b";
import { presetStuds } from "@/lib/pricing";
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

  let cols = 48;
  let rows = 48;
  let open = false;
  let companyName = "";

  if (seat) {
    const { data: ws } = await admin
      .from("b2b_workspaces")
      .select("id, active, expiration_date, max_slots, slots_used, b2b_order_id")
      .eq("id", seat.workspace_id)
      .maybeSingle();
    open = workspaceStatus(ws).open;

    if (ws) {
      const { data: order } = await admin
        .from("b2b_orders")
        .select("company_name, project_name, plates_x, plates_y")
        .eq("id", ws.b2b_order_id)
        .maybeSingle();
      if (order) {
        companyName = order.project_name || order.company_name;
        ({ cols, rows } = presetStuds({
          platesX: order.plates_x,
          platesY: order.plates_y,
        }));
      }
    }
  }

  const alreadyDone = Boolean(seat?.submission_id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="text-center">
        <h1 className="font-heading text-3xl font-bold">
          {seat ? `שלום ${seat.name}!` : "העלאת תמונה לפסיפס"}
        </h1>
        {companyName && (
          <p className="mt-2 text-sm text-zinc-500">{companyName}</p>
        )}
      </header>

      {!seat && (
        <p className="rounded-xl bg-red-50 p-4 text-center text-red-700">
          הקישור אינו תקין.
        </p>
      )}

      {seat && alreadyDone && (
        <div className="card p-8 text-center">
          <h2 className="font-heading text-2xl font-bold">כבר שלחת! ✅</h2>
          <p className="mt-2 text-zinc-600">התמונה שלך התקבלה. תודה!</p>
        </div>
      )}

      {seat && !alreadyDone && !open && (
        <p className="rounded-xl bg-amber-50 p-4 text-center text-amber-800">
          הפרויקט אינו פעיל כרגע. פנו למנהל הפרויקט בחברה.
        </p>
      )}

      {seat && !alreadyDone && open && (
        <SeatSubmit inviteToken={token} cols={cols} rows={rows} />
      )}
    </main>
  );
}

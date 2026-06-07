/**
 * Employee workspace portal — /workspace/[id].
 *
 * Public, no login. We validate the workspace server-side and only render the
 * submission form when it's active, not expired, and has free slots. The actual
 * insert is still RLS-guarded on the client (defense in depth).
 */
import { WorkspaceSubmit } from "@/components/b2b/WorkspaceSubmit";
import { workspaceStatus } from "@/lib/b2b";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const admin = createAdminClient();
  const { data: ws } = await admin
    .from("b2b_workspaces")
    .select("id, active, expiration_date, max_slots, slots_used")
    .eq("id", id)
    .maybeSingle();

  const { open, full, expired, remaining } = workspaceStatus(ws);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="text-center">
        <h1 className="font-heading text-3xl font-bold">העלאת תמונה לפסיפס</h1>
        {ws && open && (
          <p className="mt-2 text-sm text-zinc-500">
            נותרו {remaining} מתוך {ws.max_slots} מקומות
          </p>
        )}
      </header>

      {!ws && (
        <p className="rounded-xl bg-red-50 p-4 text-center text-red-700 dark:bg-red-950 dark:text-red-300">
          סביבת עבודה לא נמצאה.
        </p>
      )}
      {ws && !open && (
        <p className="rounded-xl bg-amber-50 p-4 text-center text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {full
            ? "סביבת העבודה מלאה — כל המקומות נוצלו."
            : expired
              ? "סביבת העבודה פגה."
              : "סביבת העבודה אינה פעילה."}
        </p>
      )}

      {open && <WorkspaceSubmit workspaceId={id} />}
    </main>
  );
}

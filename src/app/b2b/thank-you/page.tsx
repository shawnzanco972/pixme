/**
 * B2B post-purchase confirmation. After payment the iCount webhook provisions
 * the workspace and (once email is wired) sends the secure link to the buyer.
 * If the workspace already exists (payment confirmed), we surface its link here.
 */
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  let workspaceId: string | null = null;
  if (order) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("b2b_workspaces")
      .select("id")
      .eq("b2b_order_id", order)
      .limit(1)
      .maybeSingle();
    workspaceId = data?.id ?? null;
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-heading text-3xl font-bold">תודה על הרכישה!</h1>

      {workspaceId ? (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            סביבת העבודה שלכם מוכנה. שתפו את הקישור הבא עם העובדים:
          </p>
          <code
            dir="ltr"
            className="block w-full rounded-lg bg-zinc-100 p-3 text-sm break-all dark:bg-zinc-900"
          >
            {`/workspace/${workspaceId}`}
          </code>
          <Link
            href={`/workspace/${workspaceId}`}
            className="rounded-full bg-black px-8 py-3 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            פתחו את סביבת העבודה
          </Link>
        </>
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          ההזמנה התקבלה. לאחר אישור התשלום, קישור סביבת העבודה יישלח לאימייל שלכם.
        </p>
      )}
    </main>
  );
}

/**
 * B2B post-purchase confirmation. After payment the iCount webhook provisions
 * the workspace and (once email is wired) emails the owner link to the buyer.
 * Here we surface the private OWNER dashboard link — the single thing the buyer
 * needs to add their team and track progress.
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

  let ownerToken: string | null = null;
  let projectName: string | null = null;
  let paid = false;
  if (order) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("b2b_orders")
      .select("owner_token, project_name, status")
      .eq("id", order)
      .maybeSingle();
    ownerToken = data?.owner_token ?? null;
    projectName = data?.project_name ?? null;
    paid = data?.status === "paid";
  }

  const ownerPath = ownerToken ? `/b2b/project/${ownerToken}` : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-heading text-3xl font-bold">תודה על הרכישה! 🎉</h1>

      {ownerPath ? (
        <>
          <p className="text-zinc-600">
            {projectName ? `הפרויקט "${projectName}" מוכן.` : "הפרויקט שלכם מוכן."}{" "}
            זהו לוח הבקרה הפרטי שלכם — הוסיפו את העובדים, שתפו קישורים אישיים
            ועקבו אחרי ההתקדמות. שמרו אותו, זו הכניסה היחידה לפרויקט.
          </p>
          {!paid && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              התשלום עדיין בעיבוד — הקישור כבר פעיל וייפתח במלואו ברגע שהתשלום
              יאושר.
            </p>
          )}
          <code
            dir="ltr"
            className="block w-full rounded-lg bg-surface-muted p-3 text-sm break-all"
          >
            {ownerPath}
          </code>
          <Link href={ownerPath} className="btn btn-primary">
            פתחו את לוח הבקרה
          </Link>
        </>
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          ההזמנה התקבלה. לאחר אישור התשלום יישלח אליכם קישור לניהול הפרויקט.
        </p>
      )}
    </main>
  );
}

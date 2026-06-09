/**
 * Sandbox tab — /admin/sandbox. Run end-to-end test purchases (B2C + B2B)
 * without a real iCount transaction, then follow the live links to verify the
 * customer, project-owner, and employee experiences. Test orders are marked
 * is_test and can be wiped from here.
 */
import { redirect } from "next/navigation";

import { SandboxConsole } from "@/components/admin/SandboxConsole";
import { getAdminContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSandbox() {
  const { supabase, user } = await getAdminContext();
  if (!user) redirect("/admin/login");

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">ארגז חול — בדיקת רכישה</h1>
        <p className="mt-1 text-sm text-zinc-500">
          יוצר הזמנות אמת בזרימה המלאה אך ללא חיוב iCount. ההזמנות מסומנות
          כ&quot;בדיקה&quot; ולא נשלחות מהן הודעות אימייל. כשתחברו את iCount —
          הזרימה האמיתית כבר מוכנה וזהה.
        </p>
      </div>
      <SandboxConsole />
    </main>
  );
}

/**
 * Docs tab — /admin/docs. Preview the generated instruction manual + packing
 * list for any order, edit the DB-backed PDF copy, and see the packing
 * constants that drive weight/parts math.
 */
import { redirect } from "next/navigation";

import { DocsPreview } from "@/components/admin/DocsPreview";
import { SettingsManager } from "@/components/admin/SettingsManager";
import {
  GRAMS_PER_STUD,
  PACKAGING_GRAMS,
  SPARE_RATIO,
  MIN_SPARE_PIECES,
} from "@/lib/packing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDocs() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const constants: Array<[string, string]> = [
    ["משקל ליחידה (סטאד)", `${GRAMS_PER_STUD} ג׳`],
    ["משקל אריזה", `${PACKAGING_GRAMS} ג׳`],
    ["רזרבת חלקים", `${Math.round(SPARE_RATIO * 100)}%`],
    ["מינימום רזרבה", `${MIN_SPARE_PIECES} חלקים`],
  ];

  return (
    <main className="flex w-full flex-1 flex-col gap-8 p-6">
      <h1 className="font-heading text-2xl font-bold">מסמכים</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">תצוגה מקדימה</h2>
        <p className="text-sm text-zinc-500">
          הפיקו את חוברת ההוראות או רשימת האריזה לכל הזמנה לבדיקת הפלט.
        </p>
        <DocsPreview />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">טקסטים ב־PDF</h2>
        <p className="text-sm text-zinc-500">
          ניתן לעריכה ללא פריסה מחדש (נשמר בטבלת ההגדרות).
        </p>
        <SettingsManager />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          קבועי אריזה ומשקל
        </h2>
        <p className="text-sm text-zinc-500">
          מזינים את חישובי המשקל והחלקים. כרגע קבועים בקוד (<code>packing.ts</code>).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {constants.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-outline p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

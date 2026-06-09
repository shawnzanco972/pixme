/**
 * Designs gallery tab — /admin/designs.
 *
 * Manages the catalog of ready-made artworks shown on the homepage. Admins
 * upload art, set its default baseplate size (which determines the brick count),
 * reorder, hide/show, and delete. Customers browse these on the homepage and
 * open them pre-loaded in the /create studio.
 */
import { redirect } from "next/navigation";

import { DesignsManager } from "@/components/admin/DesignsManager";
import { designPublicUrl } from "@/lib/supabase/storage";
import { getAdminContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDesigns() {
  const { supabase, user } = await getAdminContext();
  if (!user) redirect("/admin/login");

  const { data } = await supabase
    .from("ready_designs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const designs = (data ?? []).map((d) => ({
    ...d,
    imageUrl: designPublicUrl(supabase, d.image_path),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="font-heading text-2xl font-bold">גלריית עיצובים מוכנים</h1>
        <p className="mt-1 text-sm text-zinc-600">
          עיצובים שהלקוח יכול לבחור מהדף הבית ולפתוח ישירות בסטודיו. כל עיצוב
          נטען עם הגודל שמוגדר כאן, וממנו נגזר מספר הלבנים.
        </p>
      </header>
      <DesignsManager initial={designs} />
    </div>
  );
}

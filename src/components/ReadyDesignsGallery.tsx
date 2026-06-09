/**
 * Homepage gallery of ready-made designs (managed in /admin/designs).
 *
 * Server component — reads the public `ready_designs` catalog and hands it to
 * the client <DesignGallery> for rendering (mosaic previews + show-more toggle).
 * Each design links to /create?design=<id>. Renders nothing when the catalog is
 * empty so the section only appears once the admin has added designs.
 */
import { DesignGallery, type GalleryDesign } from "@/components/DesignGallery";
import { parseEngineSettings } from "@/lib/design-settings";
import { designPublicUrl } from "@/lib/supabase/storage";
import { createPublicClient } from "@/lib/supabase/server";

export async function ReadyDesignsGallery() {
  // Cookie-less public client so the homepage stays statically cacheable.
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("ready_designs")
    .select(
      "id, title, image_path, default_plates_x, default_plates_y, brick_count, settings",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const designs: GalleryDesign[] = (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    imageUrl: designPublicUrl(supabase, d.image_path),
    platesX: d.default_plates_x,
    platesY: d.default_plates_y,
    brickCount: d.brick_count ?? 0,
    settings: parseEngineSettings(d.settings),
  }));

  if (designs.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="mb-12 flex flex-col items-center gap-2 text-center">
        <h2 className="font-heading text-3xl font-bold sm:text-4xl">
          גלריית עיצובים מוכנים
        </h2>
        <p className="max-w-xl text-lg text-foreground/70">
          בלי מצלמה ובלי מאמץ — בחרו יצירה מוכנה, התאימו את הגודל בלחיצה, וקבלו
          ערכת פסיפס שמחכה רק להרכבה.
        </p>
      </div>

      <DesignGallery designs={designs} />
    </section>
  );
}

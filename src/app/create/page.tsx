import { CreateWizard } from "@/components/b2c/create/CreateWizard";
import type { StudioLibraryItem } from "@/components/b2c/Studio";
import { parseEngineSettings } from "@/lib/design-settings";
import { designPublicUrl } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "צרו פסיפס — Pixipic",
};

export const dynamic = "force-dynamic";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const { design: designId } = await searchParams;
  const supabase = await createClient();

  // Whole active catalog → suggestions strip at the bottom of the studio.
  const { data: rows } = await supabase
    .from("ready_designs")
    .select(
      "id, title, image_path, default_plates_x, default_plates_y, settings",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const library: StudioLibraryItem[] = (rows ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    imageUrl: designPublicUrl(supabase, d.image_path),
    platesX: d.default_plates_x,
    platesY: d.default_plates_y,
    settings: parseEngineSettings(d.settings),
  }));

  // If arrived from a specific design, pre-load it with its saved settings.
  const selected = designId
    ? library.find((d) => d.id === designId)
    : undefined;

  return (
    <CreateWizard
      library={library}
      initialImageUrl={selected?.imageUrl}
      initialImageName={selected ? `${selected.title}.png` : undefined}
      initialPlatesX={selected?.platesX}
      initialPlatesY={selected?.platesY}
      initialSettings={selected?.settings}
    />
  );
}

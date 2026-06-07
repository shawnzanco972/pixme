/**
 * Admin order detail + fulfillment sheet — /admin/orders/[id].
 *
 * This is what the operator works from to fulfill an order:
 *  - the customer instruction PDF (print + put in the box)
 *  - a per-color packing list in GRAMS incl. spare (weigh-and-pack)
 *  - shipping details + a "mark shipped" action
 */
import { notFound, redirect } from "next/navigation";

import { DownloadInstructions } from "@/components/b2c/DownloadInstructions";
import { FulfillButton } from "@/components/admin/FulfillButton";
import { formatWeight, GRAMS_PER_STUD } from "@/lib/packing";
import { formatILS } from "@/lib/pricing";
import { orderPackingList } from "@/lib/restock";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSignedDownloadUrl } from "@/lib/supabase/storage";
import type {
  OrderStatus,
  PixelMap,
  ShippingAddress,
} from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

const STATUS_HE: Record<OrderStatus, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  fulfilled: "נשלח",
  cancelled: "בוטל",
  refunded: "הוחזר",
};

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: order } = await supabase
    .from("b2c_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (!order) notFound();

  const pixelMap = (order.pixel_map as PixelMap | null) ?? null;
  const packing = pixelMap ? orderPackingList(pixelMap) : null;
  const address = order.shipping_address as ShippingAddress | null;

  // Signed URL for the original uploaded photo (private bucket).
  let photoUrl: string | null = null;
  if (order.image_url) {
    try {
      photoUrl = await createSignedDownloadUrl(
        createAdminClient(),
        order.image_url,
        3600,
      );
    } catch {
      photoUrl = null;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          → חזרה ללוח הניהול
        </a>
        <FulfillButton orderId={order.id} status={order.status as OrderStatus} />
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold">
          הזמנה {order.customer_name}
        </h1>
        <p className="text-sm text-zinc-500">
          {STATUS_HE[order.status as OrderStatus]} ·{" "}
          {formatILS(Number(order.total_price))} · {order.created_at.slice(0, 10)}
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {/* Shipping + actions */}
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-heading text-lg font-semibold">משלוח</h2>
          <p className="text-sm" dir="ltr">
            {order.contact_email}
          </p>
          {address ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {address.street}, {address.city} {address.zip}
            </p>
          ) : (
            <p className="text-sm text-zinc-400">אין כתובת</p>
          )}
          <div className="mt-2">
            <DownloadInstructions
              orderId={order.id}
              label="הורד הוראות ללקוח (PDF)"
            />
          </div>
        </div>

        {/* Original photo */}
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-heading text-lg font-semibold">תמונה מקורית</h2>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="original"
              className="max-h-48 w-full rounded-lg object-contain"
            />
          ) : (
            <p className="text-sm text-zinc-400">אין תמונה</p>
          )}
        </div>
      </section>

      {/* Packing list */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">
          רשימת אריזה — שקילה לפי צבע (כולל רזרבה)
        </h2>
        {!packing ? (
          <p className="text-sm text-zinc-400">אין עדיין מפת לבנים להזמנה זו.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-start text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-3 text-start">צבע</th>
                  <th className="p-3 text-start">בעיצוב</th>
                  <th className="p-3 text-start">לארוז (כולל רזרבה)</th>
                  <th className="p-3 text-start">משקל לשקילה</th>
                </tr>
              </thead>
              <tbody>
                {packing.lines.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded border border-black/20"
                          style={{ backgroundColor: l.hex }}
                        />
                        {l.name}
                        {!l.core ? (
                          <span className="text-xs text-amber-500">בוסט</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="p-3">{l.pieces.toLocaleString("he-IL")}</td>
                    <td className="p-3">
                      {l.piecesWithSpare.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3 font-medium">{formatWeight(l.grams)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                  <td className="p-3">
                    סה״כ ({packing.lines.length} צבעים)
                  </td>
                  <td className="p-3">
                    {packing.totalPieces.toLocaleString("he-IL")}
                  </td>
                  <td className="p-3" />
                  <td className="p-3">{formatWeight(packing.totalGrams)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          ~{GRAMS_PER_STUD} גרם ללבנה · &quot;בוסט&quot; = צבע מחוץ ל-17 הליבה.
        </p>
      </section>
    </main>
  );
}

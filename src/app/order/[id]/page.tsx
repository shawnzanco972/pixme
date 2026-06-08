/**
 * B2C order status page — /order/[id].
 *
 * The order id is a secret UUID acting as the access token (guest model, no
 * login). We read via the service-role client (RLS blocks anon reads), but only
 * ever expose this single order's non-sensitive fields.
 */
import { notFound } from "next/navigation";

import { DownloadInstructions } from "@/components/b2c/DownloadInstructions";
import { MosaicPreview } from "@/components/MosaicPreview";
import { formatILS } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";
import type { OrderStatus, PixelMap } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

const STATUS_HE: Record<OrderStatus, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  fulfilled: "נשלח",
  cancelled: "בוטל",
  refunded: "הוחזר",
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("b2c_orders")
    .select(
      "id, customer_name, status, fulfillment_type, total_price, pixel_map, created_at, intent, gift_message, gift_wrap, recipient_name, deliver_to",
    )
    .eq("id", id)
    .single();

  if (error || !order) notFound();

  const pixelMap = order.pixel_map as PixelMap | null;
  const hasMap = Array.isArray(pixelMap);
  const isGift = order.intent === "gift";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-8">
      <h1 className="font-heading text-3xl font-bold">ההזמנה שלך</h1>

      {hasMap && pixelMap && (
        <div className="overflow-hidden rounded-2xl border border-outline">
          <MosaicPreview pixelMap={pixelMap} />
        </div>
      )}

      <dl className="card grid grid-cols-2 gap-y-3 p-6">
        <dt className="text-zinc-500">מספר הזמנה</dt>
        <dd className="text-end font-mono text-sm" dir="ltr">
          {order.id}
        </dd>

        <dt className="text-zinc-500">שם</dt>
        <dd className="text-end">{order.customer_name}</dd>

        <dt className="text-zinc-500">סטטוס</dt>
        <dd className="text-end font-medium">
          {STATUS_HE[order.status as OrderStatus] ?? order.status}
        </dd>

        <dt className="text-zinc-500">אספקה</dt>
        <dd className="text-end">
          {order.fulfillment_type === "physical" ? "ערכה פיזית" : "דיגיטלי"}
        </dd>

        <dt className="text-zinc-500">סכום</dt>
        <dd className="text-end">{formatILS(Number(order.total_price))}</dd>
      </dl>

      {isGift && (
        <div className="card flex flex-col gap-2 border-t-4 border-t-accent p-6">
          <h2 className="font-heading text-lg font-bold">🎁 מתנה</h2>
          {order.recipient_name && (
            <p className="text-sm">
              <span className="text-zinc-500">עבור: </span>
              {order.recipient_name}
            </p>
          )}
          <p className="text-sm">
            <span className="text-zinc-500">משלוח: </span>
            {order.deliver_to === "recipient"
              ? "ישירות למקבל/ת"
              : "אליכם לעטיפה"}
          </p>
          {order.gift_wrap && (
            <p className="text-sm text-success">✓ כולל עטיפת מתנה חגיגית</p>
          )}
          {order.gift_message && (
            <p className="rounded-lg bg-surface-muted p-3 text-sm italic">
              “{order.gift_message}”
            </p>
          )}
        </div>
      )}

      {order.status === "pending" && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          ההזמנה התקבלה. לאחר אישור התשלום, הוראות ההרכבה יהיו זמינות להורדה כאן.
        </p>
      )}

      {hasMap && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-500">
            הוראות ההרכבה (PDF) זמינות להורדה חינם:
          </p>
          <DownloadInstructions orderId={order.id} />
        </div>
      )}
    </main>
  );
}

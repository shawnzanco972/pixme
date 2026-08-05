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
import { formatILS, PLATE_STUDS } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";
import { toEnginePixelMap } from "@/lib/brick-engine/palette";
import type { OrderStatus, StoredPixelMap } from "@/lib/supabase/types.helpers";

export const dynamic = "force-dynamic";

const CM_PER_PLATE = 19.2;

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

  const pixelMap = toEnginePixelMap(order.pixel_map as StoredPixelMap | null);
  const hasMap = pixelMap !== null;
  const isGift = order.intent === "gift";
  const status = order.status as OrderStatus;
  const paid = status === "paid" || status === "fulfilled";
  const shipped = status === "fulfilled";
  const cancelled = status === "cancelled" || status === "refunded";

  // Size line from the stored map dimensions.
  let sizeLine: string | null = null;
  if (pixelMap) {
    const cols = pixelMap[0]?.length ?? 0;
    const rows = pixelMap.length;
    const cmX = Math.round((cols / PLATE_STUDS) * CM_PER_PLATE);
    const cmY = Math.round((rows / PLATE_STUDS) * CM_PER_PLATE);
    sizeLine = `⁦${cmX}×${cmY}⁩ ס״מ · ${(cols * rows).toLocaleString("he-IL")} לבנים`;
  }

  // Status headline / badge.
  const badge = cancelled
    ? { text: status === "refunded" ? "הוחזר" : "ההזמנה בוטלה", bg: "#f4f6f8", fg: "#6b7278", bevel: "#e2e7ec" }
    : paid
      ? { text: "ההזמנה נקלטה", bg: "#eaf3ee", fg: "#2e7d32", bevel: "#d5e5d8" }
      : { text: "ממתין לתשלום", bg: "#fdf3e0", fg: "#9a7400", bevel: "#f0e2c2" };
  const headline = cancelled
    ? "פרטי ההזמנה"
    : paid
      ? "הפסיפס שלכם בדרך"
      : "כמעט שם";

  // Three-step tracker.
  const steps: { label: string; icon: string; state: "done" | "active" | "todo" }[] = [
    { label: "שולם", icon: "check_circle", state: paid ? "done" : "todo" },
    {
      label: shipped ? "נארז ונשלח" : "באריזה — יוצא תוך 1–3 ימי עסקים",
      icon: "inventory_2",
      state: shipped ? "done" : paid ? "active" : "todo",
    },
    { label: "נשלח", icon: "local_shipping", state: shipped ? "done" : "todo" },
  ];
  const stepStyle = (s: "done" | "active" | "todo") =>
    s === "done"
      ? {
          background: "linear-gradient(180deg, #35893a 0%, #2e7d32 100%)",
          color: "#fff",
          boxShadow: "0 4px 0 0 #1f5a22, inset 0 2px 0 rgba(255,255,255,0.24)",
        }
      : s === "active"
        ? {
            background: "linear-gradient(180deg, #ffd968 0%, #f3bf2f 100%)",
            color: "#4a3700",
            boxShadow: "0 4px 0 0 #b98600, inset 0 2px 0 rgba(255,255,255,0.5)",
          }
        : {
            background: "#f4f6f8",
            color: "#6b7278",
            boxShadow: "inset 0 2px 5px rgba(25,28,30,0.12)",
          };

  const row = "flex items-center gap-3 rounded-xl px-3.5 py-3 font-heading text-sm font-bold";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      {/* Header block */}
      <div className="flex flex-col items-center gap-3.5 text-center">
        <span
          className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 font-heading text-sm font-bold"
          style={{ background: badge.bg, color: badge.fg, boxShadow: `0 3px 0 0 ${badge.bevel}` }}
        >
          {badge.text}
          {paid && !cancelled && (
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{
                background: "#2e7d32",
                boxShadow:
                  "inset 0 2px 2px rgba(255,255,255,0.55), inset 0 -3px 3px rgba(0,0,0,0.3)",
              }}
            />
          )}
        </span>
        <h1 className="font-heading font-black tracking-[-0.03em] text-[clamp(30px,4.4vw,46px)]">
          {headline}
        </h1>
        <p className="max-w-[34em] text-[17px] leading-7 text-foreground/60">
          שמרו את הדף — כאן תמיד תמצאו את מצב ההזמנה ואת חוברת ההוראות להורדה.
        </p>
      </div>

      {/* Mosaic + details */}
      <div className="flex flex-wrap gap-6">
        {hasMap && pixelMap && (
          <div className="flex min-w-[280px] flex-1 justify-center">
            <div
              className="w-full max-w-[360px] rounded-lg p-3.5"
              style={{
                background:
                  "linear-gradient(150deg, #4a5058 0%, #262a30 50%, #16191d 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.16), 0 30px 40px -26px rgba(20,23,27,0.8)",
              }}
            >
              <div
                className="overflow-hidden rounded-[3px] p-3"
                style={{ background: "#f4f5f6", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.16)" }}
              >
                <MosaicPreview pixelMap={pixelMap} />
              </div>
            </div>
          </div>
        )}

        <div className="flex min-w-[300px] flex-1 flex-col gap-4">
          {/* Order details */}
          <div
            className="flex flex-col gap-3.5 rounded-[20px] bg-surface p-6"
            style={{ border: "1px solid var(--color-outline)", boxShadow: "0 6px 0 0 #eceff2" }}
          >
            <h2 className="font-heading text-lg font-black">פרטי ההזמנה</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[15px]">
              <dt className="text-foreground/55">מספר הזמנה</dt>
              <dd className="text-start font-mono text-[13px] text-foreground/70" dir="ltr">
                {order.id}
              </dd>
              <dt className="text-foreground/55">שם</dt>
              <dd className="font-semibold">{order.customer_name}</dd>
              <dt className="text-foreground/55">אספקה</dt>
              <dd className="font-semibold">
                {order.fulfillment_type === "physical"
                  ? "ערכה פיזית · משלוח חינם"
                  : "דיגיטלי"}
              </dd>
              {sizeLine && (
                <>
                  <dt className="text-foreground/55">גודל</dt>
                  <dd className="font-semibold">{sizeLine}</dd>
                </>
              )}
              <dt className="text-foreground/55">סכום</dt>
              <dd className="font-heading text-xl font-black text-primary">
                {formatILS(Number(order.total_price))}
              </dd>
            </dl>
          </div>

          {/* Status tracker */}
          {!cancelled && (
            <div
              className="flex flex-col gap-3.5 rounded-[20px] bg-surface p-6"
              style={{ border: "1px solid var(--color-outline)", boxShadow: "0 6px 0 0 #eceff2" }}
            >
              <h2 className="font-heading text-lg font-black">מצב ההזמנה</h2>
              <div className="flex flex-col gap-2.5">
                {steps.map((s) => (
                  <div key={s.label} className={row} style={stepStyle(s.state)}>
                    <span className="mi text-[22px]">{s.icon}</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {status === "pending" && (
        <p
          className="rounded-[16px] p-4 text-sm"
          style={{ background: "#fdf3e0", color: "#9a7400" }}
        >
          ההזמנה התקבלה. לאחר אישור התשלום, הוראות ההרכבה יהיו זמינות להורדה כאן.
        </p>
      )}

      {/* Instructions download */}
      {hasMap && (
        <div
          className="flex flex-wrap items-center gap-4 rounded-[20px] bg-surface p-6"
          style={{ border: "3px solid var(--color-secondary)", boxShadow: "0 8px 0 0 #d5dee9" }}
        >
          <div className="min-w-[220px] flex-1">
            <h2 className="mb-1.5 font-heading text-xl font-black">חוברת ההוראות</h2>
            <p className="text-[15px] leading-relaxed text-foreground/60">
              מפת הרכבה בגודל 1:1, לוח אחרי לוח, כולל ספירת לבנים לכל צבע. ההורדה
              חינם וזמינה תמיד מהדף הזה.
            </p>
          </div>
          <DownloadInstructions orderId={order.id} />
        </div>
      )}

      {/* Gift */}
      {isGift && (
        <div
          className="flex flex-col gap-3 rounded-[20px] p-6"
          style={{ background: "#fffaf0", border: "1px solid #f0dfae", boxShadow: "0 6px 0 0 #f5ecd6" }}
        >
          <h2 className="flex items-center gap-2.5 font-heading text-lg font-black">
            <span className="mi text-[22px]" style={{ color: "#9a7400" }}>
              redeem
            </span>
            נשלח כמתנה
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
            {order.recipient_name && (
              <>
                <dt className="text-foreground/55">עבור</dt>
                <dd className="font-semibold">{order.recipient_name}</dd>
              </>
            )}
            <dt className="text-foreground/55">משלוח</dt>
            <dd className="font-semibold">
              {order.deliver_to === "recipient" ? "ישירות למקבל/ת" : "אליכם לעטיפה"}
              {order.gift_wrap ? " · כולל עטיפת מתנה" : ""}
            </dd>
          </dl>
          {order.gift_message && (
            <p
              className="rounded-xl bg-surface p-3.5 text-[15px] italic text-foreground/70"
              style={{ boxShadow: "inset 0 2px 6px rgba(25,28,30,0.06)" }}
            >
              “{order.gift_message}”
            </p>
          )}
        </div>
      )}

      {/* Help */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-surface-muted px-6 py-5">
        <span className="text-[15px] text-foreground/60">
          שאלה על ההזמנה? כתבו לנו ונחזור אליכם באותו יום עסקים.
        </span>
        <a href="mailto:hello@pixipic.co.il" className="btn btn-ghost">
          יצירת קשר
        </a>
      </div>
    </main>
  );
}

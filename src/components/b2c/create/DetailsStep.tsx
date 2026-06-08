"use client";
/**
 * Step 3 — order details. Fields adapt to intent: a gift adds a message,
 * optional gift-wrap, and a "ship to me / ship to recipient" choice (the
 * address block is then the recipient's, and the parcel must hide the price —
 * enforced server-side / on the packing slip). Submits: upload photo → create
 * order → checkout.
 */
import { useEffect, useRef, useState } from "react";

import type { DesignPayload } from "@/components/b2c/Studio";
import type { Intent } from "@/components/b2c/create/RecipientStep";
import { renderBricks } from "@/lib/brick-render";
import { formatILS, GIFT_WRAP_FEE } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";
import { uploadToSignedUrl } from "@/lib/supabase/storage";

export function DetailsStep({
  design,
  intent,
  onBack,
}: {
  design: DesignPayload;
  intent: Intent;
  onBack: () => void;
}) {
  const isGift = intent === "gift";
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  // Gift-only
  const [giftMessage, setGiftMessage] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [deliverTo, setDeliverTo] = useState<"buyer" | "recipient">("recipient");
  const [recipientName, setRecipientName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (previewRef.current) renderBricks(previewRef.current, design.pixelMap);
  }, [design.pixelMap]);

  const total = design.price + (isGift && giftWrap ? GIFT_WRAP_FEE : 0);
  const shipToRecipient = isGift && deliverTo === "recipient";
  const addressLabel = shipToRecipient
    ? "כתובת המקבל/ת"
    : "כתובת למשלוח";

  async function submit() {
    setError(null);
    if (!name.trim() || !email.trim())
      return setError("נא למלא שם ואימייל.");
    if (!street || !city || !zip) return setError("נא למלא כתובת למשלוח.");
    if (shipToRecipient && !recipientName.trim())
      return setError("נא למלא את שם המקבל/ת.");

    setSubmitting(true);
    try {
      let imagePath: string | null = null;
      if (design.file) {
        const signRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: design.file.type }),
        });
        if (!signRes.ok) throw new Error("שגיאה בהכנת ההעלאה.");
        const { path, token } = (await signRes.json()) as {
          path: string;
          token: string;
        };
        await uploadToSignedUrl(createClient(), path, token, design.file);
        imagePath = path;
      }

      const address = { street, city, zip };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "b2c",
          customer_name: name,
          contact_email: email,
          fulfillment_type: "physical",
          image_url: imagePath,
          pixel_map: design.pixelMap,
          shipping_address: address,
          intent,
          gift_message: isGift ? giftMessage || null : null,
          gift_wrap: isGift ? giftWrap : false,
          deliver_to: isGift ? deliverTo : "buyer",
          recipient_name: isGift ? recipientName || null : null,
          recipient_address: shipToRecipient ? address : null,
        }),
      });
      if (!res.ok) throw new Error("שגיאה ביצירת ההזמנה.");
      const { url, orderId } = (await res.json()) as {
        url?: string;
        orderId: string;
      };
      window.location.assign(url ?? `/order/${orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 p-6 lg:grid-cols-[360px_1fr]">
      {/* Summary */}
      <aside className="card flex h-fit flex-col gap-4 p-6 lg:sticky lg:top-6">
        <h2 className="font-heading text-lg font-bold">סיכום הזמנה</h2>
        <div className="flex items-center gap-3">
          <canvas
            ref={previewRef}
            className="h-16 w-16 rounded-lg border border-outline object-contain"
          />
          <div>
            <p className="font-medium">ערכת פסיפס אישית</p>
            <p className="text-xs text-zinc-500">
              {design.cols}×{design.rows} לבנים
            </p>
          </div>
        </div>
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label="סכום ביניים" value={formatILS(design.price)} />
          {isGift && giftWrap && (
            <Row label="עטיפת מתנה" value={formatILS(GIFT_WRAP_FEE)} />
          )}
          <div className="my-1 border-t border-outline" />
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold">סך הכל לתשלום</span>
            <span className="font-heading text-2xl font-bold">
              {formatILS(total)}
            </span>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? "מעבד…" : "ביצוע הזמנה ותשלום 🔒"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-center text-xs text-zinc-500">תשלום מאובטח</p>
      </aside>

      {/* Form */}
      <div className="flex flex-col gap-6">
        <Section title="פרטי הרוכש">
          <input
            className="input"
            placeholder="שם מלא"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            dir="ltr"
            className="input text-start"
            placeholder="דוא״ל לאישור הזמנה"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Section>

        {isGift && (
          <Section title="פרטי המתנה" accent>
            <textarea
              className="input min-h-24 py-2"
              placeholder="מסר אישי (אופציונלי) — כתבו ברכה שתוצמד למתנה…"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={giftWrap}
                onChange={(e) => setGiftWrap(e.target.checked)}
              />
              <span className="flex flex-col">
                <span className="font-medium">
                  עטיפת מתנה (+{formatILS(GIFT_WRAP_FEE)})
                </span>
                <span className="text-sm text-zinc-600">
                  אריזה חגיגית עם סרט וכרטיס ברכה
                </span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <DeliverChoice
                selected={deliverTo === "buyer"}
                onSelect={() => setDeliverTo("buyer")}
                icon="🏠"
                label="שלחו אליי ואני אעניק"
              />
              <DeliverChoice
                selected={deliverTo === "recipient"}
                onSelect={() => setDeliverTo("recipient")}
                icon="🚚"
                label="שלחו ישירות למקבל/ת"
              />
            </div>
            {shipToRecipient && (
              <input
                className="input"
                placeholder="שם המקבל/ת"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            )}
          </Section>
        )}

        <Section title={addressLabel}>
          <input
            className="input"
            placeholder="רחוב ומספר בית — לדוגמה: הרצל 12"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="עיר"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <input
              className="input"
              placeholder="מיקוד"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </div>
        </Section>

        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm text-zinc-500 underline"
        >
          → חזרה
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`card flex flex-col gap-3 p-5 ${accent ? "border-t-4 border-t-accent" : ""}`}
    >
      <h3 className="font-heading font-bold">{title}</h3>
      {children}
    </section>
  );
}

function DeliverChoice({
  selected,
  onSelect,
  icon,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1 rounded-xl border p-4 text-center text-sm transition ${
        selected
          ? "border-secondary bg-secondary/5 ring-1 ring-secondary"
          : "border-outline hover:border-zinc-300"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

"use client";
/**
 * B2B purchase form — a company buys a batch of mosaic licenses (guest
 * checkout). On payment, the iCount webhook provisions a workspace with a
 * secure UUID link the buyer shares with employees.
 */
import { useState } from "react";

import { computeB2bPrice, formatILS } from "@/lib/pricing";

export function B2bPurchase() {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [licenses, setLicenses] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = computeB2bPrice(licenses);

  async function handleBuy() {
    setError(null);
    if (!company.trim() || !email.trim())
      return setError("נא למלא שם חברה ואימייל.");
    if (licenses < 1) return setError("יש לבחור לפחות רישיון אחד.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "b2b",
          company_name: company,
          contact_email: email,
          licenses_purchased: licenses,
          amount: price.total,
        }),
      });
      if (!res.ok) throw new Error("שגיאה ביצירת ההזמנה.");
      const { url, orderId } = (await res.json()) as {
        url?: string;
        orderId: string;
      };
      window.location.assign(url ?? `/b2b/thank-you?order=${orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <h1 className="font-heading text-3xl font-bold">פסיפסים לעסקים</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        רכשו חבילת רישיונות. כל עובד יקבל קישור אישי להעלאת תמונה — ללא צורך
        בהרשמה.
      </p>

      <input
        className="input"
        placeholder="שם החברה"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />
      <input
        type="email"
        dir="ltr"
        className="input text-start"
        placeholder="אימייל ליצירת קשר"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">מספר רישיונות: {licenses}</span>
        <input
          type="range"
          min={1}
          max={200}
          value={licenses}
          onChange={(e) => setLicenses(Number(e.target.value))}
        />
        <span className="text-sm text-zinc-500">
          {formatILS(price.perLicense)} לרישיון
        </span>
      </label>

      <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <span className="text-2xl font-bold">{formatILS(price.total)}</span>
        <button
          type="button"
          onClick={() => void handleBuy()}
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? "מעבד…" : "לרכישה"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

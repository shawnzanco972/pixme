"use client";
/**
 * B2B bundle picker + guest checkout. The company chooses a fixed deal bundle
 * (seats × locked size), names the project, and pays once. On success the
 * iCount webhook provisions the workspace; the buyer lands on the thank-you
 * page which surfaces their private owner-dashboard link.
 */
import { useState } from "react";

import {
  B2B_BUNDLES,
  bundlePerSeat,
  bundleStuds,
  type B2bBundle,
} from "@/lib/b2b-bundles";
import { formatILS } from "@/lib/pricing";

export function BundlePurchase() {
  const [selected, setSelected] = useState<string>(
    B2B_BUNDLES.find((b) => b.featured)?.id ?? B2B_BUNDLES[0].id,
  );
  const [company, setCompany] = useState("");
  const [project, setProject] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundle = B2B_BUNDLES.find((b) => b.id === selected)!;

  async function handleBuy() {
    setError(null);
    if (!company.trim() || !email.trim())
      return setError("נא למלא שם חברה ואימייל.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "b2b",
          bundle_id: bundle.id,
          company_name: company,
          project_name: project || null,
          contact_email: email,
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
    <div className="flex flex-col gap-8">
      {/* Bundle cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {B2B_BUNDLES.map((b) => (
          <BundleCard
            key={b.id}
            bundle={b}
            selected={b.id === selected}
            onSelect={() => setSelected(b.id)}
          />
        ))}
      </div>

      {/* Checkout details */}
      <div className="card mx-auto flex w-full max-w-md flex-col gap-4 p-6">
        <div className="flex items-baseline justify-between">
          <h3 className="font-heading text-lg font-bold">
            חבילת {bundle.nameHe}
          </h3>
          <span className="text-2xl font-bold">{formatILS(bundle.price)}</span>
        </div>
        <input
          className="input"
          placeholder="שם החברה"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <input
          className="input"
          placeholder="שם הפרויקט (לא חובה) — לדוגמה: מתנת ראש השנה"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
        <input
          type="email"
          dir="ltr"
          className="input text-start"
          placeholder="אימייל ליצירת קשר"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void handleBuy()}
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? "מעבד…" : `לרכישה — ${formatILS(bundle.price)}`}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-center text-xs text-zinc-500">
          לאחר התשלום תקבלו קישור פרטי לניהול הפרויקט והוספת העובדים.
        </p>
      </div>
    </div>
  );
}

function BundleCard({
  bundle,
  selected,
  onSelect,
}: {
  bundle: B2bBundle;
  selected: boolean;
  onSelect: () => void;
}) {
  const { cols, rows } = bundleStuds(bundle);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`card relative flex flex-col gap-3 p-6 text-start transition ${
        selected ? "ring-2 ring-primary" : "hover:border-zinc-300"
      }`}
    >
      {bundle.featured && (
        <span className="absolute -top-3 end-4 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-on-primary">
          הכי משתלם
        </span>
      )}
      <h3 className="font-heading text-xl font-bold">{bundle.nameHe}</h3>
      <p className="text-sm text-zinc-600">{bundle.taglineHe}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-bold">{formatILS(bundle.price)}</span>
      </div>
      <ul className="mt-1 flex flex-col gap-1 text-sm text-zinc-600">
        <li>✓ {bundle.seats} עובדים</li>
        <li>
          ✓ פסיפס {cols}×{rows} לבנים
        </li>
        <li>✓ {formatILS(bundlePerSeat(bundle))} לעובד</li>
        <li>✓ מדריך הרכבה + רשימת חלקים</li>
      </ul>
    </button>
  );
}

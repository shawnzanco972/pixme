"use client";
/**
 * B2B calculator + guest checkout. The buyer plays with employee count and
 * canvas size and sees the real, scaling price (each employee gets a physical
 * gift set, so it's employees × the regular mosaic price). An optional
 * "managed" upsell adds dedicated per-employee upload links + the dashboard.
 *
 * Up to MAX_SELF_SERVE_SEATS it's a direct checkout; above that we switch to a
 * price-quote request (POST /api/b2b/quote).
 */
import { useState } from "react";

import {
  B2B_SIZE_PRESETS,
  buildMinutes,
  computeB2bQuote,
  MANAGED_FEE_PER_SEAT,
  MAX_SELF_SERVE_SEATS,
} from "@/lib/b2b-pricing";
import { computePrice, formatILS } from "@/lib/pricing";

export function B2bCalculator() {
  const [presetId, setPresetId] = useState("2x2");
  const [employees, setEmployees] = useState(15);
  const [managed, setManaged] = useState(true);
  const [company, setCompany] = useState("");
  const [project, setProject] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteSent, setQuoteSent] = useState(false);

  const quote = computeB2bQuote(employees, presetId, managed);
  const isQuote = quote.requiresQuote;
  const minutes = buildMinutes(quote.plates);

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
          preset_id: presetId,
          employees: quote.employees,
          managed,
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

  async function handleQuote() {
    setError(null);
    if (!company.trim() || !email.trim())
      return setError("נא למלא שם חברה ואימייל.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/b2b/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company,
          contact_email: email,
          employees: quote.employees,
          preset_id: presetId,
          managed,
          message,
        }),
      });
      if (!res.ok) throw new Error("שגיאה בשליחת הבקשה.");
      setQuoteSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
    } finally {
      setSubmitting(false);
    }
  }

  if (quoteSent) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h3 className="font-heading text-2xl font-bold">קיבלנו! 🎉</h3>
        <p className="mt-2 text-zinc-600">
          נחזור אליכם עם הצעת מחיר מותאמת תוך יום עסקים אחד.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Controls */}
      <div className="card flex flex-col gap-6 p-6">
        {/* Size */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">גודל הפסיפס לכל עובד</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {B2B_SIZE_PRESETS.map((p) => {
              const per = computePrice(
                p.platesX * 24,
                p.platesY * 24,
                "physical",
              ).total;
              const active = p.id === presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={`rounded-xl border p-3 text-start transition ${
                    active
                      ? "border-primary ring-1 ring-primary"
                      : "border-outline hover:border-zinc-300"
                  }`}
                >
                  <div className="font-bold">{p.labelHe}</div>
                  <div className="text-xs text-zinc-500">
                    {p.platesX * 24}×{p.platesY * 24} · {formatILS(per)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Employees */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between text-sm font-medium">
            <span>מספר עובדים</span>
            <span className="text-lg font-bold">{employees}</span>
          </label>
          <input
            type="range"
            min={1}
            max={120}
            value={Math.min(employees, 120)}
            onChange={(e) => setEmployees(Number(e.target.value))}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              className="input w-28"
              value={employees}
              onChange={(e) =>
                setEmployees(Math.max(1, Number(e.target.value) || 1))
              }
            />
            <span className="text-xs text-zinc-500">
              עד {MAX_SELF_SERVE_SEATS} — מעבר לכך נשמח להכין הצעה אישית.
            </span>
          </div>
        </div>

        {/* Managed upsell */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline p-4">
          <input
            type="checkbox"
            checked={managed}
            className="mt-1"
            onChange={(e) => setManaged(e.target.checked)}
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium">
              ניהול מלא + קישור אישי לכל עובד (+{formatILS(MANAGED_FEE_PER_SEAT)}{" "}
              לעובד)
            </span>
            <span className="text-sm text-zinc-600">
              כל עובד מקבל קישור משלו להעלאת תמונה אהובה, ואתם עוקבים מלוח בקרה
              אחד מי כבר השלים. בלי הניהול — אתם מעלים את התמונות בעצמכם (אפשר גם
              כהפתעה).
            </span>
          </span>
        </label>

        {/* Buyer details */}
        <div className="grid gap-3 border-t border-outline pt-4">
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
          {isQuote && (
            <textarea
              className="input min-h-20"
              placeholder="פרטים נוספים לבקשת הצעת מחיר (לא חובה)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="card flex h-fit flex-col gap-4 p-6 lg:sticky lg:top-6">
        <h3 className="font-heading text-lg font-bold">סיכום</h3>
        <dl className="flex flex-col gap-2 text-sm">
          <Row
            label={`${quote.employees} × פסיפס (${quote.cols}×${quote.rows})`}
            value={formatILS(quote.mosaicsTotal)}
          />
          {managed && (
            <Row
              label={`ניהול + קישורים אישיים (${quote.employees})`}
              value={formatILS(quote.managementTotal)}
            />
          )}
          <div className="my-1 border-t border-outline" />
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {isQuote ? "הערכה" : "סה״כ"}
            </span>
            <span className="text-2xl font-bold">{formatILS(quote.total)}</span>
          </div>
          <p className="text-xs text-zinc-500">
            כל עובד מקבל ערכה פיזית משלו · זמן הרכבה משוער: ~
            {minutes >= 60
              ? `${Math.round(minutes / 60)} שע׳`
              : `${minutes} דק׳`}{" "}
            לערכה
          </p>
        </dl>

        {isQuote ? (
          <button
            type="button"
            onClick={() => void handleQuote()}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? "שולח…" : "בקשת הצעת מחיר"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleBuy()}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? "מעבד…" : `המשך — ${formatILS(quote.total)}`}
          </button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-center text-xs text-zinc-500">
          לאחר התשלום תקבלו קישור פרטי לניהול הפרויקט.
        </p>
      </div>
    </div>
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

"use client";
/**
 * B2B calculator + guest checkout. Controlled: size/employees/managed live in
 * the parent (B2bExperience) so the engine preview below stays in sync with the
 * chosen size. Price scales with quantity (volume discount); above
 * MAX_SELF_SERVE_SEATS it becomes a price-quote request.
 */
import { useState } from "react";

import { buildMinutes, computeB2bQuoteByPlates } from "@/lib/b2b-pricing";
import { formatILS } from "@/lib/pricing";

/** Size bounds for the per-employee mosaic (in 24×24 baseplate units). */
const MIN_PLATES_AXIS = 1;
const MAX_PLATES_AXIS = 5;
const CM_PER_PLATE = 19;

export interface CalculatorState {
  platesX: number;
  setPlatesX: (n: number) => void;
  platesY: number;
  setPlatesY: (n: number) => void;
  employees: number;
  setEmployees: (n: number) => void;
  managed: boolean;
  setManaged: (v: boolean) => void;
}

export function B2bCalculator(props: CalculatorState) {
  const {
    platesX,
    setPlatesX,
    platesY,
    setPlatesY,
    employees,
    setEmployees,
    managed,
    setManaged,
  } = props;
  const [company, setCompany] = useState("");
  const [project, setProject] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteSent, setQuoteSent] = useState(false);

  const quote = computeB2bQuoteByPlates(employees, platesX, platesY, managed);
  const isQuote = quote.requiresQuote;
  const minutes = buildMinutes(quote.plates);
  const sizeLabel = `${platesX * CM_PER_PLATE}×${platesY * CM_PER_PLATE} ס״מ`;

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
          plates_x: platesX,
          plates_y: platesY,
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
          plates_x: platesX,
          plates_y: platesY,
          size: `${quote.cols}×${quote.rows}`,
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
        {/* Size — width × height of each employee's mosaic */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">גודל הפסיפס לכל עובד</span>
            <span className="text-xs text-zinc-500">
              {sizeLabel} · {formatILS(quote.perMosaicBase)}
            </span>
          </div>
          <div className="flex flex-wrap gap-6">
            {(
              [
                ["רוחב", platesX, setPlatesX] as const,
                ["גובה", platesY, setPlatesY] as const,
              ] as const
            ).map(([label, value, setter]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm text-zinc-500">{label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="הקטן"
                    disabled={value <= MIN_PLATES_AXIS}
                    onClick={() => setter(Math.max(MIN_PLATES_AXIS, value - 1))}
                    className="h-8 w-8 rounded-full border border-outline text-lg leading-none disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-medium">{value}</span>
                  <button
                    type="button"
                    aria-label="הגדל"
                    disabled={value >= MAX_PLATES_AXIS}
                    onClick={() => setter(Math.min(MAX_PLATES_AXIS, value + 1))}
                    className="h-8 w-8 rounded-full border border-outline text-lg leading-none disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            {quote.cols}×{quote.rows} אריחים · כל עובד מקבל פסיפס בגודל הזה
          </p>
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
              ככל שמזמינים יותר — המחיר לעובד יורד. עד 100 ישירות, מעבר לכך הצעה
              אישית.
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
              ניהול מלא + קישור אישי לכל עובד ({formatILS(quote.managedFee)}{" "}
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
            value={formatILS(quote.perMosaicBase * quote.employees)}
          />
          {quote.discount > 0 && (
            <div className="flex items-center justify-between text-success">
              <dt>הנחת כמות ({Math.round(quote.discount * 100)}%-)</dt>
              <dd className="font-medium">−{formatILS(quote.savings)}</dd>
            </div>
          )}
          {managed && (
            <Row
              label={`ניהול + קישורים אישיים (${quote.employees})`}
              value={formatILS(quote.managementTotal)}
            />
          )}
          <div className="my-1 border-t border-outline" />
          <div className="flex items-center justify-between">
            <span className="font-medium">{isQuote ? "הערכה" : "סה״כ"}</span>
            <span className="text-2xl font-bold">{formatILS(quote.total)}</span>
          </div>
          <p className="text-xs text-zinc-500">
            {formatILS(quote.perMosaic)} לעובד · ערכה פיזית משלו · זמן הרכבה ~
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

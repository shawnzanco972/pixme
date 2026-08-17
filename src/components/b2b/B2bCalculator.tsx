"use client";
/**
 * B2B calculator + guest checkout. Controlled: size/employees/managed live in
 * the parent (B2bExperience) so the engine preview below stays in sync with the
 * chosen size. Price scales with quantity (volume discount); above
 * MAX_SELF_SERVE_SEATS it becomes a price-quote request.
 */
import { useState } from "react";

import {
  buildMinutes,
  computeB2bQuoteByPlates,
  MAX_SELF_SERVE_SEATS,
  VOLUME_TIERS,
} from "@/lib/b2b-pricing";
import { formatILS } from "@/lib/pricing";

/** What each mosaic size is actually good for — plain language, not specs. */
function sizeHintFor(plates: number): string {
  if (plates <= 1) return "דיוקן קלוז-אפ או חיית מחמד";
  if (plates <= 4) return "הבחירה הפופולרית למתנת עובדים";
  if (plates <= 9) return "מתאים גם לתמונה עם כמה אנשים";
  return "פסיפס קיר גדול";
}

/**
 * The next volume tier above the current headcount, for the "order N more and
 * save" nudge. VOLUME_TIERS is ordered highest-first, so scan from the end.
 */
function nextTierAbove(employees: number) {
  const ascending = [...VOLUME_TIERS].reverse();
  const t = ascending.find(([min, disc]) => min > employees && disc > 0);
  return t && t[0] <= MAX_SELF_SERVE_SEATS
    ? { min: t[0], discount: t[1] }
    : null;
}

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
  // Bidi-isolate the "38×38" pair so it doesn't reorder inside the RTL run.
  const sizeLabel = `⁦${platesX * CM_PER_PLATE}×${platesY * CM_PER_PLATE}⁩ ס״מ`;
  const sizeHint = sizeHintFor(quote.plates);
  const nextTier = nextTierAbove(employees);

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
        <h3 className="font-heading text-2xl font-bold">קיבלנו 🎉</h3>
        <p className="mt-2 leading-relaxed text-foreground/70">
          נחזור אליכם תוך יום עסקים אחד עם הצעת מחיר מותאמת ל-{quote.employees}{" "}
          עובדים, כולל תיאום תאריך יעד. אם זה דחוף — כתבו לנו ונקדים.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Controls */}
      <div className="card flex flex-col gap-7 p-6 sm:p-8">
        {/* Size — width × height of each employee's mosaic */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-heading font-bold">
              גודל הפסיפס לכל עובד
            </span>
            <span className="text-sm text-foreground/60">
              {sizeLabel} · {quote.plates}{" "}
              {quote.plates === 1 ? "לוח בסיס" : "לוחות בסיס"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {(
              [
                ["רוחב", platesX, setPlatesX] as const,
                ["גובה", platesY, setPlatesY] as const,
              ] as const
            ).map(([label, value, setter]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm text-foreground/60">{label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`הקטן ${label}`}
                    disabled={value <= MIN_PLATES_AXIS}
                    onClick={() => setter(Math.max(MIN_PLATES_AXIS, value - 1))}
                    className="h-10 w-10 rounded-xl border-2 border-outline bg-surface text-xl leading-none transition-colors hover:bg-surface-muted disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-heading text-lg font-black">
                    {value}
                  </span>
                  <button
                    type="button"
                    aria-label={`הגדל ${label}`}
                    disabled={value >= MAX_PLATES_AXIS}
                    onClick={() => setter(Math.min(MAX_PLATES_AXIS, value + 1))}
                    className="h-10 w-10 rounded-xl border-2 border-outline bg-surface text-xl leading-none transition-colors hover:bg-surface-muted disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-foreground/60">
            ⁦{quote.cols}×{quote.rows}⁩ לבנים · הרכבה של{" "}
            {minutes >= 60
              ? `כ-${Math.round(minutes / 60)} שעות`
              : `כ-${minutes} דקות`}{" "}
            · {sizeHint}
          </p>
        </div>

        {/* Employees */}
        <div className="flex flex-col gap-3 border-t border-outline pt-6">
          <label className="flex items-center justify-between">
            <span className="font-heading font-bold">כמה עובדים</span>
            <span className="font-heading text-2xl font-black">{employees}</span>
          </label>
          <input
            className="slider"
            type="range"
            min={1}
            max={120}
            value={Math.min(employees, 120)}
            onChange={(e) => setEmployees(Number(e.target.value))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={1}
              aria-label="מספר עובדים"
              className="input w-28"
              value={employees}
              onChange={(e) =>
                setEmployees(Math.max(1, Number(e.target.value) || 1))
              }
            />
            {nextTier ? (
              <button
                type="button"
                onClick={() => setEmployees(nextTier.min)}
                className="rounded-xl bg-success/10 px-3 py-2 text-sm font-medium text-success"
              >
                עוד {nextTier.min - employees} עובדים ותקבלו{" "}
                {Math.round(nextTier.discount * 100)}% הנחה
              </button>
            ) : (
              <span className="text-sm text-foreground/60">
                אתם בהנחה הגבוהה ביותר.
              </span>
            )}
          </div>
        </div>

        {/* Managed upsell */}
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-5 transition-colors ${
            managed ? "border-secondary bg-secondary/5" : "border-outline"
          }`}
        >
          <input
            type="checkbox"
            checked={managed}
            className="mt-1 h-5 w-5 shrink-0"
            onChange={(e) => setManaged(e.target.checked)}
          />
          <span className="flex flex-col gap-1.5">
            <span className="font-heading font-bold">
              קישור אישי לכל עובד + לוח בקרה ({formatILS(quote.managedFee)}{" "}
              לעובד)
            </span>
            <span className="text-sm leading-relaxed text-foreground/70">
              כל עובד מקבל קישור משלו, בוחר תמונה ורואה מיד איך היא תיראה בלבנים. אתם רואים
              במסך אחד מי העלה ומי לא, שולחים הזמנה חוזרת ומאשרים לפני ייצור.
            </span>
            <span className="text-sm leading-relaxed text-foreground/55">
              בלי זה: אתם מעלים את כל התמונות בעצמכם מלוח הבקרה — מתאים כשרוצים
              הפתעה מוחלטת.
            </span>
          </span>
        </label>

        {/* Buyer details */}
        <div className="grid gap-3 border-t border-outline pt-6">
          <p className="font-heading font-bold">
            {isQuote ? "לאן נשלח את ההצעה" : "פרטי החברה"}
          </p>
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
              className="input min-h-24 py-3"
              placeholder="תאריך יעד, דרישות מיוחדות, מיתוג — כל מה שכדאי שנדע (לא חובה)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="card flex h-fit flex-col gap-4 p-6 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between">
          <h3 className="font-heading text-lg font-black">הסיכום שלכם</h3>
          {quote.discount > 0 && (
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
              הנחת כמות {Math.round(quote.discount * 100)}%
            </span>
          )}
        </div>

        <div className="rounded-2xl bg-surface-muted p-4 text-center">
          <p className="font-heading text-4xl font-black">
            {formatILS(quote.perMosaic)}
          </p>
          <p className="mt-0.5 text-sm text-foreground/60">
            לערכה, לעובד
            {quote.discount > 0 && (
              <>
                {" · במקום "}
                <span className="line-through opacity-60">
                  {formatILS(quote.perMosaicBase)}
                </span>
              </>
            )}
          </p>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <Row
            label={`${quote.employees} × ערכה ⁦(${quote.cols}×${quote.rows})⁩`}
            value={formatILS(quote.perMosaicBase * quote.employees)}
          />
          {quote.discount > 0 && (
            <div className="flex items-center justify-between text-success">
              <dt>חיסכון בהנחת כמות</dt>
              <dd className="font-medium">−{formatILS(quote.savings)}</dd>
            </div>
          )}
          {managed && (
            <Row
              label={`ניהול וקישורים אישיים (${quote.employees})`}
              value={formatILS(quote.managementTotal)}
            />
          )}
          <div className="my-1 border-t border-outline" />
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold">
              {isQuote ? "הערכה" : "סה״כ"}
            </span>
            <span className="font-heading text-2xl font-black">
              {formatILS(quote.total)}
            </span>
          </div>
        </dl>

        {isQuote ? (
          <>
            <button
              type="button"
              onClick={() => void handleQuote()}
              disabled={submitting}
              className="btn btn-primary min-h-[54px]"
            >
              {submitting ? "שולח…" : "קבלת הצעת מחיר"}
            </button>
            <p className="text-center text-xs leading-relaxed text-foreground/60">
              מעל {MAX_SELF_SERVE_SEATS} עובדים אנחנו בונים הצעה אישית — נחזור
              אליכם תוך יום עסקים.
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleBuy()}
              disabled={submitting}
              className="btn btn-primary min-h-[54px] text-base"
            >
              {submitting ? "מעבד…" : `לתשלום — ${formatILS(quote.total)}`}
            </button>
            <p className="text-center text-xs leading-relaxed text-foreground/60">
              מיד אחרי התשלום מקבלים קישור פרטי לניהול הפרויקט. חשבונית מס נשלחת
              במייל.
            </p>
          </>
        )}
        {error && <p className="text-sm text-primary">{error}</p>}

        <ul className="flex flex-col gap-1.5 border-t border-outline pt-4 text-xs text-foreground/60">
          {[
            "ערכה פיזית מלאה לכל עובד",
            "חוברת הוראות אישית בגודל 1:1",
            "בלי דמי הקמה ובלי מינימום הזמנה",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="mi text-[15px] text-success">check</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-foreground/60">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

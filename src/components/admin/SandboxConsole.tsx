"use client";
/**
 * Sandbox console — drives /api/admin/test-checkout to exercise the full B2C and
 * B2B purchase flows WITHOUT a real iCount transaction. Each run creates an
 * is_test order, provisions it exactly as the live webhook would, and returns
 * the live links to follow (order page, owner dashboard, employee seat).
 */
import { useState } from "react";

import { SIZE_PRESETS } from "@/lib/pricing";

interface LinkResult {
  ok: true;
  track: "b2c" | "b2b";
  size: string;
  totalPrice?: number;
  amount?: number;
  employees?: number;
  links: Record<string, string | null>;
}

const LINK_LABELS: Record<string, string> = {
  order: "עמוד ההזמנה (לקוח)",
  admin: "ניהול ההזמנה",
  owner: "לוח מנהל הפרויקט (בעל העסק)",
  seat: "קישור העלאה לעובד",
};

function ResultLinks({ result }: { result: LinkResult }) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-surface-muted p-3 text-sm">
      <p className="font-semibold text-success">
        ✓ נוצרה הזמנת בדיקה ({result.size}
        {result.track === "b2c" && result.totalPrice != null
          ? ` · ${result.totalPrice} ₪`
          : ""}
        {result.track === "b2b" && result.amount != null
          ? ` · ${result.amount} ₪ · ${result.employees} עובדים`
          : ""}
        )
      </p>
      <ul className="flex flex-col gap-1">
        {Object.entries(result.links).map(([key, href]) =>
          href ? (
            <li key={key}>
              <span className="text-zinc-500">{LINK_LABELS[key] ?? key}: </span>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary underline"
              >
                {href} ↗
              </a>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

function useTestCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResult | null>(null);

  async function run(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test checkout failed");
      setResult(data as LinkResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, result, run };
}

function PresetSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-outline px-2 py-1 bg-surface text-sm"
    >
      {SIZE_PRESETS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.labelHe} ({p.id})
        </option>
      ))}
    </select>
  );
}

function B2cSandbox() {
  const { loading, error, result, run } = useTestCheckout();
  const [name, setName] = useState("בדיקה — לקוח");
  const [email, setEmail] = useState("test@pixipic.test");
  const [fulfillment, setFulfillment] = useState<"digital" | "physical">(
    "physical",
  );
  const [preset, setPreset] = useState("2x2");

  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-semibold">זרימה רגילה (B2C)</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          שם לקוח
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          אימייל
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          אספקה
          <select
            value={fulfillment}
            onChange={(e) =>
              setFulfillment(e.target.value as "digital" | "physical")
            }
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          >
            <option value="physical">פיזי</option>
            <option value="digital">דיגיטלי</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          גודל
          <PresetSelect value={preset} onChange={setPreset} />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            void run({
              track: "b2c",
              customer_name: name,
              contact_email: email,
              fulfillment_type: fulfillment,
              preset_id: preset,
            })
          }
          className="btn btn-primary h-9 min-h-9 px-4 text-sm"
        >
          {loading ? "יוצר…" : "צור הזמנת בדיקה"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <ResultLinks result={result} />}
    </section>
  );
}

function B2bSandbox() {
  const { loading, error, result, run } = useTestCheckout();
  const [company, setCompany] = useState("בדיקה — חברה");
  const [email, setEmail] = useState("owner@pixipic.test");
  const [seatName, setSeatName] = useState("עובד לדוגמה");
  const [preset, setPreset] = useState("2x2");
  const [employees, setEmployees] = useState("3");
  const [managed, setManaged] = useState(false);

  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-semibold">זרימה עסקית (B2B)</h2>
      <p className="text-xs text-zinc-500">
        יוצר פרויקט ששולם, יוצר סביבת עבודה, ומוסיף מושב עובד אחד — כך שניתן
        לבדוק גם את לוח מנהל הפרויקט וגם את קישור ההעלאה של העובד.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          שם חברה
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          אימייל בעלים
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          שם עובד (מושב)
          <input
            value={seatName}
            onChange={(e) => setSeatName(e.target.value)}
            className="rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          גודל
          <PresetSelect value={preset} onChange={setPreset} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          עובדים
          <input
            type="number"
            min={1}
            value={employees}
            onChange={(e) => setEmployees(e.target.value)}
            className="w-20 rounded border border-outline px-2 py-1 bg-surface text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={managed}
            onChange={(e) => setManaged(e.target.checked)}
          />
          שירות מנוהל
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            void run({
              track: "b2b",
              company_name: company,
              contact_email: email,
              seat_name: seatName,
              preset_id: preset,
              employees: Number(employees),
              managed,
            })
          }
          className="btn btn-primary h-9 min-h-9 px-4 text-sm"
        >
          {loading ? "יוצר…" : "צור פרויקט בדיקה"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <ResultLinks result={result} />}
    </section>
  );
}

function ResetTestData() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reset() {
    if (!confirm("למחוק את כל נתוני הבדיקה (הזמנות, פרויקטים, מושבים)?")) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/test-reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setMsg(`נמחקו ${data.deleted.b2c} הזמנות פרטיות ו-${data.deleted.b2b} פרויקטים.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={loading}
        onClick={() => void reset()}
        className="btn btn-ghost h-9 min-h-9 px-4 text-sm text-red-600"
      >
        {loading ? "מוחק…" : "מחק את כל נתוני הבדיקה"}
      </button>
      {msg && <span className="text-sm text-zinc-500">{msg}</span>}
    </div>
  );
}

export function SandboxConsole() {
  return (
    <div className="flex flex-col gap-6">
      <B2cSandbox />
      <B2bSandbox />
      <ResetTestData />
    </div>
  );
}

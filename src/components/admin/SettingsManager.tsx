"use client";
/**
 * Editable DB-backed settings (settings table). Values are JSON; here we expose
 * the text-valued PDF copy keys so the operator can tune output without a
 * deploy. Saves on blur via the browser client (admin RLS).
 */
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const LABELS: Record<string, string> = {
  pdf_cover_title: "כותרת שער ה־PDF",
  pdf_footer: "כותרת תחתונה ב־PDF",
};

export function SettingsManager() {
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("settings").select("key, value");
      if (!cancelled) {
        setRows(
          (data ?? []).map((r) => ({
            key: r.key,
            // Values are JSON; the copy keys are JSON strings.
            value: typeof r.value === "string" ? r.value : JSON.stringify(r.value),
          })),
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(key: string, value: string) {
    const sb = createClient();
    await sb.from("settings").update({ value }).eq("key", key);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
  }

  if (loading) return <p className="text-sm text-zinc-400">טוען…</p>;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <label key={r.key} className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {LABELS[r.key] ?? r.key}
            {savedKey === r.key && (
              <span className="ms-2 text-xs text-green-600">נשמר</span>
            )}
          </span>
          <input
            defaultValue={r.value}
            onBlur={(e) => {
              if (e.target.value !== r.value) void save(r.key, e.target.value);
            }}
            className="w-full max-w-md rounded border border-outline bg-surface px-2 py-1 text-sm"
          />
        </label>
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-zinc-400">אין הגדרות.</p>
      )}
    </div>
  );
}

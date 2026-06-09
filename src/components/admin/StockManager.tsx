"use client";
/**
 * Admin inventory manager (color catalog) — availability + on-hand weight.
 *
 * Effective in-stock = DB override (brick_stock.in_stock) if a row exists, else
 * the color's `core` default. on_hand_grams is what's physically in stock (by
 * weight); piece counts are derived (grams ÷ GRAMS_PER_STUD). Entering weight
 * for a color automatically marks it in-stock.
 */
import { useEffect, useState } from "react";

import { CATALOG, isCore } from "@/lib/brick-engine/palette";
import { formatWeight, GRAMS_PER_STUD } from "@/lib/packing";
import { createClient } from "@/lib/supabase/client";

interface Row {
  in_stock: boolean;
  on_hand_grams: number;
  reorder_point_grams: number;
}

/** Grams ↔ pieces (a 1×1 plate ≈ GRAMS_PER_STUD). */
function gramsToPieces(grams: number): number {
  return Math.round(grams / GRAMS_PER_STUD);
}
function fmtInt(n: number): string {
  return n.toLocaleString("he-IL");
}

/**
 * Estimated opening order per CORE color (~300k bricks total, NOT split evenly):
 * big bags of neutrals/structure, medium of skin/earth tones, smaller of
 * accents. A starting point the operator then tunes.
 */
function estimatedGrams(name: string): number {
  const n = name.toLowerCase();
  if (/white|black|gray|grey/.test(n)) return 4500; // ~28k bricks each
  if (/tan|nougat|brown/.test(n)) return 2800; // skin/earth, ~17.5k each
  return 1400; // accents, ~8.75k each
}

export function StockManager() {
  const [rows, setRows] = useState<Map<number, Row>>(new Map());
  const [drafts, setDrafts] = useState<Map<number, string>>(new Map());
  const [thresholdDrafts, setThresholdDrafts] = useState<Map<number, string>>(
    new Map(),
  );
  const [savingId, setSavingId] = useState<number | null>(null);

  // Quick add-grams toolbar
  const [toolColor, setToolColor] = useState<number>(CATALOG[0]?.id ?? 0);
  const [toolGrams, setToolGrams] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("brick_stock")
        .select("id, in_stock, on_hand_grams, reorder_point_grams");
      if (!cancelled) {
        setRows(
          new Map(
            (data ?? []).map((r) => [
              r.id,
              {
                in_stock: r.in_stock,
                on_hand_grams: Number(r.on_hand_grams),
                reorder_point_grams: Number(r.reorder_point_grams),
              },
            ]),
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inStockOf = (id: number) => rows.get(id)?.in_stock ?? isCore(id);
  const onHandOf = (id: number) => rows.get(id)?.on_hand_grams ?? 0;
  const thresholdOf = (id: number) => rows.get(id)?.reorder_point_grams ?? 0;

  /** Persist a patch. Entering positive weight auto-marks the color in-stock. */
  async function save(id: number, patch: Partial<Row>) {
    setSavingId(id);
    const autoInStock =
      patch.in_stock ??
      (patch.on_hand_grams != null && patch.on_hand_grams > 0
        ? true
        : inStockOf(id));
    const next: Row = {
      in_stock: autoInStock,
      on_hand_grams: patch.on_hand_grams ?? onHandOf(id),
      reorder_point_grams: patch.reorder_point_grams ?? thresholdOf(id),
    };
    const sb = createClient();
    const { error } = await sb
      .from("brick_stock")
      .upsert({ id, ...next }, { onConflict: "id" });
    setSavingId(null);
    if (!error) setRows((prev) => new Map(prev).set(id, next));
    return !error;
  }

  function flash(msg: string) {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 4000);
  }

  async function addViaToolbar() {
    const add = Number(toolGrams);
    if (!Number.isFinite(add) || add === 0) return;
    const id = toolColor;
    const newTotal = Math.max(0, Math.round((onHandOf(id) + add) * 10) / 10);
    const ok = await save(id, { on_hand_grams: newTotal });
    const name = CATALOG.find((c) => c.id === id)?.name ?? `#${id}`;
    if (ok) {
      setToolGrams("");
      flash(
        `${add > 0 ? "נוספו" : "הופחתו"} ${fmtInt(Math.abs(add))} ג׳ ל-${name} · ` +
          `סה״כ ${formatWeight(newTotal)} (~${fmtInt(gramsToPieces(newTotal))} לבנים)`,
      );
    } else {
      flash("שגיאה בשמירה.");
    }
  }

  async function fillEstimated() {
    if (
      !window.confirm(
        "למלא את כל צבעי הליבה בהערכת הזמנה ראשונית? פעולה זו תכתוב על הערכים הקיימים בצבעי הליבה.",
      )
    )
      return;
    setFilling(true);
    const coreColors = CATALOG.filter((c) => isCore(c.id));
    const payload = coreColors.map((c) => ({
      id: c.id,
      in_stock: true,
      on_hand_grams: estimatedGrams(c.name),
      reorder_point_grams: thresholdOf(c.id),
    }));
    const sb = createClient();
    const { error } = await sb
      .from("brick_stock")
      .upsert(payload, { onConflict: "id" });
    setFilling(false);
    if (!error) {
      setRows((prev) => {
        const next = new Map(prev);
        for (const p of payload)
          next.set(p.id, {
            in_stock: p.in_stock,
            on_hand_grams: p.on_hand_grams,
            reorder_point_grams: p.reorder_point_grams,
          });
        return next;
      });
      const totalPieces = payload.reduce(
        (s, p) => s + gramsToPieces(p.on_hand_grams),
        0,
      );
      flash(
        `מולאו ${payload.length} צבעי ליבה · ~${fmtInt(totalPieces)} לבנים סה״כ. עדכנו לפי הצורך.`,
      );
    } else {
      flash("שגיאה במילוי.");
    }
  }

  const inStockCount = CATALOG.filter((c) => inStockOf(c.id)).length;
  const totalGrams = CATALOG.reduce((s, c) => s + onHandOf(c.id), 0);
  const totalPieces = gramsToPieces(totalGrams);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold">
          מלאי צבעים ({inStockCount}/{CATALOG.length} זמינים ·{" "}
          {formatWeight(totalGrams)} · ~{fmtInt(totalPieces)} לבנים)
        </h2>
        <button
          type="button"
          onClick={() => void fillEstimated()}
          disabled={filling}
          className="btn btn-ghost h-9 min-h-9 px-4 text-sm"
        >
          {filling ? "ממלא…" : "מילוי הערכת הזמנה ראשונית"}
        </button>
      </div>

      {/* Quick add-grams toolbar — less error-prone than the inline cells, with
          explicit feedback. */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-outline bg-surface-muted/50 p-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          צבע
          <select
            value={toolColor}
            onChange={(e) => setToolColor(Number(e.target.value))}
            className="rounded border border-outline bg-surface px-2 py-1.5 text-sm"
          >
            {CATALOG.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          גרם להוספה
          <input
            type="number"
            inputMode="decimal"
            value={toolGrams}
            placeholder="לדוגמה 500"
            onChange={(e) => setToolGrams(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addViaToolbar();
            }}
            className="w-32 rounded border border-outline bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void addViaToolbar()}
          disabled={!toolGrams || savingId !== null}
          className="btn btn-primary h-9 min-h-9 px-4 text-sm"
        >
          הוספה למלאי
        </button>
        <span className="text-xs text-zinc-500">
          נוכחי: {formatWeight(onHandOf(toolColor))} (~
          {fmtInt(gramsToPieces(onHandOf(toolColor)))} לבנים)
        </span>
        {feedback && (
          <span className="text-sm font-medium text-green-700">{feedback}</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline">
        <table className="w-full text-start text-sm">
          <thead className="bg-surface-muted text-zinc-600">
            <tr>
              <th className="p-2 text-start">#</th>
              <th className="p-2 text-start">צבע</th>
              <th className="p-2 text-start">סוג</th>
              <th className="p-2 text-start">זמין</th>
              <th className="p-2 text-start">במלאי (גרם)</th>
              <th className="p-2 text-start">לבנים (משוער)</th>
              <th className="p-2 text-start">סף התראה (גרם)</th>
            </tr>
          </thead>
          <tbody>
            {CATALOG.map((c) => {
              const draft = drafts.get(c.id);
              const value = draft ?? String(onHandOf(c.id));
              const tDraft = thresholdDrafts.get(c.id);
              const tValue = tDraft ?? String(thresholdOf(c.id));
              const below =
                thresholdOf(c.id) > 0 && onHandOf(c.id) < thresholdOf(c.id);
              return (
                <tr
                  key={c.id}
                  className={`border-t border-outline ${
                    below ? "bg-red-50" : ""
                  }`}
                >
                  <td className="p-2 text-xs tabular-nums text-zinc-400">
                    {c.id}
                  </td>
                  <td className="p-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded border border-black/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-zinc-500">
                    {isCore(c.id) ? "ליבה" : "בוסט"}
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      disabled={savingId === c.id}
                      onClick={() => save(c.id, { in_stock: !inStockOf(c.id) })}
                      className={`rounded-full px-3 py-1 text-xs ${
                        inStockOf(c.id)
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      }`}
                    >
                      {inStockOf(c.id) ? "זמין" : "אזל"}
                    </button>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      className="w-24 rounded border border-outline px-2 py-1 bg-surface"
                      value={value}
                      onChange={(e) =>
                        setDrafts((d) => new Map(d).set(c.id, e.target.value))
                      }
                      onBlur={() => {
                        if (draft === undefined) return;
                        const n = Number(draft);
                        setDrafts((d) => {
                          const nd = new Map(d);
                          nd.delete(c.id);
                          return nd;
                        });
                        if (!Number.isNaN(n) && n !== onHandOf(c.id)) {
                          void save(c.id, { on_hand_grams: n });
                        }
                      }}
                    />
                  </td>
                  <td className="p-2 tabular-nums text-zinc-600">
                    {fmtInt(gramsToPieces(onHandOf(c.id)))}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      className="w-24 rounded border border-outline px-2 py-1 bg-surface"
                      value={tValue}
                      onChange={(e) =>
                        setThresholdDrafts((d) =>
                          new Map(d).set(c.id, e.target.value),
                        )
                      }
                      onBlur={() => {
                        if (tDraft === undefined) return;
                        const n = Number(tDraft);
                        setThresholdDrafts((d) => {
                          const nd = new Map(d);
                          nd.delete(c.id);
                          return nd;
                        });
                        if (!Number.isNaN(n) && n !== thresholdOf(c.id)) {
                          void save(c.id, { reorder_point_grams: n });
                        }
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        הזנת משקל מסמנת את הצבע אוטומטית כ&quot;זמין&quot;. מספר הלבנים מחושב לפי{" "}
        {GRAMS_PER_STUD} ג׳ ללבנה. הגדירו &quot;סף התראה&quot; כדי לקבל התראת מלאי
        נמוך (שורה אדומה) בלשונית הסקירה.
      </p>
    </section>
  );
}

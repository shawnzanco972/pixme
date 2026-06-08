"use client";
/**
 * Wraps the B2B calculator and the live engine preview so they share state: the
 * size chosen in the calculator drives the preview's resolution. Rendered as
 * two sections (calculator, then "see how it works" preview) on the /b2b page.
 */
import { useState } from "react";

import { B2bCalculator } from "@/components/b2b/B2bCalculator";
import { B2bEnginePreview } from "@/components/b2b/B2bEnginePreview";
import { MANAGED_FEE_MIN, MANAGED_FEE_MAX } from "@/lib/b2b-pricing";
import { formatILS, presetById, presetStuds } from "@/lib/pricing";

export function B2bExperience() {
  const [presetId, setPresetId] = useState("2x2");
  const [employees, setEmployees] = useState(15);
  const [managed, setManaged] = useState(true);

  const preset = presetById(presetId)!;
  const { cols, rows } = presetStuds(preset);

  return (
    <>
      <section id="calculator" className="mx-auto w-full max-w-5xl scroll-mt-6 px-6 py-12">
        <h2 className="text-center font-heading text-2xl font-bold">מחשבון מחיר</h2>
        <p className="mt-2 text-center text-zinc-600">
          ככל שמזמינים יותר — המחיר לעובד יורד. הניהול האישי לכל עובד עולה{" "}
          {formatILS(MANAGED_FEE_MIN)}–{formatILS(MANAGED_FEE_MAX)} לפי הכמות.
        </p>
        <div className="mt-8">
          <B2bCalculator
            presetId={presetId}
            setPresetId={setPresetId}
            employees={employees}
            setEmployees={setEmployees}
            managed={managed}
            setManaged={setManaged}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <h2 className="text-center font-heading text-2xl font-bold">
          ככה זה ייראה
        </h2>
        <p className="mt-2 text-center text-zinc-600">
          העלו תמונה או בחרו עיצוב מוכן וראו את מנוע הלבנים בפעולה — בגודל שבחרתם
          למעלה ({cols}×{rows}).
        </p>
        <div className="mt-8">
          <B2bEnginePreview cols={cols} rows={rows} />
        </div>
      </section>
    </>
  );
}

"use client";
/**
 * Wraps the B2B calculator and the live engine preview so they share state: the
 * size chosen in the calculator drives the preview's resolution. Rendered as
 * two sections (calculator, then "see how it works" preview) on the /b2b page.
 */
import { useState } from "react";

import { B2bCalculator } from "@/components/b2b/B2bCalculator";
import {
  B2bEnginePreview,
  type PreviewSample,
} from "@/components/b2b/B2bEnginePreview";
import { MANAGED_FEE_MIN } from "@/lib/b2b-pricing";
import { formatILS, presetStuds } from "@/lib/pricing";

export function B2bExperience({ samples = [] }: { samples?: PreviewSample[] }) {
  const [platesX, setPlatesX] = useState(2);
  const [platesY, setPlatesY] = useState(2);
  const [employees, setEmployees] = useState(25);
  const [managed, setManaged] = useState(true);

  const { cols, rows } = presetStuds({ platesX, platesY });

  return (
    <>
      <section
        id="calculator"
        className="mx-auto w-full max-w-6xl scroll-mt-6 px-6 pb-24"
      >
        <div className="mb-10 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(28px,4vw,42px)]">
            כמה זה עולה לצוות שלכם
          </h2>
          <p className="max-w-[36em] text-lg leading-7 text-foreground/60">
            הזיזו את הכמות והגודל — המחיר הסופי מתעדכן כאן, כולל הנחת כמות. ניהול
            אישי לכל עובד נוסף מ-{formatILS(MANAGED_FEE_MIN)} לעובד, ואפשר גם
            בלעדיו.
          </p>
        </div>
        <B2bCalculator
          platesX={platesX}
          setPlatesX={setPlatesX}
          platesY={platesY}
          setPlatesY={setPlatesY}
          employees={employees}
          setEmployees={setEmployees}
          managed={managed}
          setManaged={setManaged}
        />
      </section>

      <section id="preview" className="mx-auto w-full max-w-6xl scroll-mt-6 px-6 pb-24">
        <div className="mb-10 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(28px,4vw,42px)]">
            תנסו על תמונה שלכם, עכשיו
          </h2>
          <p className="max-w-[36em] text-lg leading-7 text-foreground/60">
            זה בדיוק מה שהעובדים שלכם יראו כשיפתחו את הקישור. גררו תמונה וראו
            אותה הופכת ל-⁦{cols}×{rows}⁩ לבנים, בגודל שבחרתם למעלה. התמונה לא
            עוזבת את הדפדפן ולא נשמרת אצלנו.
          </p>
        </div>
        <B2bEnginePreview
          cols={cols}
          rows={rows}
          platesX={platesX}
          platesY={platesY}
          setPlates={(x, y) => {
            setPlatesX(x);
            setPlatesY(y);
          }}
          samples={samples}
        />
      </section>
    </>
  );
}

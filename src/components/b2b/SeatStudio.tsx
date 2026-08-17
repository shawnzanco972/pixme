"use client";
/**
 * Employee seat design — the FULL customer studio, scoped to the company's
 * purchased plate budget. The worker can reframe, recolor, and tune adjustments
 * just like a retail customer (they just can't exceed the paid size, and don't
 * pay). On proceed we upload the photo and record the submission via
 * /api/b2b/submit, which links it to the roster seat.
 *
 * Re-editable: an employee can resubmit (replacing their design) until the
 * project owner approves it. Once approved the seat page locks instead of
 * rendering this.
 */
import { useState } from "react";

import {
  Studio,
  type DesignPayload,
  type StudioLibraryItem,
} from "@/components/b2c/Studio";
import { createClient } from "@/lib/supabase/client";
import { uploadToSignedUrl } from "@/lib/supabase/storage";

export function SeatStudio({
  inviteToken,
  plateBudget,
  initialPlatesX,
  initialPlatesY,
  alreadySubmitted = false,
  rejected = false,
  library,
}: {
  inviteToken: string;
  plateBudget: number;
  initialPlatesX: number;
  initialPlatesY: number;
  alreadySubmitted?: boolean;
  rejected?: boolean;
  /** Ready-made designs, for an employee with no photo at hand. */
  library?: StudioLibraryItem[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set by the "save for later" button just before the studio hands us the
  // design, so one submit path serves both actions.
  const [asDraft, setAsDraft] = useState(false);

  async function handleProceed(design: DesignPayload, draft = false) {
    setError(null);
    if (!design.file) {
      setError("נא להעלות תמונה.");
      return;
    }
    setSubmitting(true);
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: design.file.type }),
      });
      if (!signRes.ok) throw new Error("שגיאה בהעלאת התמונה.");
      const { path, token } = (await signRes.json()) as {
        path: string;
        token: string;
      };
      await uploadToSignedUrl(createClient(), path, token, design.file);

      const res = await fetch("/api/b2b/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken,
          imagePath: path,
          pixelMap: design.pixelMap,
          draft,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "לא ניתן לשלוח — ייתכן שהפרויקט אינו פעיל.");
      }
      if (draft) {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      } else setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h2 className="font-heading text-2xl font-bold">התקבל! 🎉</h2>
        <p className="mt-2 text-zinc-600">
          העיצוב שלך נשלח. אפשר לחזור ולערוך אותו עד שמנהל הפרויקט יאשר.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="btn btn-ghost mt-4"
        >
          עריכה נוספת
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(alreadySubmitted || rejected) && (
        <div
          className={`mx-auto max-w-2xl rounded-xl p-4 text-center text-sm ${
            rejected
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {rejected
            ? "מנהל הפרויקט ביקש עיצוב אחר. אנא עדכנו ושלחו שוב."
            : "כבר שלחתם עיצוב — אפשר לעדכן אותו כאן עד לאישור מנהל הפרויקט."}
        </div>
      )}
      {saved && (
        <div className="mx-auto max-w-2xl rounded-xl bg-success/10 p-4 text-center text-sm text-success">
          נשמר! אפשר לסגור ולחזור לאותו קישור מתי שתרצו. מנהל הפרויקט עוד לא
          רואה את זה — הוא יראה רק כשתשלחו.
        </div>
      )}
      <Studio
        embedded
        hidePricing
        plateBudget={plateBudget}
        initialPlatesX={initialPlatesX}
        initialPlatesY={initialPlatesY}
        library={library}
        proceedLabel={
          submitting && !asDraft ? "שולח…" : "שליחה למנהל הפרויקט ←"
        }
        onProceed={(d) => {
          setAsDraft(false);
          void handleProceed(d, false);
        }}
        secondaryLabel={submitting && asDraft ? "שומר…" : "שמירה להמשך"}
        onSecondary={(d) => {
          setAsDraft(true);
          void handleProceed(d, true);
        }}
      />
      {error && (
        <p className="mx-auto max-w-2xl text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

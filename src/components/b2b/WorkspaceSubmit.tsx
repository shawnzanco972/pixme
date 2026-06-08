"use client";
/**
 * Employee submission portal (no account). Validates against the active
 * workspace via RLS: the anon insert only succeeds if the workspace is active,
 * not expired, and has a free slot (the DB trigger then increments slots_used).
 */
import { useState } from "react";

import { useBrickPreview } from "@/lib/brick-engine/useBrickPreview";
import { createClient } from "@/lib/supabase/client";
import { uploadToSignedUrl } from "@/lib/supabase/storage";

const SUBMISSION_SIZE = 48;

export function WorkspaceSubmit({ workspaceId }: { workspaceId: string }) {
  const { canvasRef, pixelMap, working, process } = useBrickPreview();
  const [file, setFile] = useState<File | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(f: File) {
    setError(null);
    setFile(f);
    try {
      await process(f, SUBMISSION_SIZE, {
        preprocess: { contrast: 1.2, saturation: 1.1 },
      });
    } catch {
      setError("שגיאה בעיבוד התמונה.");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!file || !pixelMap) return setError("נא להעלות תמונה.");
    if (!employeeName.trim()) return setError("נא למלא שם.");

    setSubmitting(true);
    try {
      // Upload the photo via a signed URL.
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!signRes.ok) throw new Error("שגיאה בהעלאת התמונה.");
      const { path, token } = (await signRes.json()) as {
        path: string;
        token: string;
      };
      const supabase = createClient();
      await uploadToSignedUrl(supabase, path, token, file);

      // Insert the submission as anon — RLS enforces workspace validity + slot.
      const { error: insErr } = await supabase
        .from("employee_submissions")
        .insert({
          workspace_id: workspaceId,
          employee_name: employeeName,
          image_url: path,
          pixel_map: pixelMap,
        });
      if (insErr) {
        throw new Error(
          "לא ניתן לשלוח — ייתכן שסביבת העבודה מלאה או שאינה פעילה.",
        );
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בלתי צפויה.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-900 dark:bg-green-950">
        <h2 className="font-heading text-2xl font-bold">התקבל! 🎉</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-300">
          התמונה שלך נשלחה בהצלחה.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <label className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
        {/* Canvas always mounted so its ref is stable for the first paint. */}
        <canvas
          ref={canvasRef}
          className={`h-full w-full object-contain ${pixelMap ? "" : "hidden"}`}
        />
        {!pixelMap && (
          <span className="px-6 text-center text-zinc-500">
            לחצו כדי להעלות תמונה
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
          }}
        />
      </label>
      {working && <p className="text-sm text-zinc-500">מעבד…</p>}

      <input
        className="input"
        placeholder="השם שלך"
        value={employeeName}
        onChange={(e) => setEmployeeName(e.target.value)}
      />

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting || !pixelMap}
        className="btn btn-primary"
      >
        {submitting ? "שולח…" : "שליחה"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

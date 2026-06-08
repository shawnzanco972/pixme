"use client";
/**
 * Employee seat submission. The size is fixed by the project's bundle (passed
 * as cols/rows) — the employee only uploads a photo and confirms. The insert
 * goes through /api/b2b/submit (service-role, invite_token-gated), which links
 * the submission to the roster seat so the owner dashboard updates.
 */
import { useState } from "react";

import { useBrickPreview } from "@/lib/brick-engine/useBrickPreview";
import { createClient } from "@/lib/supabase/client";
import { uploadToSignedUrl } from "@/lib/supabase/storage";

export function SeatSubmit({
  inviteToken,
  cols,
  rows,
}: {
  inviteToken: string;
  cols: number;
  rows: number;
}) {
  const { canvasRef, pixelMap, working, process } = useBrickPreview();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(f: File) {
    setError(null);
    setFile(f);
    try {
      await process(
        f,
        cols,
        { preprocess: { contrast: 1.2, saturation: 1.1, faceAware: true } },
        rows,
      );
    } catch {
      setError("שגיאה בעיבוד התמונה.");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!file || !pixelMap) return setError("נא להעלות תמונה.");

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

      // Record the submission server-side (links to the roster seat).
      const res = await fetch("/api/b2b/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken,
          imagePath: path,
          pixelMap,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "לא ניתן לשלוח — ייתכן שהפרויקט אינו פעיל.");
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
      <div className="card p-8 text-center">
        <h2 className="font-heading text-2xl font-bold">התקבל! 🎉</h2>
        <p className="mt-2 text-zinc-600">התמונה שלך נשלחה בהצלחה.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <label className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline bg-surface-muted">
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

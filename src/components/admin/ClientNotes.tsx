"use client";
/**
 * Inline CRM notes editor for one client. Saves to /api/admin/client-notes
 * (debounced on blur) so the operator can jot context without leaving the list.
 */
import { useState } from "react";

export function ClientNotes({
  email,
  initial,
}: {
  email: string;
  initial: string | null;
}) {
  const [notes, setNotes] = useState(initial ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");

  async function save() {
    if (notes === (initial ?? "")) return;
    setSaved("saving");
    try {
      await fetch("/api/admin/client-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, notes }),
      });
      setSaved("done");
      setTimeout(() => setSaved("idle"), 1500);
    } catch {
      setSaved("idle");
    }
  }

  return (
    <div className="flex items-start gap-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => void save()}
        rows={1}
        placeholder="הערה…"
        className="min-h-9 w-full rounded border border-outline bg-surface px-2 py-1 text-sm"
      />
      {saved === "saving" && <span className="text-xs text-zinc-400">שומר…</span>}
      {saved === "done" && <span className="text-xs text-green-600">נשמר</span>}
    </div>
  );
}

"use client";
/**
 * Copy a workspace share link to the clipboard (B2B employees use it to submit
 * without an account). Builds an absolute URL from the current origin.
 */
import { useState } from "react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url =
      typeof window !== "undefined" ? window.location.origin + path : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: show a prompt the user can copy from.
      window.prompt("העתיקו את הקישור:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-outline px-3 py-1 text-xs transition-colors hover:bg-surface-muted"
    >
      {copied ? "הועתק ✓" : "העתק קישור"}
    </button>
  );
}

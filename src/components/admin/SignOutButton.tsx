"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/admin/login");
  }
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="btn btn-ghost h-10 min-h-10 px-4 text-sm"
    >
      התנתקות
    </button>
  );
}

"use client";
/**
 * Admin login (Supabase Auth, email + password). Admin users are created
 * manually in the Supabase dashboard — there is no public sign-up.
 */
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      window.location.assign("/admin");
    } catch {
      setError("התחברות נכשלה. בדקו את הפרטים ונסו שוב.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold">כניסת מנהל</h1>
      <input
        type="email"
        dir="ltr"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-start dark:border-zinc-700 dark:bg-zinc-900"
        placeholder="אימייל"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        dir="ltr"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-start dark:border-zinc-700 dark:bg-zinc-900"
        placeholder="סיסמה"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
      />
      <button
        type="button"
        onClick={() => void handleLogin()}
        disabled={loading}
        className="rounded-full bg-black px-8 py-3 text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {loading ? "מתחבר…" : "כניסה"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

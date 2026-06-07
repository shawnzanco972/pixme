/**
 * Server-side Supabase clients.
 *
 * Two distinct clients with very different trust levels:
 *
 *  1. createClient()  — cookie-bound, anon key, RLS-enforced. Use in Server
 *     Components, Server Actions, and Route Handlers to read the current
 *     (admin) session and act AS that user. Honors Row-Level Security.
 *
 *  2. createAdminClient() — service-role key, BYPASSES RLS. Use ONLY in trusted
 *     server code (e.g. the iCount webhook) to provision orders/workspaces.
 *     Never import this into a Client Component.
 *
 * This module is server-only; importing it from client code will throw.
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./env";
import type { Database } from "./types";

/**
 * Cookie-bound server client (anon key, RLS-enforced).
 * Reads/writes the Supabase auth session via Next.js cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` was called from a Server Component, where cookies are
          // read-only. Safe to ignore when middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Service-role client (BYPASSES RLS). Trusted server contexts only.
 * No session persistence — it is not tied to any user.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    supabaseUrl(),
    supabaseServiceRoleKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

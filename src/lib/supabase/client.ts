/**
 * Browser Supabase client (anon key).
 *
 * Use this from Client Components. It carries only the public anon key, so all
 * access is governed by Row-Level Security. Guest checkout (B2C inserts) and
 * reading active B2B workspaces work through this client.
 */
import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}

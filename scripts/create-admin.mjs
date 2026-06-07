/**
 * Create (or update) a Pixme admin user.
 *
 * Admins are the only Supabase Auth users — there is no public sign-up, so this
 * is how you make a login for the /admin dashboard.
 *
 * Usage (PowerShell / terminal, from the project folder):
 *   npm run create-admin -- you@email.com "YourStrongPassword"
 *
 * It reads your Supabase keys from .env.local automatically.
 */
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> "<password>"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Make sure .env.local is filled in (this script loads it via --env-file).",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  // If the user already exists, update their password instead.
  if (/already.*registered|exists/i.test(error.message)) {
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === email);
    if (existing) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password, email_confirm: true },
      );
      if (updErr) {
        console.error("Failed to update existing user:", updErr.message);
        process.exit(1);
      }
      console.log(`✓ Updated password for existing admin: ${email}`);
      process.exit(0);
    }
  }
  console.error("Failed to create admin:", error.message);
  process.exit(1);
}

console.log(`✓ Admin user created: ${data.user.email}`);
console.log("Now sign in at /admin/login");

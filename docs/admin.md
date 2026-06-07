# Admin Dashboard — Setup & Testing

The admin panel is at **`/admin`** (e.g. `http://localhost:3000/admin` locally,
or `https://YOUR-SITE/admin` on Vercel). It's protected by Supabase Auth — only
admin users you create can see it (there is no public sign-up).

## 1. Create your admin login (one time)

You need a Supabase Auth user. Two ways — pick whichever is comfier:

### Option A — one command (recommended)
From the project folder, run:

```
npm run create-admin -- you@email.com "YourStrongPassword"
```

(It reads your keys from `.env.local`.) Re-running with the same email just
updates the password.

### Option B — Supabase Dashboard (no terminal)
1. Open your project at supabase.com → **Authentication** → **Users**.
2. Click **Add user** → **Create new user**.
3. Enter your email + a password, tick **Auto Confirm User**, and create.

## 2. Test it locally

```
npm run dev
```

Then open **http://localhost:3000/admin** → you'll be sent to the login page →
sign in with the email/password from step 1.

> Requires `.env.local` filled in (Supabase URL + anon + service-role keys).

## 3. Test it on Vercel

Just go to **https://YOUR-SITE/admin** and log in with the same credentials.
(The same Supabase project powers both, so the login works in both places.)
Make sure the Vercel project has the same env vars set as `.env.local`.

## What you'll see

- **מלאי צבעים** — toggle any of the 24 colors in/out of stock (17 core are in
  by default; the 7 boosters are out).
- **רכש מלאי** — aggregated reorder list (pieces + grams incl. spare) across all
  pending physical orders.
- **הזמנות פרטיות / עסקיות / הגשות עובדים** — order lists. Click an order to open
  its **fulfillment sheet** (`/admin/orders/[id]`): the customer instruction PDF
  to print, the per-color **packing list in grams (incl. spare)** to weigh out,
  the shipping address, and a **"סמן כנשלח"** button.

A **demo order** ("הזמנת דמו", ₪290, paid) has been seeded so you have something
to click into immediately.

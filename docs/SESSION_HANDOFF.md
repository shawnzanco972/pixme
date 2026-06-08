# Pixipic — Session Handoff

Everything built in this working session, what's still on you to do manually,
and how to **test the full flow without real payments**.

Status at handoff: `tsc` clean · `eslint` clean · `next build` clean · 75/75
unit tests pass.

---

## 1. What was built

### A. PDF fixes (admin packing list)
- **Garbled text fixed.** jsPDF has no bidi shaping, so Hebrew + Western digits
  were mangled. Now:
  - Customer name renders in real Hebrew via an **embedded Heebo font**
    (`src/lib/pdf/heebo-font.ts`, base64; source `src/lib/pdf/fonts/Heebo.ttf`),
    reversed for correct RTL.
  - All weights/units use ASCII (`g` / `kg`) — `formatWeightAscii` in
    `src/lib/packing.ts`.
- **Richer content** (`src/lib/pdf/packing.ts`): per-color **tick-box** ("Done"
  column), order date, finished size (studs + cm), clearer totals/footer.
- **More generous spare** (`src/lib/packing.ts` → `packCount`): now
  `max(5% , a 5-piece floor)` per color (was a flat 3%). A 62-piece color now
  ships +5 instead of +2. Restock logic + tests updated.
- Instructions PDF title now renders Hebrew too (Heebo wired into
  `src/app/api/generate-instructions/route.ts`).

### B. Brick-engine quality (3 new options + Studio toggles)
All in `src/lib/brick-engine/`, wired through `BrickifyOptions` → worker →
`Studio.tsx` as RTL toggles, each with unit tests (`features.test.ts`).
- **Floyd–Steinberg dithering** (`fsdither.ts`) — perceptual error diffusion in
  OKLab + serpentine scan, for smooth photographic gradients. Auto-disables
  noise dither / despeckle / swap-optimize so the texture survives. Toggle:
  "מעברי צבע חלקים".
- **Face-aware contrast** (`face.ts`) — skin-tone heuristic (no ML) expands
  contrast around the face's own midtone so portraits keep their features.
  No-op when little skin. Toggle: "הדגשת פנים".
- **Line-art / text mode** (`unsharp.ts`) — pre-downsample unsharp mask + lower
  Sobel edge threshold so logos/lettering stay legible. Toggle: "מצב טקסט / קו".

### C. B2B → owned "Projects" (the big one)
Migration `supabase/migrations/0007_b2b_projects.sql` — **already applied to the
live `pixme` Supabase project**, and `src/lib/supabase/types.ts` regenerated.

- **Landing page** `/b2b` (`src/app/b2b/page.tsx`) — hero, how-it-works, and
  three fixed **deal bundles** (`src/lib/b2b-bundles.ts`): Team 10 (₪390),
  Company 25 (₪875, featured), Enterprise 50 (₪1,950). Each bundle **locks the
  mosaic size** for all employees.
- **Bundle checkout** (`src/app/api/checkout/route.ts`) — seats/size/amount
  derived **server-side from the bundle id** (never trusted from client). Order
  gets a secret `owner_token`.
- **Owner dashboard** `/b2b/project/[ownerToken]` — secret-link access (no
  login), progress bar, roster table with per-seat status, add-employees box.
- **Pre-loaded roster** (`employee_roster` table) — owner adds names/emails →
  each gets a **personalized seat link**; capped at purchased seats.
- **Seat flow** `/seat/[inviteToken]` — size locked to the bundle; the
  submission links back to the roster so the owner sees who's done.
- Helpers + tests: `seatStatus`, `projectProgress`, bundle helpers
  (`src/lib/b2b.ts`, `src/lib/b2b.test.ts`).

### D. Email + admin polish
- **Email** (`src/lib/email.ts`) — Resend REST API, **no SDK dependency**,
  Hebrew RTL templates. **Gracefully no-ops when unconfigured.**
  - Owner welcome (on provisioning), seat invites (on roster add), per-seat
    resend (`/api/b2b/invite` + dashboard button), and **B2C order
    confirmation** (`sendOrderConfirmation`, sent from the webhook on payment).
- **Admin B2B page** (`src/app/admin/b2b/[id]/page.tsx`) now shows project
  name/bundle/size, the customer's owner-dashboard link, and a roster overview
  with a progress bar + per-seat status.
- **Manual provisioning endpoint** `/api/b2b/provision` (admin-gated) mirrors the
  webhook exactly (mark paid + create workspace + email owner) — this is the
  no-payment test path; the admin "צור סביבת עבודה" button calls it.

---

## 2. Gaps — things you must do manually

### Environment variables
| Var | Needed for | Notes |
|-----|-----------|-------|
| `NEXT_PUBLIC_SITE_URL` | correct links in emails/checkout | e.g. `https://pixme-nine.vercel.app` |
| `RESEND_API_KEY` | sending email | from resend.com |
| `EMAIL_FROM` | sending email | a **verified** sender, e.g. `Pixipic <hello@yourdomain.co.il>` |
| `ICOUNT_API_TOKEN` | real payments (hosted checkout) | until set, checkout skips payment (see testing) |
| `ICOUNT_WEBHOOK_SECRET` | webhook signature check | optional; without it we rely on server-side tx verification |

- I **couldn't edit `.env.example`** (permission-denied directory) — please add
  the `RESEND_API_KEY` / `EMAIL_FROM` lines there yourself.
- **Verify your sending domain in Resend** or emails silently fail (the code
  treats sends as best-effort and never throws).

### Deployment / DB
- The migration is applied to the **live** project. For any other environment
  (staging/local), run `supabase/migrations/0007_b2b_projects.sql`.
- Re-run type generation after any future schema change (command is in the
  header comment of `src/lib/supabase/types.ts`).

### Product decisions still open (not built — need your input)
- **E. Catalog:** DB-backed gallery + admin CRUD, "design-it-for-me" paid
  add-on, gifting flow. All need content/pricing decisions.
- **F. UX:** multi-step create flow (Upload → Size → Customize → Details),
  cart/quantity, full admin re-branding to the design system.
- **Tuning:** `GRAMS_PER_STUD` in `src/lib/packing.ts` is an estimate — refine
  with a real scale once you have GoBricks plates.

### Known small gaps
- Emails are **best-effort**: a failed send won't surface to the user (check
  the Resend dashboard for delivery logs).
- The legacy open-seat flow (`/workspace/[id]`, `WorkspaceSubmit`) still exists
  alongside the new roster flow; can be removed later if unused.

---

## 3. How to test WITHOUT real transactions

**Key fact:** when `ICOUNT_API_TOKEN` is **unset**, `/api/checkout` skips the
hosted-checkout redirect and returns the success URL directly. The order is
created as `pending`; nothing is charged. You then "provision" manually.

### B2B — full project flow (recommended end-to-end test)
1. Make sure you're logged into the admin (`/admin/login`).
2. Go to **`/b2b`**, pick a bundle, fill company + email, click "לרכישה".
   → You land on `/b2b/thank-you` showing the **owner dashboard link**. (The
   dashboard will say "payment pending" because no workspace exists yet.)
3. Go to **`/admin`** → open the new B2B order → click **"צור סביבת עבודה"**.
   This calls `/api/b2b/provision` = marks paid + creates the workspace +
   (if email configured) emails the owner. The page refreshes with the roster
   overview.
4. Open the **owner dashboard** (`/b2b/project/<owner_token>` — copy it from the
   admin page or thank-you page). Add a couple of employees (one name per line,
   optionally `Name, email`).
5. Click **"העתקת קישור"** on a roster row → open that `/seat/<token>` link in a
   new tab (or incognito). Upload a photo, submit.
6. Back on the **owner dashboard** (refresh) and the **admin page** → that
   employee now shows **"נשלח"** and the progress bar moves. 🎉

### B2C — order flow
1. Go to **`/create`**, upload a photo, fill details, place the order.
   → With iCount unset you land on `/order/<id>` (status `pending`).
2. To simulate payment, flip the status to `paid` (via the admin order page if
   it has a control, or directly in Supabase: `update b2c_orders set
   status='paid' where id='…'`). The order page reflects paid + the
   instructions PDF download works.
   - Note: the **confirmation email** only fires from the iCount webhook (real
     payment), not from a manual SQL flip.

### Testing email specifically
- Set `RESEND_API_KEY` + `EMAIL_FROM` (verified sender), then run the **B2B
  step 3** above — the owner welcome email sends through the manual provision
  endpoint, so you can verify email **without any payment**. Roster-add and the
  per-seat "שליחת הזמנה" button also send real emails once configured.
- Watch the **Resend dashboard → Logs** to confirm delivery.

### PDFs
- Packing list: `/admin` → B2C order → download. Confirm the Hebrew customer
  name renders and weights read as `g`/`kg`.
- Instructions: the "PDF" link on any submission/order.

### Engine toggles
- On `/create`, upload a photo and toggle "מעברי צבע חלקים", "הדגשת פנים",
  "מצב טקסט / קו" to see the live preview change.

---

## 4. File map (quick reference)

```
src/lib/pdf/packing.ts, heebo-font.ts        PDF (Hebrew + checkboxes + spare)
src/lib/packing.ts                           packCount, formatWeightAscii
src/lib/brick-engine/fsdither.ts             Floyd–Steinberg
src/lib/brick-engine/face.ts                 face-aware contrast
src/lib/brick-engine/unsharp.ts              line-art/text sharpening
src/lib/b2b-bundles.ts                       deal bundles (pricing source of truth)
src/lib/b2b.ts                               seatStatus / projectProgress
src/lib/email.ts                             Resend email + templates
supabase/migrations/0007_b2b_projects.sql    schema (applied to live)
src/app/b2b/page.tsx                         landing
src/app/b2b/project/[token]/page.tsx         owner dashboard
src/app/seat/[token]/page.tsx                employee seat
src/app/api/b2b/{roster,submit,invite,provision}/route.ts
src/app/api/checkout/route.ts                bundle-aware checkout
src/app/api/webhooks/icount/route.ts         provisioning + emails
src/app/admin/b2b/[id]/page.tsx              admin project view
```

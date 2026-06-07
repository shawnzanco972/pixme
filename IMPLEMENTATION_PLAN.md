# Pixme — Implementation Plan

A granular, phased roadmap for building the Pixme platform: a zero/low-stock,
RTL-Hebrew e-commerce platform for custom **pixel-to-brick** photo mosaics.

> Read [`CLAUDE.md`](./CLAUDE.md) for full project vision, styling rules, and
> color-science rules before working on any task here.

## Architectural Decisions (locked in)

These answers shape the whole plan — do not re-litigate without flagging:

1. **Build strategy — Shared Engine first.** Build the **Brick Engine**
   (OKLab quantization + Web Worker), **iCount checkout/webhook**, and
   **jsPDF instructions** as decoupled, reusable services *first*. Then wire
   the **B2C** and **B2B** fulfillment tracks on top of that shared foundation.
2. **Auth — admins only; everyone else is a guest.**
   - **Admins** (Shawn + Mom): Supabase Auth → backend dashboard.
   - **B2C customers**: frictionless **guest checkout**, tracked by email +
     secure order token (row UUID). No accounts (protect conversion rate).
   - **B2B buyers**: also guest checkout. The iCount webhook mints a secure
     **UUID workspace link** they share with employees — employees upload with
     no account.
3. **Image storage & processing — Supabase Storage, trust the client map.**
   - User photos → **Supabase Storage**; URL saved to `image_url`.
   - Brick Engine (sRGB→OKLab, despeckle, quantize) runs **entirely
     client-side in a Web Worker**.
   - Client persists the resulting 2D color-index array as `pixel_map` JSONB.
   - The PDF route **trusts** the stored `pixel_map` — it **never re-runs**
     image math (avoids serverless timeouts).
4. **Payments — iCount Hosted Checkout + webhook.** Webhook at
   `/api/webhooks/icount` provisions digital goods / B2B workspaces. Exact
   security model pending a research task (signed webhook vs. API-lookup
   fallback — see Phase 1).

## How to use this document

Each major feature follows a **Plan → Implement → Verify** loop so we test as
we build:

- **Plan** — confirm the approach, data contracts, and edge cases.
- **Implement** — write the code/migration.
- **Verify** — prove it works (build passes, manual test, query check, etc.)
  before moving on.

Mark tasks done by switching `- [ ]` to `- [x]`.

---

## ✅ Phase 0 — Project Baseline (COMPLETE)

- [x] Initialize Next.js (App Router, TypeScript, Tailwind v4, ESLint, `src/`)
- [x] RTL Hebrew shell: `<html dir="rtl" lang="he">`, Heebo + David Libre fonts
- [x] Tailwind v4 logical-property setup + Hebrew landing page
- [x] `CLAUDE.md` project guide
- [x] `supabase/migrations/0001_initial_schema.sql` — B2B tables + RLS + trigger
- [x] `supabase/migrations/0002_b2c_orders.sql` — B2C orders table + guest-insert RLS
- [x] Git initialized, linked to remote, baseline pushed to `origin/main`

---

## Phase 1 — Shared Foundation: Supabase + iCount Plumbing

Goal: a deployable backend skeleton — DB live, env wired, payment webhook
researched and stubbed — before any heavy feature work.

### 1.1 Supabase project & client wiring
- **Plan**
  - [ ] Confirm Supabase project (create or reuse), capture project URL + keys
  - [ ] Decide env var names (`NEXT_PUBLIC_SUPABASE_URL`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- **Implement**
  - [ ] Add `.env.local` (+ `.env.example`) with Supabase + iCount placeholders
  - [ ] Apply migrations `0001` and `0002` to the Supabase project
  - [ ] Create `src/lib/supabase/client.ts` (browser, anon key)
  - [ ] Create `src/lib/supabase/server.ts` (server, service-role for trusted ops)
  - [ ] Generate TypeScript DB types into `src/lib/supabase/types.ts`
- **Verify**
  - [ ] Run Supabase advisors (security/perf) — resolve RLS warnings
  - [ ] Smoke test: anon insert into `b2c_orders` succeeds; anon select returns 0 rows
  - [ ] Smoke test: anon can read only active `b2b_workspaces`

### 1.2 Supabase Storage for uploads
- **Plan**
  - [ ] Define bucket(s): `uploads` (original photos), `previews` (optional)
  - [ ] Decide path convention (e.g. `b2c/{order_id}/original.jpg`)
- **Implement**
  - [ ] Create bucket(s) + Storage RLS (anon upload, admin/public read as needed)
  - [ ] Helper for signed upload URLs in `src/lib/supabase/storage.ts`
- **Verify**
  - [ ] Upload a test image from the browser; confirm public/signed URL resolves

### 1.3 iCount integration research (BLOCKER for payments)
- **Plan / Research**
  - [ ] Consult the **iCount API docs** to confirm:
        (a) **webhook payload signing** (e.g. HMAC secret), and
        (b) **custom pass-through fields** so we can pass our Supabase
        `order_id` (UUID) through Hosted Checkout and back.
  - [ ] Document findings in `docs/icount.md`
- **Decision / Fallback**
  - [ ] If signed webhooks ARE supported → verify HMAC signature on every webhook.
  - [ ] **Fallback (Option 2)** if NOT supported: treat the webhook as a mere
        *event trigger*, then have our backend perform a **direct authenticated
        API lookup to iCount** (using our secret token) to verify the
        transaction status **before provisioning anything**.

### 1.4 iCount checkout + webhook skeleton
- **Plan**
  - [ ] Define order→checkout flow: create pending order → redirect to Hosted
        Checkout → webhook provisions on payment confirmation
- **Implement**
  - [ ] `src/lib/icount.ts` — typed client (create checkout, lookup transaction)
  - [ ] `src/app/api/checkout/route.ts` — create pending order + hosted checkout URL
  - [ ] `src/app/api/webhooks/icount/route.ts` — verify (signature OR lookup),
        then mark order `paid` and provision (digital goods / B2B workspace)
- **Verify**
  - [ ] Replay a sample iCount webhook payload → order transitions to `paid`
  - [ ] Invalid/forged webhook is rejected
  - [ ] Idempotency: duplicate webhook does not double-provision

---

## Phase 2 — The Brick Engine (OKLab Quantization + Web Worker)

Goal: the perceptual color-matching core, isolated and unit-tested, runnable in
a Web Worker so the UI never blocks. **Client-side only.**

### 2.1 Color science core (pure, framework-free)
- **Plan**
  - [ ] Define palette type (brick color → sRGB + material tag)
  - [ ] Define `pixel_map` contract: `number[][]` of palette indexes (row-major)
- **Implement**
  - [ ] `src/lib/brick-engine/color.ts` — sRGB → linear → **OKLab** conversion
  - [ ] `src/lib/brick-engine/match.ts` — **Euclidean distance in OKLab** +
        **material mismatch penalty**
  - [ ] `src/lib/brick-engine/palette.ts` — initial GoBricks-style 1x1 palette
- **Verify**
  - [ ] Unit tests: known sRGB↔OKLab reference values within tolerance
  - [ ] Unit tests: skin-tone sample does NOT match green (the core failure mode)

### 2.2 Quantization & denoise pipeline
- **Plan**
  - [ ] Define grid model: **16×16 modular blocks**; target overall dimensions
  - [ ] Order of operations: downscale → coarse block quantize → match → despeckle
- **Implement**
  - [ ] `src/lib/brick-engine/quantize.ts` — coarse block quantization
  - [ ] `src/lib/brick-engine/despeckle.ts` — remove isolated noise pixels
  - [ ] `src/lib/brick-engine/index.ts` — `imageData → pixel_map` orchestration
- **Verify**
  - [ ] Golden-image test: fixed input → stable `pixel_map` snapshot
  - [ ] Visual check: despeckle reduces lone-pixel noise without mush

### 2.3 Web Worker wrapper
- **Plan**
  - [ ] Define worker message contract (in: ImageData + options; out: pixel_map + preview)
- **Implement**
  - [ ] `src/workers/brick.worker.ts` — runs the pipeline off the main thread
  - [ ] `src/lib/brick-engine/useBrickWorker.ts` — React hook (post/await)
- **Verify**
  - [ ] Process a large image; main thread stays responsive (no jank)
  - [ ] Worker output matches direct (non-worker) pipeline output

---

## Phase 3 — jsPDF Automated Instructions (Shared Service)

Goal: a serverless route that turns a stored `pixel_map` into a printable
manual + parts inventory. **Trusts the client map; no image math.**

### 3.1 PDF renderer
- **Plan**
  - [ ] Define page layout: cover, **16×16** grid pages, legend, parts inventory
  - [ ] Confirm RTL/Hebrew text rendering in jsPDF (embed Hebrew-capable font)
- **Implement**
  - [ ] `src/lib/pdf/instructions.ts` — render grids from `pixel_map`
  - [ ] `src/lib/pdf/inventory.ts` — count color indexes → parts list (by color)
  - [ ] `src/app/api/generate-instructions/route.ts` — accept/fetch `pixel_map`,
        return PDF (NO re-quantization)
- **Verify**
  - [ ] Generate PDF from a sample `pixel_map`; grid coordinates align
  - [ ] Inventory counts equal a manual tally of the sample map
  - [ ] Hebrew labels render correctly (RTL)
  - [ ] Route returns within serverless time limits on a full-size map

---

## Phase 4 — B2C Fulfillment Track

Goal: end-to-end individual customer journey on top of the shared engine.
Guest checkout, tracked by email + order token.

### 4.1 Upload → preview UX (RTL Hebrew)
- **Plan**
  - [ ] Wireframe upload → live brick preview → size/options → price
- **Implement**
  - [ ] Upload component → Supabase Storage; save `image_url`
  - [ ] Wire `useBrickWorker` for live preview; render brick canvas
  - [ ] Persist `pixel_map` to a draft `b2c_orders` row
  - [ ] All UI uses logical properties (`ms-/me-/start-/end-`), Hebrew copy
- **Verify**
  - [ ] Upload→preview works on mobile + desktop; layout mirrors correctly in RTL
  - [ ] Draft order row contains valid `image_url` + `pixel_map`

### 4.2 Checkout & provisioning
- **Plan**
  - [ ] Map cart/options → `total_price`; choose digital vs physical fulfillment
- **Implement**
  - [ ] Checkout calls `/api/checkout` (iCount Hosted Checkout, pass `order_id`)
  - [ ] Webhook marks order `paid`, provisions digital PDF (and physical flag)
  - [ ] Order-status page by secure token (email + UUID), no login
- **Verify**
  - [ ] Full sandbox purchase: pending → paid → PDF available
  - [ ] Order-status page accessible only with the correct token

---

## Phase 5 — B2B Fulfillment Track & Workspaces

Goal: corporate buyers purchase license batches; employees submit via a
no-account workspace link.

### 5.1 B2B purchase → workspace provisioning
- **Plan**
  - [ ] Define B2B checkout (licenses_purchased, amount) → workspace creation
- **Implement**
  - [ ] B2B checkout flow → `b2b_orders` (guest)
  - [ ] Webhook creates `b2b_workspaces` (max_slots, expiration) + secure UUID link
  - [ ] Email the workspace link to the buyer
- **Verify**
  - [ ] Sandbox B2B purchase yields an active workspace + working link

### 5.2 Employee submission portal (no account)
- **Plan**
  - [ ] Define `/workspace/[id]` flow: validate active workspace → upload → preview
- **Implement**
  - [ ] Public workspace page (reads only active, non-expired workspaces via RLS)
  - [ ] Employee upload + brick preview → insert `employee_submissions`
  - [ ] Confirm `slots_used` increments via DB trigger; block when full/expired
- **Verify**
  - [ ] Submit until slots exhausted → further submissions rejected
  - [ ] Expired/inactive workspace blocks submission (RLS + trigger guard)

### 5.3 Admin dashboard (Supabase Auth)
- **Plan**
  - [ ] Define admin views: B2C orders, B2B orders, workspaces, submissions
- **Implement**
  - [ ] Supabase Auth login (admins only)
  - [ ] Dashboard: list/filter orders & submissions; trigger PDF generation
  - [ ] Fulfillment helpers (mark fulfilled; weight-based packing notes)
- **Verify**
  - [ ] Non-admin cannot reach dashboard or read order tables (RLS enforced)
  - [ ] Admin can generate instruction PDFs from any paid order

---

## Phase 6 — Logistics, Polish & Launch

- **Plan**
  - [ ] Define HFD / Chita shipping integration scope (labels/handoff)
- **Implement**
  - [ ] Shipping label / handoff flow for physical orders
  - [ ] SEO + Hebrew metadata, OG images, sitemap
  - [ ] Error monitoring + analytics
  - [ ] Accessibility pass (RTL, contrast, keyboard, screen reader)
- **Verify**
  - [ ] Lighthouse / a11y audit passes
  - [ ] End-to-end dry run: B2C + B2B, digital + physical
  - [ ] Production deploy to Vercel with env + webhooks configured

---

## Cross-cutting conventions

- **Styling:** logical properties only (`ms-/me-/ps-/pe-/start-/end-/text-start/end`).
- **Color:** never match in raw sRGB — always OKLab + material penalty.
- **Security:** RLS on every table; service-role key only in trusted server code;
  verify every webhook before provisioning.
- **Workflow:** Plan → Implement → Verify per feature; commit per completed unit.

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

### 1.1 Supabase project & client wiring — ✅ COMPLETE
> Live project ref: `ldolbwvkzuhzzgzrpvmj`
- **Plan**
  - [x] Confirm Supabase project (create or reuse), capture project URL + keys
  - [x] Decide env var names (`NEXT_PUBLIC_SUPABASE_URL`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- **Implement**
  - [x] Add `.env.local` (+ `.env.example`) with Supabase + iCount placeholders
  - [x] Apply migrations `0001` and `0002` to the Supabase project
  - [x] Create `src/lib/supabase/client.ts` (browser, anon key)
  - [x] Create `src/lib/supabase/server.ts` (server: RLS client + service-role admin client)
  - [x] Create `src/lib/supabase/env.ts` (validated env access)
  - [x] Author authoritative TypeScript DB types in `src/lib/supabase/types.ts`
        (generated from live project) + domain aliases in `types.helpers.ts`
  - [x] `0003_security_hardening.sql` — pin `set_updated_at` search_path; revoke
        EXECUTE on trigger functions (resolved advisor warnings)
- **Verify**
  - [x] `npm run build` + `npm run lint` pass with the new modules
  - [x] Run Supabase advisors (security) — resolved actionable warnings; the
        remaining `rls_policy_always_true` warnings are accepted-by-design
        (authenticated == admin; guest-checkout INSERT). Revisit when we add a
        dedicated admin role/claim.
  - [x] Smoke test: anon insert into `b2c_orders` succeeds; anon select returns 0 rows
  - [x] Smoke test: anon can read only active `b2b_workspaces` (1 active visible, inactive hidden)
  - [x] Bonus: `slots_used` trigger fires on anon submission (0 → 1)

### 1.2 Supabase Storage for uploads — ✅ COMPLETE
- **Plan**
  - [x] Define bucket: private `uploads` (10 MB cap, image MIME types only)
  - [x] Decide path convention: `b2c/{orderId}/original.{ext}`,
        `b2b/{workspaceId}/{submissionId}.{ext}`
- **Implement**
  - [x] `0004_storage_uploads.sql` — create private `uploads` bucket + Storage RLS
        (anon/auth INSERT; authenticated-only SELECT; no anon update/delete)
  - [x] Helpers in `src/lib/supabase/storage.ts`: signed upload URL (server mints),
        `uploadToSignedUrl` (browser), signed download URL (admin viewing), path builders
- **Verify**
  - [x] Bucket + both policies confirmed present via SQL
  - [x] `npm run build` + `npm run lint` pass
  - [ ] Upload a test image from the browser end-to-end (deferred to first UI in Phase 4)

### 1.3 iCount integration research — ✅ COMPLETE (dashboard confirmation pending)
- **Plan / Research**
  - [x] Researched iCount API surface; confirmed token-auth open API. Detailed
        endpoint/field docs live behind the authenticated dev portal (Hebrew) —
        exact field names tracked as `TODO(icount)` in code.
  - [x] Documented findings + architecture in `docs/icount.md`
- **Decision / Fallback**
  - [x] Adopted the **fallback (Option 2) as the baseline**: webhook is a mere
        trigger; backend performs a direct authenticated API lookup to verify
        the transaction **before provisioning**. HMAC verification is layered on
        top (active automatically if `ICOUNT_WEBHOOK_SECRET` is set).
  - [ ] Confirm exact iCount field/endpoint names in the dashboard, then remove
        the `TODO(icount)` placeholders (needs iCount account access)

### 1.4 iCount checkout + webhook skeleton — ✅ COMPLETE (live sandbox test pending)
- **Plan**
  - [x] Defined order→checkout flow: create pending order → redirect to Hosted
        Checkout → webhook verifies + provisions on payment confirmation
- **Implement**
  - [x] `src/lib/icount.ts` — typed client (createCheckout, verifyTransaction,
        HMAC verify, order-ref extraction)
  - [x] `src/app/api/checkout/route.ts` — create pending B2C/B2B order + checkout URL
  - [x] `src/app/api/webhooks/icount/route.ts` — verify (signature OR lookup),
        mark order `paid`, provision (B2C PDF flag / B2B workspace), idempotent
- **Verify**
  - [x] Build + lint pass; provisioning logic is idempotent by design
  - [ ] Replay a real iCount sandbox webhook → order transitions to `paid`
        (needs iCount account + live env)
  - [ ] Confirm forged/duplicate webhook handling against the real provider

---

## Phase 2 — The Brick Engine (OKLab Quantization + Web Worker)

Goal: the perceptual color-matching core, isolated and unit-tested, runnable in
a Web Worker so the UI never blocks. **Client-side only.**

### 2.1 Color science core — ✅ COMPLETE
- **Plan**
  - [x] Defined palette type (brick color → sRGB + material tag) in `palette.ts`
  - [x] Defined `pixel_map` contract: `number[][]` of palette indexes (row-major)
- **Implement**
  - [x] `src/lib/brick-engine/color.ts` — sRGB → linear → **OKLab** (+ inverse, distances)
  - [x] `src/lib/brick-engine/match.ts` — **Euclidean distance in OKLab** +
        **material mismatch penalty**
  - [x] `src/lib/brick-engine/palette.ts` — GoBricks-style palette w/ precomputed OKLab
- **Verify**
  - [x] Unit tests: sRGB↔OKLab reference values (white/black/red) within tolerance
  - [x] Unit tests: skin-tone samples NEVER match green (the core failure mode)

### 2.2 Quantization & denoise pipeline — ✅ COMPLETE
- **Plan**
  - [x] Grid model: **16×16 modular blocks** (default 48×48 overall, configurable)
  - [x] Order of operations: block quantize (gamma-correct) → match → despeckle
- **Implement**
  - [x] `src/lib/brick-engine/quantize.ts` — coarse block quantization (linear-light avg)
  - [x] `src/lib/brick-engine/despeckle.ts` — 8-neighbor majority despeckle
  - [x] `src/lib/brick-engine/index.ts` — `imageData → pixel_map` orchestration + preview
- **Verify**
  - [x] Tests: solid image → uniform map; countParts sums to stud total
  - [x] Tests: despeckle removes a lone stray stud, keeps solid regions intact

### 2.3 Web Worker wrapper — ✅ COMPLETE
- **Plan**
  - [x] Worker message contract (in: pixels + options; out: pixel_map + dims)
- **Implement**
  - [x] `src/workers/brick.worker.ts` — runs the pipeline off the main thread
  - [x] `src/lib/brick-engine/useBrickWorker.ts` — React hook (id-correlated, transferable)
- **Verify**
  - [x] Build passes (worker bundled via `new URL(..., import.meta.url)`)
  - [ ] Live in-browser jank check (do during Phase 4.1 UI)

---

## Phase 3 — jsPDF Automated Instructions (Shared Service)

Goal: a serverless route that turns a stored `pixel_map` into a printable
manual + parts inventory. **Trusts the client map; no image math.**

### 3.1 PDF renderer — ✅ COMPLETE (Hebrew font asset pending)
- **Plan**
  - [x] Page layout: cover (preview + summary), **16×16** numbered grid pages,
        parts inventory table
  - [x] RTL/Hebrew approach: numbers/swatches are language-neutral; Hebrew title
        renders via an optional embedded font (`hebrewFontBase64`), with a Latin
        fallback so output is never garbled
- **Implement**
  - [x] `src/lib/pdf/instructions.ts` — render grids + preview + inventory from `pixel_map`
  - [x] `src/lib/pdf/inventory.ts` — count color indexes → parts list (pure, tested)
  - [x] `src/app/api/generate-instructions/route.ts` — accept `pixelMap` or fetch
        by `orderId`; returns PDF (NO re-quantization)
- **Verify**
  - [x] Test: valid `%PDF` buffer generated from a sample map (cover + 4 modules + inventory)
  - [x] Test: inventory counts equal a manual tally
  - [x] Route trusts stored `pixel_map` (no image math) → fast
  - [ ] Embed the Heebo TTF asset for full Hebrew labels (needs font file)

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

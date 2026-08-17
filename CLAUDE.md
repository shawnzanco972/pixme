# CLAUDE.md — Pixipic Project Guide

This file gives Claude persistent context for the repository. Read it at the start of every session.

> **Brand:** the product is **Pixipic** (Hebrew **פיקסיפיק**). It was previously
> "Pixme" — never use that name in UI, and never reference competitors by name.
> The git repo/package id may still read `pixme` (internal only).

## PROJECT VISION & CONTEXT

We are building a highly automated, **zero-stock (or low-inventory) e-commerce platform** targeted at the **Israeli market** (fully **Right-To-Left in Hebrew**) for custom **"pixel-to-brick" photo mosaics**. Customers upload a photo, see a digitized brick preview, and order a kit.

- **Roles:** Shawn handles the tech. His mom handles physical packing from home.
- **Packing model:** By **weight** (digital scale), *not* by counting individual bricks.

### Two fulfillment tracks
1. **Digital-only (B2C & B2B):** Customers receive a digital PDF manual and a parts list.
2. **On-demand physical:** Source generic 1x1 plates from China — the first-order
   supplier is **Shantou Chenghai Peiye Toys Firm** (BCM, via Alibaba), part
   **3024** (Plate 1×1). NOT GoBricks (priced too high). Ship via local Israeli
   logistics (**HFD / Chita**). Procurement export (`procurement.ts`) emits a
   reorder list in any supplier's numbering; default manufacturer `peiye`.

## TECH STACK & ARCHITECTURAL PLAN

1. **Frontend/Backend:** Next.js (App Router) hosted on **Vercel**.
2. **Database:** **Supabase** (PostgreSQL).
3. **Styling:** **Tailwind CSS v4** using **native CSS logical properties** (`ms-*`, `me-*`, `start-*`, `end-*`) for automatic bi-directional LTR/RTL mirroring. The app is RTL-first (Hebrew). **Light-only "Creative Workshop" theme** (off-white #f7f9fb + stud-dot texture; brand red #b7102a / blue #1d4ed8); brand tokens + `.btn/.card/.input` classes in `globals.css`. `dark:` variant is bound to a `.dark` class (never added) so it stays light on dark-mode machines.
4. **Fonts:** Google Fonts **'Rubik'** (headings/labels, `--font-rubik`) and **'Heebo'** (body, `--font-heebo`). Both Hebrew-capable.
5. **Image Processing — the "Brick Engine":** HTML5 Canvas + Web Workers.
   - Convert **sRGB → OKLab** (perceptually uniform) to prevent muddy colors and green skin tones.
   - Match colors using **Euclidean distance in OKLab** with a **material mismatch penalty**.
   - Use **coarse block quantization** and **despeckling** to remove visual noise.
6. **Payments & Webhooks:** **iCount API** via a **Hosted Checkout Model** (bypasses complex PCI credit-card forms), with a **webhook** back to our system to provision orders.
7. **Automated Instructions:** **jsPDF** via a Next.js serverless route to generate **16x16 modular grid** instructions plus a parts inventory.

## STYLING RULES (do not violate)

- Always use **logical properties** (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`) — never physical `ml-`, `mr-`, `left-`, `right-` unless intentionally non-mirroring.
- `<html dir="rtl" lang="he">` is the default document direction.
- Default UI language is **Hebrew**.

## COLOR SCIENCE RULES

- Never match colors in raw sRGB. Always convert to **OKLab** first.
- Distance metric: **chroma-weighted Euclidean in OKLab** (chromaWeight ~1.6, so
  saturated colors don't collapse to gray) + **neutral-avoidance** (tinted pixels
  avoid white/gray) + **chroma-overshoot penalty** + **material mismatch
  penalty**. See `match.ts`.
- **Chroma overshoot is penalized asymmetrically**: choosing a brick MORE
  saturated than the source is punished, undershoot is not. Reproducing a photo
  must never invent saturation the source lacks. This is the guard that keeps
  warm skin off Red/Orange; without it, warm skin matched `orange`/`red`.
- **Defaults are fidelity-neutral** (`design-settings.ts`): contrast 1,
  saturation 1, autoLevels OFF. They used to be a "vivid" preset, and because
  contrast is applied per-channel around mid-gray, warm subjects (skin is
  R>G>B) gained chroma on every pass and drifted red. Reach for vividness via
  the named presets, never by moving the defaults.
- **Floyd–Steinberg dithering is ON by default for photographs.** It raises
  per-cell error (~0.042 → 0.056) but cuts PERCEIVED error — the local average
  the eye integrates at viewing distance — by ~73% (0.0391 → 0.0105 over a 3×3
  window). Judge dithering by perceived error, never per-cell. The line-art /
  logo preset turns it off, where hard edges must stay hard.
- Apply coarse block quantization and despeckling to reduce noise before/after matching.
- **Palette = physical stock** (`palette.ts`): **39 defined colors**, all
  currently in stock. 15 of them are skin/warm tones (`role: "skin"`) — the
  ramp was deliberately densified after measuring that four visually distinct
  skin tones were collapsing onto one brick, which made faces look flat.
  Availability override lives in DB `brick_stock` (in_stock + on_hand_grams),
  keyed by `color_id`; a MISSING row falls back to the palette's `core` flag,
  which is how the 6 newest colors were once invisible in the studio.
  `getActivePalette()` filters; `remapPixelMap()` handles out-of-stock.
- **Three-layer color identity** — never couple to a supplier's numbering:
  `color_id` (canonical slug, persisted in pixel_map) · `display_code` (ours,
  printed on instructions: N/K/A families) · `color_manufacturer_codes` (DB
  table mapping each supplier's SKU). Adding a supplier is data-only.
- **Adaptive palette** (`select.ts`): `brickifyImage({ adaptive: { count } })`
  greedily picks the best N colors for THIS image. It is a STYLE + PACKING
  cost control, not an accuracy feature — accuracy plateaus around 20 colors,
  past which extra bricks are never chosen. Deterministic (no RNG; ties resolve
  to the earlier catalogue entry).

### Brick Engine pipeline (crispness, in order) — `src/lib/brick-engine`
1. **Pre-processing** (`preprocess.ts`): brightness/contrast/saturation on the
   full-res image. Higher contrast keeps edges sharp through downsampling.
2. **Block quantization** (`quantize.ts`): gamma-correct linear-RGB averaging.
3. **Dithering** (`dither.ts`): tiny sRGB noise *before* OKLab conversion to
   break ties / kill banding.
3.5 **Adaptive palette** (`select.ts`), when `adaptive` is set: narrow the
   catalogue to the N colors that best serve this image, before matching.
4. **Phase 1 — match** (`match.ts`): greedy nearest OKLab + penalties, OR
   Floyd–Steinberg error diffusion (`fsdither.ts`) when `fsDither` is on — the
   default for photos. NOTE: FS automatically disables despeckle + swap
   optimize, since both erase the diffusion texture.
5. **Despeckle with Sobel edge preservation** (`despeckle.ts` + `sobel.ts`):
   skip smoothing on strong edges so outlines stay crisp.
6. **Phase 2 — swap optimization** (`optimize.ts`): swap two cells' colors when
   it lowers total OKLab error; repairs accuracy lost to despeckle.
- Deterministic via a seeded RNG (`rng.ts`) — the pixel_map is persisted and
  trusted by the PDF route, so the same image+options must always reproduce it.

## B2B MODEL (the customer is the COMPANY, never the employee)

- **We hold nothing about an employee beyond the name + email the company
  entered.** No addresses, no phones, no accounts. Everything ships in bulk to
  the company. Never add per-employee PII or a "ship to home" option.
- **Approve ≠ ship.** Two separate owner decisions: approving a DESIGN
  (`employee_submissions.status = ready`) and RELEASING it to production
  (`shipment_id` → `b2b_shipments`, migration 0025). A company approves 20
  designs at once but may release 19 for the holidays and one for the boss
  today. The admin production queue must filter on `shipment_id is not null` —
  packing on approval builds sets nobody asked for.
- **Drafts** (`is_draft`, migration 0026): an employee saves work in progress
  without handing it to the manager. Drafts stay out of the review queue and
  count as "not finished" in progress, not as submitted.
- **Never show "לוחות"/plate credits to a company.** That's internal capacity
  vocabulary; the owner UI shows centimetres (`plateSizeLabel()` in `b2b.ts`).
- Seat lifecycle lives in `seatStatus()`; labels in `b2b-status.ts` are shared
  by the owner dashboard and the admin view so they can't drift.
- The owner dashboard (`/b2b/project/[token]`) is gated ONLY by the secret
  token in the URL — no login. Admin (`/admin/b2b/[id]`) reuses the same
  `RosterManager` with that token, plus `admin` for support diagnostics.

## DATABASE

- Supabase Postgres. SQL migrations live in `supabase/migrations/`.
- Use **Row-Level Security (RLS)** on all tables. Public access only where explicitly required (e.g. employees submitting via active B2B workspaces); order/admin management restricted to authenticated admins.

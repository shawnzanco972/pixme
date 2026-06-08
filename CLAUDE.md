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
2. **On-demand physical:** Source generic 1x1 plates from China (e.g. GoBricks) and ship via local Israeli logistics (**HFD / Chita**).

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
  avoid white/gray) + **material mismatch penalty**. See `match.ts`.
- Apply coarse block quantization and despeckling to reduce noise before/after matching.
- **Palette = physical stock** (`palette.ts`): 25 defined colors, `core` flag →
  19 in stock by default (incl. cool tones Bright Light Blue + Medium Azure),
  6 boosters out of stock. Availability override in DB `brick_stock`
  (in_stock + on_hand_grams). `getActivePalette()` filters; `remapPixelMap()`
  handles out-of-stock. `?testPalette=full` shows all 25.

### Brick Engine pipeline (crispness, in order) — `src/lib/brick-engine`
1. **Pre-processing** (`preprocess.ts`): brightness/contrast/saturation on the
   full-res image. Higher contrast keeps edges sharp through downsampling.
2. **Block quantization** (`quantize.ts`): gamma-correct linear-RGB averaging.
3. **Dithering** (`dither.ts`): tiny sRGB noise *before* OKLab conversion to
   break ties / kill banding.
4. **Phase 1 — greedy match** (`match.ts`): nearest OKLab + material penalty.
5. **Despeckle with Sobel edge preservation** (`despeckle.ts` + `sobel.ts`):
   skip smoothing on strong edges so outlines stay crisp.
6. **Phase 2 — swap optimization** (`optimize.ts`): swap two cells' colors when
   it lowers total OKLab error; repairs accuracy lost to despeckle.
- Deterministic via a seeded RNG (`rng.ts`) — the pixel_map is persisted and
  trusted by the PDF route, so the same image+options must always reproduce it.

## DATABASE

- Supabase Postgres. SQL migrations live in `supabase/migrations/`.
- Use **Row-Level Security (RLS)** on all tables. Public access only where explicitly required (e.g. employees submitting via active B2B workspaces); order/admin management restricted to authenticated admins.

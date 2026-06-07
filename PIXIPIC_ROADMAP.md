# Pixipic (פיקסיפיק) — Improvement Roadmap

Renamed from "Pixme" (too close to competitor brick.me). This is the working
plan for the current push; tackled top-down, committed in slices.

## A. Rebrand → Pixipic  ✅ (this session)
- All customer-facing "Pixme" → "Pixipic" / Hebrew "פיקסיפיק" (header, footer,
  home, metadata/titles, PDF titles, order/admin copy). Repo/package id can stay.

## B. Studio: interactive crop (select what to capture)  ✅ (this session)
- Drag-to-pan the crop region + zoom; live preview. `cropToAspect` gains a
  center offset (cx, cy in 0..1). Replaces centered-only zoom.

## C. /create redesign to match the design  ✅ (this session, iterating)
- Big preview stage on one side with zoom controls overlaid; control panel as a
  card with clear sections (size steppers, color studs, sliders) and bottom
  CTAs. Stud-textured stage, chunky buttons.

## D. Brick engine quality (ongoing)
- [x] chroma-weighted match, white compositing, Sobel despeckle, swap opt
- [ ] auto-levels (histogram stretch) option for flat photos
- [ ] optional Floyd–Steinberg dithering mode for photographic gradients
- [ ] face-aware contrast bias (later; needs detection)
- [ ] higher-res tiers already exist (up to 5×5 / 120²)

## E. Content / catalog (brick.me parity, later)
- [ ] **Library/gallery** of royalty-free or AI-generated designs the customer
      can start from (no copyright risk). Seed a `gallery` table + grid on /create.
- [ ] "Design-it-for-me" service (manual optimization, paid add-on).
- [ ] Gifting flow (buy now, send a customize link).

## F. UX/flow polish (later)
- [ ] Multi-step create flow (Upload → Size → Customize → Details) like brick.me
- [ ] Cart/quantity, order confirmation email (needs provider)
- [ ] Brand the admin + remaining pages (order, b2b, workspace)
- [ ] Hebrew PDF (needs RTL shaping)

Sources reviewed: brick.me (flow, 50-color palette, library, design-it-for-me,
gifting, numbered baseplate instructions).

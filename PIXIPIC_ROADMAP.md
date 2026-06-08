# Pixipic (פיקסיפיק) — Improvement Roadmap

Renamed from "Pixme" (the prior working name). This is the working
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
- [x] auto-levels (histogram stretch) option for flat photos
- [ ] optional Floyd–Steinberg dithering mode for photographic gradients
- [ ] face-aware contrast bias (later; needs detection)
- [ ] higher-res tiers already exist (up to 5×5 / 120²)

## E. Content / catalog
- [x] **Starter gallery** — copyright-free procedural designs (heart, star,
      Star of David, smiley, Israeli flag, checkerboard) in `src/lib/starters.ts`,
      pickable on /create. No copyright risk; no external assets.
- [ ] DB-backed gallery (`gallery` table + admin CRUD) for curated/AI designs
      with images — needs content decisions.
- [ ] "Design-it-for-me" service (manual optimization, paid add-on).
- [ ] Gifting flow (buy now, send a customize link).

## F. UX/flow polish
- [ ] Multi-step create flow (Upload → Size → Customize → Details)
- [ ] Cart/quantity, order confirmation email (needs provider)
- [x] Brand customer pages (home, header/footer, /create, order, b2b, workspace)
- [ ] Brand the admin pages to the design system (functional, still zinc)
- [ ] Hebrew PDF (needs RTL shaping)

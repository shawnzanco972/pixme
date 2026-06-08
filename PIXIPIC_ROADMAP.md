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
- [x] Floyd–Steinberg dithering mode for photographic gradients
      (`fsdither.ts`, error diffusion in OKLab, serpentine scan; toggled by
      "מעברי צבע חלקים". Disables despeckle/swap so the texture survives.)
- [x] face-aware contrast bias (`face.ts`: skin-tone heuristic — no ML —
      expands contrast around the face's own midtone, weighted by skin
      membership; toggled by "הדגשת פנים". No-op when little skin present.)
- [x] line-art / text mode (`unsharp.ts`: pre-downsample unsharp mask +
      lower Sobel edge threshold so logos/lettering stay legible; toggled
      by "מצב טקסט / קו".)
- [x] higher-res tiers already exist (up to 5×5 / 120²)

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
- [x] Order confirmation email (B2C) — `sendOrderConfirmation` on payment
      verification (webhook). Cart/quantity still TODO.
- [x] Brand customer pages (home, header/footer, /create, order, b2b, workspace)
- [ ] Brand the admin pages to the design system (functional, still zinc)
- [ ] Hebrew PDF (needs RTL shaping)

## G. B2B → owned "Projects" (this session)
Reframed B2B from a loose license batch into an owned project with a real
owner experience. Migration `0007_b2b_projects.sql` (applied + types regen'd).
- [x] **Landing page** (`/b2b`): hero + how-it-works + fixed deal **bundles**
      (`b2b-bundles.ts`: Team 10 / Company 25 / Enterprise 50, size-locked).
- [x] **Bundle checkout**: amount/seats/size derived authoritatively from the
      bundle id server-side; order gets a secret `owner_token`.
- [x] **Owner dashboard** (`/b2b/project/[ownerToken]`): secret-link access
      (no login), progress bar, roster table with per-employee status.
- [x] **Pre-loaded roster** (`employee_roster`): owner adds names/emails →
      each gets a personalized seat link; capped at purchased seats.
- [x] **Seat flow** (`/seat/[inviteToken]`): size locked to the bundle; submit
      links back to the roster so the owner sees who's done.
- [x] Email the owner link + employee invites (`email.ts`, Resend REST, no
      SDK; graceful no-op when `RESEND_API_KEY`/`EMAIL_FROM` unset). Owner
      welcome on provision (webhook); seat invites on roster add + a per-seat
      "resend" button (`/api/b2b/invite`).
- [x] Admin B2B page now shows project name/bundle/size, the customer's owner
      dashboard link, and a roster overview with progress + per-seat status.

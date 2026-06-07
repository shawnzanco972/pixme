# Logistics — HFD / Chita (Phase 6 scoping)

> Status: scoped, not yet integrated (requires courier account + API creds).

## Model recap
- Physical kits are **packed by weight** on a digital scale, not by counting
  bricks. The PDF inventory page prints a **scale target (grams)** for each
  order (see `src/lib/packing.ts` → `estimateWeight`). Tune `GRAMS_PER_STUD`
  once real GoBricks 1x1 plate weights are measured.
- Shipping is via local Israeli couriers **HFD** and/or **Chita**.

## Integration scope (when ready)
1. **Account + credentials**: obtain API token(s); add `HFD_API_TOKEN` /
   `CHITA_API_TOKEN` to env (server-only).
2. **Create shipment**: on a physical order reaching `paid`, call the courier
   API to create a shipment from the order's `shipping_address` (JSONB:
   street/city/zip) + estimated weight, and store the returned tracking id.
   - Suggested: add `tracking_id` + `courier` columns to `b2c_orders`
     (new migration) and set them from an admin "Create shipment" action or
     automatically in the iCount webhook after provisioning.
3. **Label**: fetch/print the shipping label (PDF) for mom to attach.
4. **Status → fulfilled**: mark `b2c_orders.status = 'fulfilled'` once handed
   to the courier; optionally surface tracking on `/order/[id]`.

## Admin fulfillment helpers (Phase 6 follow-up)
- "Mark fulfilled" action on physical orders (cookie-bound admin client →
  authenticated UPDATE allowed by RLS).
- Packing view: show `estimateWeight` scale target + parts inventory per order
  (the PDF already carries both).

## Open questions
- Which courier is primary (HFD vs Chita) and do they offer a REST API or only
  a portal/CSV handoff? If portal-only, fall back to an admin CSV export of
  paid physical orders (name, address, weight) for batch label creation.

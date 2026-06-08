# Admin Dashboard — Plan

A roadmap to turn the single `/admin` page into a real operations console:
tabbed navigation, inventory (colors + plates + connectors + packaging) with
**low-stock reminders**, orders, clients, transactions, a B2B project console,
status overview, and a place to manage/preview the generated PDFs.

Status: **phases 1–3 + sandbox built** (2026-06-08). Done: tabbed dashboard
shell (right sidebar), Overview/Orders/Inventory/B2B tabs, `inventory_supplies`
+ color reorder thresholds (migration `0010`), the pure low-stock engine
(`inventoryAlerts` + tests) wired into the Overview alerts panel and inventory
badges, and an **admin-gated sandbox** (`/admin/sandbox`) that runs the real
B2C/B2B purchase→provision path without iCount. Still open: email digest +
cron (phase 4), B2B assist actions (phase 5), finance/clients **tables**
(phases 6–7, user chose durable tables), PDFs tab + settings (phase 8).
**Update (2026-06-08): phases 4–8 are now built too.** Low-stock email digest
(`sendLowStockDigest`) + `/api/cron/low-stock` (Vercel Cron, `CRON_SECRET`);
B2B admin assist (the owner `RosterManager` is embedded in `/admin/b2b/[id]`);
finance ledger (`transactions` table written on provision → `/admin/finance`);
clients CRM (`clients` table upserted on provision → `/admin/clients` with notes);
docs/settings tab (`settings` table + `/admin/docs` PDF preview). Migration
`0012_finance_clients_settings`.

RTL Hebrew, design-system tokens (`.card`/`.btn`/`surface`/`outline`),
light-only — same rules as the rest of the app (CLAUDE.md).

### Sandbox (test purchase without a real transaction)
The checkout→provision logic is extracted into [`provision.ts`](../src/lib/provision.ts)
(`provisionB2c`/`provisionB2b`), called by BOTH the live iCount webhook and
`POST /api/admin/test-checkout`. The sandbox creates an `is_test = true` order,
provisions it (marks paid, creates the B2B workspace, seeds one roster seat),
suppresses emails, and returns live links: the customer order page, the
project-owner dashboard (`owner_token`), and the employee upload link
(`invite_token`). `POST /api/admin/test-reset` wipes all `is_test` data.

---

## 1. Where we are today

- **`/admin`** ([page.tsx](../src/app/admin/page.tsx)) — one long page: 4 summary
  stat cards, the restock-intelligence table, B2C orders, B2B orders, employee
  submissions, and the `StockManager`. Auth-gated via Supabase + middleware.
- **`/admin/orders/[id]`** — B2C fulfillment sheet (instruction PDF, packing
  list, shipping, gift info, status select).
- **`/admin/b2b/[id]`** — B2B order: project roster/progress, owner-dashboard
  link, workspaces, submissions, manual provision.
- **Inventory model:** only `brick_stock` (per **color**: `in_stock`,
  `on_hand_grams`, `sort_order`). The color catalog itself is code
  ([palette.ts](../src/lib/brick-engine/palette.ts)). Demand is computed by
  [`aggregateRestock`](../src/lib/restock.ts) from pending physical orders'
  `pixel_map`s; the dashboard already shows the shortfall to reorder.
- **No** tables for plates/connectors/packaging, reorder thresholds,
  transactions, clients, or suppliers. No alerting.

**Gaps this plan closes:** real navigation, a general inventory system beyond
colors, automatic low-stock reminders, a clients view, a transactions ledger, a
focused B2B console, a status overview, and PDF management.

---

## 2. Information architecture (tabs)

Move from one page to a persistent dashboard shell (sidebar or top tabs) under
`/admin/*`, each its own route so deep links work:

| Tab | Route | Purpose |
|-----|-------|---------|
| **סקירה** (Overview) | `/admin` | KPIs, alerts (esp. low stock), today's to-do |
| **הזמנות** (Orders) | `/admin/orders` | B2C + B2B + employee submissions, filters |
| **לקוחות** (Clients) | `/admin/clients` | People/companies, history, lifetime value |
| **מלאי** (Inventory) | `/admin/inventory` | Colors, plates, connectors, packaging + reorder |
| **עסקים** (B2B) | `/admin/b2b` | Project console — browse/assist projects |
| **כספים** (Transactions) | `/admin/finance` | iCount-backed ledger, revenue, refunds |
| **מסמכים** (PDFs) | `/admin/docs` | Preview/regenerate/configure the generated PDFs |
| **הגדרות** (Settings) | `/admin/settings` | Thresholds, packing constants, email, users |

Shell: a left sidebar (RTL → right) + the existing `SignOutButton`. Keep current
detail pages (`/admin/orders/[id]`, `/admin/b2b/[id]`) as the drill-downs.

---

## 3. Overview tab (`/admin`)

The landing console. Sections:
- **KPI cards:** revenue (paid, this month), open orders, awaiting packing
  (physical + paid), B2B projects in progress, total reorder weight.
- **🔔 Alerts panel (priority):** low-stock colors/supplies, projects with
  stalled rosters, orders stuck in `pending` > N days, failed webhooks. See §7.
- **To-pack queue:** paid physical orders not yet fulfilled, with quick links to
  the packing list PDF.
- **Recent activity:** latest orders/submissions/payments.

---

## 4. Orders tab

- Unified, filterable list (B2C + B2B + employee submissions) with: status,
  track, fulfillment, date range, gift/self, search by name/email/order id.
- Bulk actions: mark fulfilled, export CSV, print packing lists.
- Status pipeline view (kanban-ish): pending → paid → fulfilled, drag or click.
- Row → existing detail pages. Reuse `OrderStatusSelect`, `DownloadInstructions`,
  `DownloadPdfButton`.

---

## 5. Clients tab

There's no clients table today (orders carry `customer_name`/`contact_email`;
B2B carries `company_name`). Two options:
- **A (light):** derive clients by grouping orders on `contact_email` — no
  schema change. Good enough to start.
- **B (durable):** a `clients` table (email unique, name, company?, notes, tags,
  created_at) linked from orders; enables CRM-ish notes + lifetime value.

Per-client view: contact, order history, total spent, B2B projects owned, notes.
Recommend **A first**, migrate to **B** when you want notes/CRM.

---

## 6. Inventory tab — colors + plates + connectors + packaging

Today inventory = colors only. Generalize to all physical supplies.

### 6.1 Categories
1. **Colors / 1×1 plates** — stays in `brick_stock` (by weight), keyed to the
   code catalog. This is the demand-driven core.
2. **Baseplates** — the 24×24 boards (by count). Demand = `Σ plates per order`.
3. **Connectors / hardware** — joiners, hanging kits, frames (by count).
4. **Packaging** — boxes, bags, inserts, ribbon (gift-wrap), tape (by count).

### 6.2 Data model (new)
Keep colors where they are; add a generic table for everything else:

```sql
-- 0010_inventory_supplies.sql
create table public.inventory_supplies (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in
                  ('baseplate','connector','packaging','other')),
  name          text not null,
  unit          text not null default 'pcs',         -- pcs / m / roll …
  on_hand       numeric(12,2) not null default 0,
  reorder_point numeric(12,2) not null default 0,    -- low-stock threshold
  reorder_qty   numeric(12,2),                        -- suggested order size
  supplier      text,
  sku           text,
  notes         text,
  updated_at    timestamptz not null default now()
);
-- RLS: admin (authenticated) all; no public read.
```

And add a **threshold** to colors so the alert engine has a target:

```sql
alter table public.brick_stock
  add column if not exists reorder_point_grams numeric(10,1) not null default 0;
```

### 6.3 Inventory UI
- Sub-tabs per category. Colors view = today's `StockManager` + a threshold
  field + a computed **"to order"** column (demand − on-hand, from
  `aggregateRestock`). Supplies view = editable table (on-hand, reorder point,
  supplier), inline +/− adjust, and a "below threshold" highlight.
- **Reorder sheet:** one combined list of everything below its reorder point
  (colors by grams, supplies by count) → CSV/print for the supplier
  (extends the existing `ExportRestockCsv`).
- **Packaging tie-in:** `gift_wrap` orders consume ribbon/box; surface that as
  demand if you track it.

---

## 7. ⭐ Low-stock reminders (the priority)

Goal: never get caught short. Two signals per item:
1. **Hard floor** — `on_hand < reorder_point` (manual threshold).
2. **Demand-aware** — `on_hand − committed_demand < reorder_point`, where
   `committed_demand` comes from `aggregateRestock` over **paid, unfulfilled**
   physical orders (colors → grams via `GRAMS_PER_STUD`; baseplates → plate
   counts; packaging → gift-wrap count). This is the smart one: it warns when
   *incoming orders* will drink the stock, not just current level.

### Surfacing
- **In-app:** the Overview "Alerts" panel + a badge on the Inventory tab; a red
  "below threshold" row state. Always available, zero config.
- **Proactive email (opt-in):** a daily digest of items below threshold to the
  admin. Reuse [`email.ts`](../src/lib/email.ts) (Resend, already wired) +
  a `sendLowStockDigest`. Trigger via **Vercel Cron** → a protected route
  `/api/cron/low-stock` (guard with a `CRON_SECRET`), or Supabase scheduled
  function. No-ops when email unconfigured.
- **Thresholds default** sensibly (e.g. a color's reorder point = N days of
  average demand) and are editable in Settings.

### Pure, testable core
Add `inventoryAlerts(stock, supplies, demand)` next to `restock.ts` returning
`{ id, name, category, onHand, threshold, committedDemand, shortfall }[]` so the
panel, the badge, and the email all share one deterministic source (unit-tested).

---

## 8. Transactions / finance tab

No ledger today — money lives implicitly on orders (`total_price`,
`amount_paid`, `icount_invoice_id`, `status`). Options:
- **A (derive):** build the ledger from orders (paid/refunded) + iCount invoice
  ids. Revenue by day/month, refunds, outstanding. No schema change.
- **B (record):** a `transactions` table written by the iCount webhook (invoice
  id, order ref, gross, status, raw payload) for an auditable trail and
  reconciliation. Recommended once volume grows.

UI: revenue chart, paid vs pending, refunds, per-order invoice link, export for
bookkeeping (iCount already issues the invoices).

---

## 9. B2B console (`/admin/b2b`)

You'll want to "check out" or assist a project. Build on the existing
[`/admin/b2b/[id]`](../src/app/admin/b2b/[id]/page.tsx):
- List all projects with progress (roster done/total), owner contact, seats,
  size, amount, status.
- **Impersonate/assist:** open the owner dashboard via the stored `owner_token`
  (link already surfaced), or an admin-only view to add roster entries / resend
  invites / upload on a seat's behalf for support.
- Per-project: submissions grid, bulk-download instruction PDFs, nudge the owner
  (email), provisioning controls.

---

## 10. PDFs / docs tab

A place to manage and iterate the generated documents:
- **Preview:** render the instruction manual + packing list for a sample or a
  real order, inline (the routes already exist:
  `/api/generate-instructions`, `/api/packing-list`).
- **Settings that feed the PDFs:** packing constants (`GRAMS_PER_STUD`,
  `PACKAGING_GRAMS`, spare tiers in [packing.ts](../src/lib/packing.ts)),
  the 1:1 plate pitch (`MM_PER_STUD`), cover title, footer text — surfaced as
  editable config (DB-backed `settings` table) instead of code constants, so you
  can tune output without a deploy.
- **Templates:** if PDFs grow (gift card insert, multi-language), this tab is
  where you toggle/edit them. Today's generators live in
  [src/lib/pdf](../src/lib/pdf) (`instructions.ts`, `packing.ts`, RTL bidi in
  `rtl.ts`). Note the Hebrew instructions + 1:1 module pages are already done.

---

## 11. Status overview

A compact health board (part of Overview): order pipeline counts, B2B project
funnel, low-stock count, payments today, webhook health (last successful iCount
IPN), and email config status. Each tile links to its tab.

---

## 12. Data model summary (new)

| Migration | What |
|-----------|------|
| `0010_inventory_supplies` | `inventory_supplies` table (baseplates/connectors/packaging) |
| `0010` (same) | `brick_stock.reorder_point_grams` |
| `0011_settings` *(opt)* | `settings` key/value for packing constants, PDF copy, thresholds, email prefs |
| `0012_clients` *(opt)* | `clients` table (only if going CRM route §5-B) |
| `0013_transactions` *(opt)* | `transactions` ledger written by the webhook (§8-B) |

All admin-only RLS (`to authenticated`), no public read. Apply via the Supabase
MCP and regenerate `src/lib/supabase/types.ts` (as done for 0007–0009).

---

## 13. Suggested build order

1. **Dashboard shell + tabs** — sidebar/layout under `/admin`, move the current
   page content into Overview + Orders + Inventory tabs (no new data yet).
2. **Inventory generalization** — `inventory_supplies` + thresholds;
   `StockManager` gains threshold + the supplies table.
3. **Low-stock engine** — `inventoryAlerts()` (pure + tested) → Overview alerts
   panel + Inventory badges. *(Highest value.)*
4. **Email reminders** — `sendLowStockDigest` + `/api/cron/low-stock` + Vercel
   Cron.
5. **B2B console** — project list + assist actions.
6. **Transactions** — derived first (§8-A), then a ledger if needed.
7. **Clients** — derived first (§5-A), then a table if you want notes/CRM.
8. **PDFs tab + settings** — DB-backed config for packing constants & PDF copy.

---

## 14. Open decisions (your call before building)

- **Clients/Transactions:** derive-from-orders first, or invest in real tables now?
- **Reminder channel:** in-app only, or also the daily email digest (needs
  `RESEND_API_KEY`/`EMAIL_FROM` + a `CRON_SECRET`)?
- **Threshold model:** flat per-item reorder points, or auto = "N days of average
  demand"? (Auto needs order history to estimate demand velocity.)
- **Connectors definition:** confirm what "connectors" are (baseplate joiners /
  hanging hardware / frames) so the categories match how you actually buy.
- **Nav style:** right sidebar vs top tabs.

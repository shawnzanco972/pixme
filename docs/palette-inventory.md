# Palette & Inventory — Supply Integration

How the Brick Engine ties to physical stock so the on-screen preview always
equals what we can actually pack.

## The model

- **Catalog** (code, `src/lib/brick-engine/palette.ts`): the full set of colors
  we *could* stock (currently 46), each with a stable `id`, `name`, `hex`,
  `material`. Indices are persisted in `pixel_map` — **only append, never
  reorder/remove**.
- **Stock** (DB, `brick_stock`): per-color availability override. Convention:
  **no row = in stock**; insert a row with `in_stock=false` to mark a color out.
  Managed by the operator in **/admin → מלאי צבעים**.
- **Active palette** (runtime): `catalog ∩ in-stock ∩ user-selected`. The engine
  only ever matches against this set, so a preview can only use orderable colors.

## Minimum colors to order (the recommended starter set)

`RECOMMENDED_IDS` in `palette.ts` defines the **~24-color starter palette** the
studio enables by default. It is tuned for photo coverage:

- **Neutrals (4):** White, Light Bluish Gray, Dark Bluish Gray, Black
- **Skin/brown ramp (7):** Reddish Brown, Dark Brown, Dark Tan, Tan,
  Medium Nougat, Nougat, Light Nougat
- **Warm (4):** Dark Red, Red, Orange, Yellow
- **Green (2):** Bright Green, Dark Green
- **Blue (4):** Blue, Dark Blue, Medium Blue, Bright Light Blue
- **Pink (2):** Dark Pink, Bright Pink
- **Sand (1)**

→ **Order these 24 first.** The other ~22 catalog colors are optional fidelity
boosters (extra skin midtones, teal/lavender/olive, etc.) — add them as volume
grows. More colors = better gradients but more stock bins.

## User color control (studio)

In `/create`, customers see the catalog as swatches:
- In-stock colors can be toggled on/off (default = recommended set).
- Out-of-stock colors are **disabled** (greyed, ✕).
- A minimum of 4 colors is enforced.
- The engine re-runs on every change; the saved `pixel_map` therefore only
  contains colors the customer chose **and** we stock.

## Out-of-stock handling

1. Operator marks a color out of stock in `/admin`.
2. New previews/orders: the studio disables it; the engine never picks it.
3. Existing `pixel_map`s that used it: call `remapPixelMap(map, activePalette)`
   (`palette.ts`) — each missing index is replaced by the **nearest available
   color in OKLab**, so old orders stay buildable from current stock.

## Ordering / BOM

Each order's `pixel_map` → `buildInventory()` (`src/lib/pdf/inventory.ts`) gives
per-color stud counts; `estimateWeight()` (`src/lib/packing.ts`) converts to
grams for weight-based packing and for GoBricks reorder quantities. Aggregate
across pending physical orders to drive restock POs.

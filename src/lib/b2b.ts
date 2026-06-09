/**
 * B2B workspace helpers (server/runtime, not a React component or hook).
 */

// --- Plate credits & allocation -------------------------------------------
//
// A B2B order is a POOL of 24×24 plate capacity = employees × the size the
// company chose, plus any later top-ups. The owner can redistribute that pool
// between employees (give one a bigger mosaic) as long as the total stays
// within the pool. Each employee designs freely up to their own allocation.
// ("plates/credits" is internal vocabulary — never shown in B2B sales copy.)

export interface PlatePoolOrder {
  licenses_purchased: number;
  plates_x: number;
  plates_y: number;
  extra_plate_credits?: number | null;
}

/** The default even share each employee gets (the purchased per-employee size). */
export function defaultAllocation(o: PlatePoolOrder): number {
  return o.plates_x * o.plates_y;
}

/** Total plate-credit pool: employees × default size + any top-ups. */
export function totalPlateCredits(o: PlatePoolOrder): number {
  return (
    o.licenses_purchased * o.plates_x * o.plates_y +
    (o.extra_plate_credits ?? 0)
  );
}

/**
 * A near-square width×height whose product is ≤ budget and wastes the fewest
 * plates — the natural starting shape for an allocation (e.g. 6→2×3, 9→3×3,
 * 8→2×4). The employee can still reframe from here within the same budget.
 */
export function balancedDims(budget: number): { x: number; y: number } {
  const b = Math.max(1, Math.floor(budget));
  let best = { x: 1, y: b, waste: b - b, diff: b - 1 };
  for (let x = 1; x * x <= b; x++) {
    const y = Math.floor(b / x);
    const waste = b - x * y;
    const diff = y - x;
    // Prefer fewer wasted plates; tie-break toward square.
    if (waste < best.waste || (waste === best.waste && diff < best.diff)) {
      best = { x, y, waste, diff };
    }
  }
  return { x: best.x, y: best.y };
}

/**
 * Auto-fit width/height to a plate budget. The axis the user just changed keeps
 * its (clamped) value; the OTHER axis is reduced so width×height stays within
 * budget. This powers the employee studio: budget 6, set W=3 ⇒ H=2; then set
 * H=3 ⇒ W drops to 2. Never returns a dimension below 1.
 */
export function fitPlateDims(args: {
  changed: "x" | "y";
  x: number;
  y: number;
  budget: number;
  maxAxis?: number;
}): { x: number; y: number } {
  const budget = Math.max(1, Math.floor(args.budget));
  const maxAxis = Math.max(1, Math.min(args.maxAxis ?? budget, budget));
  const clampAxis = (v: number) => Math.max(1, Math.min(maxAxis, v));
  if (args.changed === "x") {
    const x = clampAxis(args.x);
    const y = Math.max(1, Math.min(args.y, Math.floor(budget / x)));
    return { x, y };
  }
  const y = clampAxis(args.y);
  const x = Math.max(1, Math.min(args.x, Math.floor(budget / y)));
  return { x, y };
}

export interface WorkspaceLike {
  active: boolean;
  expiration_date: string | null;
  max_slots: number;
  slots_used: number;
}

export interface WorkspaceStatus {
  open: boolean;
  full: boolean;
  expired: boolean;
  remaining: number;
}

/** Evaluate whether a workspace can currently accept submissions. */
export function workspaceStatus(
  ws: WorkspaceLike | null,
  nowMs: number = Date.now(),
): WorkspaceStatus {
  if (!ws) {
    return { open: false, full: false, expired: false, remaining: 0 };
  }
  const expired =
    ws.expiration_date != null &&
    new Date(ws.expiration_date).getTime() < nowMs;
  const full = ws.slots_used >= ws.max_slots;
  const remaining = Math.max(0, ws.max_slots - ws.slots_used);
  return { open: ws.active && !expired && !full, full, expired, remaining };
}

// --- Project owner / roster ------------------------------------------------

/** A roster seat's lifecycle as the owner dashboard sees it. */
export type SeatStatus = "not_started" | "submitted" | "ready" | "rejected";

/**
 * Derive a seat's status from its linked submission status (or lack of one).
 * `submitted` covers the in-flight states (pending/processing) — the employee
 * has done their part; it's now on us.
 */
export function seatStatus(submissionStatus: string | null | undefined): SeatStatus {
  if (!submissionStatus) return "not_started";
  if (submissionStatus === "ready") return "ready";
  if (submissionStatus === "rejected") return "rejected";
  return "submitted"; // pending | processing
}

export interface ProjectProgress {
  total: number;
  notStarted: number;
  submitted: number;
  ready: number;
  rejected: number;
  /** Fraction of seats whose employee has submitted (0..1). */
  doneFraction: number;
}

/** Summarize roster completion for the owner dashboard progress bar. */
export function projectProgress(statuses: SeatStatus[]): ProjectProgress {
  const total = statuses.length;
  const count = (s: SeatStatus) => statuses.filter((x) => x === s).length;
  const notStarted = count("not_started");
  const ready = count("ready");
  const rejected = count("rejected");
  const submitted = count("submitted");
  const done = total - notStarted;
  return {
    total,
    notStarted,
    submitted,
    ready,
    rejected,
    doneFraction: total > 0 ? done / total : 0,
  };
}

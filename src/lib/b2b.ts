/**
 * B2B workspace helpers (server/runtime, not a React component or hook).
 */

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

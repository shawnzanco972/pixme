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

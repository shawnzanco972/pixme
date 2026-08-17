/**
 * Presentation metadata for a roster seat's status — shared by the owner
 * dashboard and the admin project view so the two never drift apart.
 *
 * Wording is owner-facing and describes WHOSE MOVE IT IS, not the internal
 * enum: "ממתין לאישורכם" tells the office manager to act; "pending" doesn't.
 */
import type { SeatStatus } from "@/lib/b2b";

export interface SeatStatusMeta {
  label: string;
  /** Tailwind classes for the status pill. */
  className: string;
  /** Material Symbols glyph. */
  icon: string;
  /** True when the owner is the one holding things up. */
  actionable: boolean;
}

export const SEAT_STATUS_META: Record<SeatStatus, SeatStatusMeta> = {
  not_started: {
    label: "טרם העלה",
    className: "bg-surface-muted text-foreground/60",
    icon: "schedule",
    actionable: false,
  },
  draft: {
    label: "בעבודה אצל העובד",
    className: "bg-surface-muted text-foreground/70",
    icon: "edit_note",
    actionable: false,
  },
  submitted: {
    label: "ממתין לאישורכם",
    className: "bg-secondary/10 text-secondary",
    icon: "rate_review",
    actionable: true,
  },
  ready: {
    label: "מאושר — מוכן לשליחה",
    className: "bg-accent/20 text-[#6b5300]",
    icon: "check_circle",
    actionable: true,
  },
  released: {
    label: "נשלח לייצור",
    className: "bg-success/15 text-success",
    icon: "local_shipping",
    actionable: false,
  },
  rejected: {
    label: "הוחזר לעובד",
    className: "bg-primary/10 text-primary",
    icon: "undo",
    actionable: false,
  },
};

/** Filter buckets offered above the roster. */
export const SEAT_FILTERS = [
  { id: "all", label: "הכול" },
  { id: "submitted", label: "ממתין לאישורכם" },
  { id: "ready", label: "מוכן לשליחה" },
  { id: "not_started", label: "טרם העלו" },
  { id: "draft", label: "בעבודה" },
  { id: "released", label: "נשלחו" },
] as const;

export type SeatFilter = (typeof SEAT_FILTERS)[number]["id"];

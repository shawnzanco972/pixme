/**
 * Small presentation helpers shared across the admin dashboard tabs.
 */
import type { OrderStatus } from "@/lib/supabase/types.helpers";

export const STATUS_HE: Record<OrderStatus, string> = {
  pending: "ממתין",
  paid: "שולם",
  fulfilled: "נשלח",
  cancelled: "בוטל",
  refunded: "הוחזר",
};

export const ALERT_CATEGORY_HE: Record<string, string> = {
  color: "צבע",
  baseplate: "לוח בסיס",
  connector: "מחבר",
  packaging: "אריזה",
  other: "אחר",
};

/** YYYY-MM-DD slice of an ISO timestamp. */
export function day(iso: string): string {
  return iso.slice(0, 10);
}

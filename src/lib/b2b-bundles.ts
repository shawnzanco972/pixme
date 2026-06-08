/**
 * B2B deal bundles — fixed, sellable packages for the /b2b landing page.
 *
 * A company buys a whole bundle (a size tier × a number of seats) at a headline
 * deal price. The bundle locks the mosaic SIZE for every employee — they only
 * upload their photo, they don't pick their own size. Pricing here is
 * authoritative on the server (checkout derives the amount from the bundle id,
 * never from the client) and deterministic so it can also render live in the UI.
 *
 * All prices in whole ILS (₪).
 */
import { PLATE_STUDS } from "@/lib/pricing";

export interface B2bBundle {
  /** Stable id used by checkout to look up authoritative seats/size/price. */
  id: string;
  /** Hebrew display name. */
  nameHe: string;
  /** Short Hebrew tagline / who it's for. */
  taglineHe: string;
  /** Number of employee seats (mosaics) included. */
  seats: number;
  /** Size tier, in 24×24 baseplates. */
  platesX: number;
  platesY: number;
  /** Total price for the whole bundle, ILS. */
  price: number;
  /** Highlight as the recommended tier on the landing page. */
  featured?: boolean;
}

/**
 * Tiers climb in seats and size; per-seat price drops with volume so the bigger
 * packages read as better deals. Tuned against the prior per-license pricing
 * (~₪32–39/seat) but expressed as round, marketable bundle totals.
 */
export const B2B_BUNDLES: readonly B2bBundle[] = [
  {
    id: "team-10",
    nameHe: "צוות",
    taglineHe: "לצוות קטן — עד 10 עובדים",
    seats: 10,
    platesX: 2,
    platesY: 2,
    price: 390,
  },
  {
    id: "company-25",
    nameHe: "חברה",
    taglineHe: "המתנה המושלמת לחג — 25 עובדים",
    seats: 25,
    platesX: 2,
    platesY: 2,
    price: 875,
    featured: true,
  },
  {
    id: "enterprise-50",
    nameHe: "ארגון",
    taglineHe: "לארגונים גדולים — 50 עובדים, פסיפס גדול",
    seats: 50,
    platesX: 3,
    platesY: 3,
    price: 1950,
  },
] as const;

export function bundleById(id: string): B2bBundle | undefined {
  return B2B_BUNDLES.find((b) => b.id === id);
}

/** Per-seat price (rounded), for "₪X לעובד" copy. */
export function bundlePerSeat(b: B2bBundle): number {
  return Math.round(b.price / b.seats);
}

/** Stud dimensions of a bundle's locked size tier. */
export function bundleStuds(b: { platesX: number; platesY: number }): {
  cols: number;
  rows: number;
} {
  return { cols: b.platesX * PLATE_STUDS, rows: b.platesY * PLATE_STUDS };
}

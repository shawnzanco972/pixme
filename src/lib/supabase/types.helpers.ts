/**
 * Domain-friendly type aliases layered on top of the generated `Database` type.
 *
 * Keep these here (not in types.ts) so `types.ts` stays a clean, overwritable
 * artifact you can regenerate from the live project at any time.
 */
import type { Database, Tables, TablesInsert, Enums } from "./types";

// --- Enums -----------------------------------------------------------------
export type OrderStatus = Enums<"order_status">;
export type SubmissionStatus = Enums<"submission_status">;

/** fulfillment_type is a CHECK-constrained varchar in the DB, not a pg enum. */
export type FulfillmentType = "digital" | "physical";

// --- JSONB shapes ----------------------------------------------------------
/** Shipping address stored as JSONB on b2c_orders. */
export interface ShippingAddress {
  street: string;
  city: string;
  zip: string;
}

/** 2D array of palette color indexes (row-major), stored as JSONB pixel_map. */
export type PixelMap = number[][];

// --- Row aliases -----------------------------------------------------------
export type B2bOrder = Tables<"b2b_orders">;
export type B2bWorkspace = Tables<"b2b_workspaces">;
export type EmployeeSubmission = Tables<"employee_submissions">;
export type B2cOrder = Tables<"b2c_orders">;

// --- Insert aliases --------------------------------------------------------
export type B2cOrderInsert = TablesInsert<"b2c_orders">;
export type EmployeeSubmissionInsert = TablesInsert<"employee_submissions">;

export type { Database };

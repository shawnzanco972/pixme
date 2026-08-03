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

/**
 * Persisted pixel_map: a 2D array (row-major) of canonical color_id SLUGS,
 * stored as JSONB. Legacy rows may still be integer indexes until migration
 * 0018 runs — read them through {@link toEnginePixelMap}, which accepts either.
 */
export type StoredPixelMap = string[][] | number[][];

/** @deprecated Prefer StoredPixelMap for DB values; number[][] for engine. */
export type PixelMap = StoredPixelMap;

// --- Row aliases -----------------------------------------------------------
export type B2bOrder = Tables<"b2b_orders">;
export type B2bWorkspace = Tables<"b2b_workspaces">;
export type EmployeeSubmission = Tables<"employee_submissions">;
export type EmployeeRoster = Tables<"employee_roster">;
export type B2cOrder = Tables<"b2c_orders">;
export type InventorySupply = Tables<"inventory_supplies">;
export type Transaction = Tables<"transactions">;
export type Client = Tables<"clients">;
export type Setting = Tables<"settings">;
export type ReadyDesign = Tables<"ready_designs">;

/** inventory_supplies.category is a CHECK-constrained text column, not an enum. */
export type SupplyCategory = "baseplate" | "connector" | "packaging" | "other";

// --- Insert aliases --------------------------------------------------------
export type B2cOrderInsert = TablesInsert<"b2c_orders">;
export type EmployeeSubmissionInsert = TablesInsert<"employee_submissions">;
export type EmployeeRosterInsert = TablesInsert<"employee_roster">;
export type InventorySupplyInsert = TablesInsert<"inventory_supplies">;

export type { Database };

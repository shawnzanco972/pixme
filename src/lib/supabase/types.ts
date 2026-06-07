/**
 * Database types for the Pixme Supabase schema.
 *
 * These are hand-authored to mirror:
 *   - supabase/migrations/0001_initial_schema.sql  (B2B tables)
 *   - supabase/migrations/0002_b2c_orders.sql      (B2C orders)
 *
 * Once a live Supabase project exists, regenerate authoritative types with:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 * (Plan task 1.1). Until then, keep this file in sync with the migrations.
 */

export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export type SubmissionStatus =
  | "pending"
  | "processing"
  | "ready"
  | "rejected";

export type FulfillmentType = "digital" | "physical";

/** JSONB column scalar type. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Shipping address stored as JSONB on b2c_orders. */
export interface ShippingAddress {
  street: string;
  city: string;
  zip: string;
}

/** 2D array of palette color indexes (row-major), stored as JSONB pixel_map. */
export type PixelMap = number[][];

export interface Database {
  public: {
    Tables: {
      b2b_orders: {
        Row: {
          id: string;
          company_name: string;
          contact_email: string;
          licenses_purchased: number;
          amount_paid: number;
          icount_invoice_id: string | null;
          status: OrderStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_name: string;
          contact_email: string;
          licenses_purchased: number;
          amount_paid?: number;
          icount_invoice_id?: string | null;
          status?: OrderStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["b2b_orders"]["Insert"]>;
      };
      b2b_workspaces: {
        Row: {
          id: string;
          b2b_order_id: string;
          max_slots: number;
          slots_used: number;
          active: boolean;
          expiration_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          b2b_order_id: string;
          max_slots: number;
          slots_used?: number;
          active?: boolean;
          expiration_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["b2b_workspaces"]["Insert"]
        >;
      };
      employee_submissions: {
        Row: {
          id: string;
          workspace_id: string;
          employee_name: string;
          image_url: string | null;
          pixel_map: PixelMap | null;
          status: SubmissionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          employee_name: string;
          image_url?: string | null;
          pixel_map?: PixelMap | null;
          status?: SubmissionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["employee_submissions"]["Insert"]
        >;
      };
      b2c_orders: {
        Row: {
          id: string;
          customer_name: string;
          contact_email: string;
          shipping_address: ShippingAddress | null;
          image_url: string | null;
          pixel_map: PixelMap | null;
          total_price: number;
          fulfillment_type: FulfillmentType;
          icount_invoice_id: string | null;
          status: OrderStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          contact_email: string;
          shipping_address?: ShippingAddress | null;
          image_url?: string | null;
          pixel_map?: PixelMap | null;
          total_price?: number;
          fulfillment_type?: FulfillmentType;
          icount_invoice_id?: string | null;
          status?: OrderStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["b2c_orders"]["Insert"]>;
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      order_status: OrderStatus;
      submission_status: SubmissionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

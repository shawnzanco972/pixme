/**
 * AUTHORITATIVE database types — generated from the live Supabase project.
 *
 * Regenerate after any schema change with:
 *   npx supabase gen types typescript --project-id ldolbwvkzuhzzgzrpvmj > src/lib/supabase/types.ts
 * (or via the Supabase MCP `generate_typescript_types` tool)
 *
 * Domain-friendly aliases (PixelMap, ShippingAddress, FulfillmentType, etc.)
 * live in ./types.helpers.ts so this file stays a clean, overwritable artifact.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      b2b_orders: {
        Row: {
          amount_paid: number
          company_name: string
          contact_email: string
          created_at: string
          icount_invoice_id: string | null
          id: string
          licenses_purchased: number
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          company_name: string
          contact_email: string
          created_at?: string
          icount_invoice_id?: string | null
          id?: string
          licenses_purchased: number
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          company_name?: string
          contact_email?: string
          created_at?: string
          icount_invoice_id?: string | null
          id?: string
          licenses_purchased?: number
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: []
      }
      b2b_workspaces: {
        Row: {
          active: boolean
          b2b_order_id: string
          created_at: string
          expiration_date: string | null
          id: string
          max_slots: number
          slots_used: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          b2b_order_id: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          max_slots: number
          slots_used?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          b2b_order_id?: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          max_slots?: number
          slots_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_workspaces_b2b_order_id_fkey"
            columns: ["b2b_order_id"]
            isOneToOne: false
            referencedRelation: "b2b_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      b2c_orders: {
        Row: {
          contact_email: string
          created_at: string
          customer_name: string
          fulfillment_type: string
          icount_invoice_id: string | null
          id: string
          image_url: string | null
          pixel_map: Json | null
          shipping_address: Json | null
          status: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          customer_name: string
          fulfillment_type?: string
          icount_invoice_id?: string | null
          id?: string
          image_url?: string | null
          pixel_map?: Json | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          customer_name?: string
          fulfillment_type?: string
          icount_invoice_id?: string | null
          id?: string
          image_url?: string | null
          pixel_map?: Json | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_submissions: {
        Row: {
          created_at: string
          employee_name: string
          id: string
          image_url: string | null
          pixel_map: Json | null
          status: Database["public"]["Enums"]["submission_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          employee_name: string
          id?: string
          image_url?: string | null
          pixel_map?: Json | null
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          employee_name?: string
          id?: string
          image_url?: string | null
          pixel_map?: Json | null
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "b2b_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      order_status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded"
      submission_status: "pending" | "processing" | "ready" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: ["pending", "paid", "fulfilled", "cancelled", "refunded"],
      submission_status: ["pending", "processing", "ready", "rejected"],
    },
  },
} as const

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      archived_quotations: {
        Row: {
          archived_at: string
          archived_by: string
          attachments: Json | null
          client_address: string | null
          client_email: string
          client_name: string
          created_at: string
          currency: string
          discount_type: string | null
          discount_value: number | null
          id: string
          items: Json
          notes: string | null
          original_id: string
          quote_number: string
          status: string | null
          tax_rate: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          archived_at?: string
          archived_by: string
          attachments?: Json | null
          client_address?: string | null
          client_email: string
          client_name: string
          created_at?: string
          currency?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          items: Json
          notes?: string | null
          original_id: string
          quote_number: string
          status?: string | null
          tax_rate?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          archived_at?: string
          archived_by?: string
          attachments?: Json | null
          client_address?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          currency?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          items?: Json
          notes?: string | null
          original_id?: string
          quote_number?: string
          status?: string | null
          tax_rate?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      customer_portal_tokens: {
        Row: {
          client_comment: string | null
          client_response: string | null
          client_response_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          quotation_id: string
          token: string
        }
        Insert: {
          client_comment?: string | null
          client_response?: string | null
          client_response_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean
          quotation_id: string
          token?: string
        }
        Update: {
          client_comment?: string | null
          client_response?: string | null
          client_response_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          quotation_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_tokens_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_tracking: {
        Row: {
          email_type: string
          id: string
          quotation_id: string | null
          read_at: string | null
          read_count: number
          recipient_email: string
          sent_at: string
          tracking_id: string
        }
        Insert: {
          email_type?: string
          id?: string
          quotation_id?: string | null
          read_at?: string | null
          read_count?: number
          recipient_email: string
          sent_at?: string
          tracking_id?: string
        }
        Update: {
          email_type?: string
          id?: string
          quotation_id?: string | null
          read_at?: string | null
          read_count?: number
          recipient_email?: string
          sent_at?: string
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotation_email_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number
          id: string
          quotation_id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          quotation_id: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          quotation_id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_email_attachments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_versions: {
        Row: {
          attachments: Json | null
          change_summary: string | null
          changed_by: string
          client_address: string | null
          client_email: string
          client_name: string
          created_at: string
          currency: string
          discount_type: string | null
          discount_value: number | null
          id: string
          items: Json
          notes: string | null
          quotation_id: string
          tax_rate: number
          valid_until: string
          version_number: number
        }
        Insert: {
          attachments?: Json | null
          change_summary?: string | null
          changed_by: string
          client_address?: string | null
          client_email: string
          client_name: string
          created_at?: string
          currency?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          items: Json
          notes?: string | null
          quotation_id: string
          tax_rate?: number
          valid_until: string
          version_number?: number
        }
        Update: {
          attachments?: Json | null
          change_summary?: string | null
          changed_by?: string
          client_address?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          currency?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          items?: Json
          notes?: string | null
          quotation_id?: string
          tax_rate?: number
          valid_until?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_versions_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          attachments: Json | null
          client_address: string | null
          client_email: string
          client_name: string
          created_at: string
          currency: string
          discount_type: string | null
          discount_value: number | null
          follow_up_notified_at: string | null
          id: string
          items: Json
          notes: string | null
          ordered_items: Json | null
          quote_number: string
          reminder_sent_at: string | null
          status: string | null
          tax_rate: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          attachments?: Json | null
          client_address?: string | null
          client_email: string
          client_name: string
          created_at?: string
          currency?: string
          discount_type?: string | null
          discount_value?: number | null
          follow_up_notified_at?: string | null
          id?: string
          items: Json
          notes?: string | null
          ordered_items?: Json | null
          quote_number: string
          reminder_sent_at?: string | null
          status?: string | null
          tax_rate?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          attachments?: Json | null
          client_address?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          currency?: string
          discount_type?: string | null
          discount_value?: number | null
          follow_up_notified_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          ordered_items?: Json | null
          quote_number?: string
          reminder_sent_at?: string | null
          status?: string | null
          tax_rate?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      recurring_quotations: {
        Row: {
          client_address: string | null
          client_email: string
          client_name: string
          created_at: string
          currency: string
          customer_id: string | null
          discount_type: string | null
          discount_value: number | null
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string
          notes: string | null
          tax_rate: number
          template_items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          client_address?: string | null
          client_email: string
          client_name: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at: string
          notes?: string | null
          tax_rate?: number
          template_items: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          client_address?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string
          notes?: string | null
          tax_rate?: number
          template_items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          attachment_names: string[] | null
          bcc_emails: string[] | null
          body_html: string
          cc_emails: string[] | null
          email_type: string
          id: string
          quotation_id: string | null
          recipient_emails: string[]
          sent_at: string
          subject: string
          user_id: string
        }
        Insert: {
          attachment_names?: string[] | null
          bcc_emails?: string[] | null
          body_html: string
          cc_emails?: string[] | null
          email_type?: string
          id?: string
          quotation_id?: string | null
          recipient_emails: string[]
          sent_at?: string
          subject: string
          user_id: string
        }
        Update: {
          attachment_names?: string[] | null
          bcc_emails?: string[] | null
          body_html?: string
          cc_emails?: string[] | null
          email_type?: string
          id?: string
          quotation_id?: string | null
          recipient_emails?: string[]
          sent_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      unsubscribed_emails: {
        Row: {
          email: string
          id: string
          unsubscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          unsubscribed_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
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
      app_role: ["admin", "user", "viewer"],
    },
  },
} as const

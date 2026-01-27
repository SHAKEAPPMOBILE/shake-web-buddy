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
      activity_joins: {
        Row: {
          activity_id: string | null
          activity_type: string
          city: string
          expires_at: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          activity_type: string
          city: string
          expires_at?: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          activity_type?: string
          city?: string
          expires_at?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_joins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "user_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_messages: {
        Row: {
          activity_type: string
          audio_url: string | null
          city: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          activity_type: string
          audio_url?: string | null
          city: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          activity_type?: string
          audio_url?: string | null
          city?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_read_status: {
        Row: {
          activity_type: string
          city: string
          created_at: string
          id: string
          last_read_at: string
          muted: boolean
          user_id: string
        }
        Insert: {
          activity_type: string
          city: string
          created_at?: string
          id?: string
          last_read_at?: string
          muted?: boolean
          user_id: string
        }
        Update: {
          activity_type?: string
          city?: string
          created_at?: string
          id?: string
          last_read_at?: string
          muted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          activity_type: string
          check_in_date: string
          checked_in_at: string
          city: string
          created_at: string
          id: string
          points_earned: number
          user_id: string
          venue_name: string
        }
        Insert: {
          activity_type: string
          check_in_date?: string
          checked_in_at?: string
          city: string
          created_at?: string
          id?: string
          points_earned?: number
          user_id: string
          venue_name: string
        }
        Update: {
          activity_type?: string
          check_in_date?: string
          checked_in_at?: string
          city?: string
          created_at?: string
          id?: string
          points_earned?: number
          user_id?: string
          venue_name?: string
        }
        Relationships: []
      }
      greetings: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          to_user_id?: string
        }
        Relationships: []
      }
      phone_change_requests: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          last_sent_at: string
          phone_number: string
          user_id: string
          verified_at: string | null
          verify_attempts: number
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          last_sent_at?: string
          phone_number: string
          user_id: string
          verified_at?: string | null
          verify_attempts?: number
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_sent_at?: string
          phone_number?: string
          user_id?: string
          verified_at?: string | null
          verify_attempts?: number
        }
        Relationships: []
      }
      plan_messages: {
        Row: {
          activity_id: string
          audio_url: string | null
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          activity_id: string
          audio_url?: string | null
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          activity_id?: string
          audio_url?: string | null
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_messages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "user_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      private_messages: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          name: string | null
          nationality: string | null
          occupation: string | null
          referral_code: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          name?: string | null
          nationality?: string | null
          occupation?: string | null
          referral_code?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          name?: string | null
          nationality?: string | null
          occupation?: string | null
          referral_code?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles_private: {
        Row: {
          billing_email: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          phone_number: string | null
          premium_override: boolean
          push_notifications_enabled: boolean
          sms_notifications_enabled: boolean
          updated_at: string
          user_id: string
          welcome_bonus_claimed: boolean
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          phone_number?: string | null
          premium_override?: boolean
          push_notifications_enabled?: boolean
          sms_notifications_enabled?: boolean
          updated_at?: string
          user_id: string
          welcome_bonus_claimed?: boolean
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          phone_number?: string | null
          premium_override?: boolean
          push_notifications_enabled?: boolean
          sms_notifications_enabled?: boolean
          updated_at?: string
          user_id?: string
          welcome_bonus_claimed?: boolean
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          points_awarded: number
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_awarded?: number
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_awarded?: number
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      status_videos: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          activity_type: string
          city: string
          created_at: string
          id: string
          is_active: boolean
          note: string | null
          scheduled_for: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          scheduled_for: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          scheduled_for?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          sort_order: number
          updated_at: string
          venue_type: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          sort_order?: number
          updated_at?: string
          venue_type: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
          venue_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_welcome_bonus: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      generate_referral_code: { Args: { user_name: string }; Returns: string }
      get_user_age: { Args: { target_user_id: string }; Returns: number }
      get_user_points: { Args: { target_user_id: string }; Returns: number }
      is_profile_complete: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      users_matched: {
        Args: { user1: string; user2: string }
        Returns: boolean
      }
    }
    Enums: {
      report_reason:
        | "spam"
        | "harassment"
        | "inappropriate_content"
        | "fake_profile"
        | "underage"
        | "other"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
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
      report_reason: [
        "spam",
        "harassment",
        "inappropriate_content",
        "fake_profile",
        "underage",
        "other",
      ],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
    },
  },
} as const

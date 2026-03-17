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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          ai_recommendation: string | null
          best_time_slot: string | null
          best_zone_name: string | null
          created_at: string
          dead_time_pct: number | null
          hours_worked: number | null
          id: string
          report_date: string
          total_distance_km: number | null
          total_earnings: number | null
          total_trips: number | null
          worst_zone_name: string | null
        }
        Insert: {
          ai_recommendation?: string | null
          best_time_slot?: string | null
          best_zone_name?: string | null
          created_at?: string
          dead_time_pct?: number | null
          hours_worked?: number | null
          id?: string
          report_date: string
          total_distance_km?: number | null
          total_earnings?: number | null
          total_trips?: number | null
          worst_zone_name?: string | null
        }
        Update: {
          ai_recommendation?: string | null
          best_time_slot?: string | null
          best_zone_name?: string | null
          created_at?: string
          dead_time_pct?: number | null
          hours_worked?: number | null
          id?: string
          report_date?: string
          total_distance_km?: number | null
          total_earnings?: number | null
          total_trips?: number | null
          worst_zone_name?: string | null
        }
        Relationships: []
      }
      driver_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          trip_date: string | null
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          trip_date?: string | null
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          trip_date?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_notes_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount: number
          created_at: string
          date: string
          duration_min: number | null
          id: string
          km: number
          note: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          duration_min?: number | null
          id?: string
          km?: number
          note?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          duration_min?: number | null
          id?: string
          km?: number
          note?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          boost_multiplier: number
          boost_radius_km: number
          boost_zone_types: string[] | null
          capacity: number | null
          category: string
          city_id: string
          created_at: string
          demand_impact: number
          end_at: string
          expected_attendance: number | null
          id: string
          is_holiday: boolean
          latitude: number
          longitude: number
          name: string
          source: string | null
          start_at: string
          venue: string
          zone_id: string | null
        }
        Insert: {
          boost_multiplier?: number
          boost_radius_km?: number
          boost_zone_types?: string[] | null
          capacity?: number | null
          category?: string
          city_id?: string
          created_at?: string
          demand_impact?: number
          end_at: string
          expected_attendance?: number | null
          id?: string
          is_holiday?: boolean
          latitude: number
          longitude: number
          name: string
          source?: string | null
          start_at: string
          venue: string
          zone_id?: string | null
        }
        Update: {
          boost_multiplier?: number
          boost_radius_km?: number
          boost_zone_types?: string[] | null
          capacity?: number | null
          category?: string
          city_id?: string
          created_at?: string
          demand_impact?: number
          end_at?: string
          expected_attendance?: number | null
          id?: string
          is_holiday?: boolean
          latitude?: number
          longitude?: number
          name?: string
          source?: string | null
          start_at?: string
          venue?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      score_history: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          score: number | null
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          score?: number | null
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          score?: number | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_history_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          calculated_at: string
          event_boost: number | null
          final_score: number | null
          id: string
          score: number | null
          weather_boost: number | null
          zone_id: string
        }
        Insert: {
          calculated_at?: string
          event_boost?: number | null
          final_score?: number | null
          id?: string
          score?: number | null
          weather_boost?: number | null
          zone_id: string
        }
        Update: {
          calculated_at?: string
          event_boost?: number | null
          final_score?: number | null
          id?: string
          score?: number | null
          weather_boost?: number | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      time_slots: {
        Row: {
          city_id: string
          comment: string | null
          created_at: string
          date: string
          demand_score: number
          end_time: string
          id: string
          start_time: string
          zone_id: string
        }
        Insert: {
          city_id: string
          comment?: string | null
          created_at?: string
          date: string
          demand_score?: number
          end_time: string
          id?: string
          start_time: string
          zone_id: string
        }
        Update: {
          city_id?: string
          comment?: string | null
          created_at?: string
          date?: string
          demand_score?: number
          end_time?: string
          id?: string
          start_time?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_slots_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_slots_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          distance_km: number | null
          earnings: number | null
          ended_at: string | null
          experiment: boolean
          id: string
          notes: string | null
          started_at: string
          tips: number | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          earnings?: number | null
          ended_at?: string | null
          experiment?: boolean
          id?: string
          notes?: string | null
          started_at?: string
          tips?: number | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          earnings?: number | null
          ended_at?: string | null
          experiment?: boolean
          id?: string
          notes?: string | null
          started_at?: string
          tips?: number | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          address: string | null
          base_score: number | null
          category: string | null
          city_id: string
          created_at: string
          current_score: number | null
          id: string
          latitude: number
          longitude: number
          name: string
          territory: string | null
          type: Database["public"]["Enums"]["zone_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          base_score?: number | null
          category?: string | null
          city_id: string
          created_at?: string
          current_score?: number | null
          id?: string
          latitude: number
          longitude: number
          name: string
          territory?: string | null
          type?: Database["public"]["Enums"]["zone_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          base_score?: number | null
          category?: string | null
          city_id?: string
          created_at?: string
          current_score?: number | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          territory?: string | null
          type?: Database["public"]["Enums"]["zone_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
      zone_type:
        | "métro"
        | "commercial"
        | "résidentiel"
        | "nightlife"
        | "aéroport"
        | "transport"
        | "médical"
        | "université"
        | "événements"
        | "tourisme"
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
      zone_type: [
        "métro",
        "commercial",
        "résidentiel",
        "nightlife",
        "aéroport",
        "transport",
        "médical",
        "université",
        "événements",
        "tourisme",
      ],
    },
  },
} as const

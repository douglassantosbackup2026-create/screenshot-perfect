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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          description: string
          icon: string
          title: string
        }
        Insert: {
          code: string
          description: string
          icon: string
          title: string
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          title?: string
        }
        Relationships: []
      }
      contributions: {
        Row: {
          amount: number | null
          created_at: string
          destination:
            | Database["public"]["Enums"]["contribution_destination"]
            | null
          id: string
          made_contribution: boolean
          month: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          destination?:
            | Database["public"]["Enums"]["contribution_destination"]
            | null
          id?: string
          made_contribution?: boolean
          month: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          destination?:
            | Database["public"]["Enums"]["contribution_destination"]
            | null
          id?: string
          made_contribution?: boolean
          month?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          consent_marketing: boolean
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          consent_marketing: boolean
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          consent_marketing?: boolean
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      lesson_completions: {
        Row: {
          completed_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_questions: {
        Row: {
          correct_option: string
          explanation: string
          id: string
          lesson_id: string
          options: Json
          position: number
          prompt: string
        }
        Insert: {
          correct_option: string
          explanation: string
          id?: string
          lesson_id: string
          options: Json
          position: number
          prompt: string
        }
        Update: {
          correct_option?: string
          explanation?: string
          id?: string
          lesson_id?: string
          options?: Json
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          action_key: string | null
          body_md: string | null
          day: number
          id: string
          key_points: Json
          objective: string
          program_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sources: Json
          status: Database["public"]["Enums"]["content_status"]
          title: string
        }
        Insert: {
          action_key?: string | null
          body_md?: string | null
          day: number
          id?: string
          key_points?: Json
          objective: string
          program_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sources?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title: string
        }
        Update: {
          action_key?: string | null
          body_md?: string | null
          day?: number
          id?: string
          key_points?: Json
          objective?: string
          program_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sources?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_completions: {
        Row: {
          completed_at: string
          iso_week: string
          mission_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          iso_week: string
          mission_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          iso_week?: string
          mission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "weekly_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_snapshots: {
        Row: {
          created_at: string
          engine_version: string
          id: string
          inputs: Json
          outputs: Json
          plan_id: string
          reason: Database["public"]["Enums"]["snapshot_reason"]
          user_id: string
        }
        Insert: {
          created_at?: string
          engine_version: string
          id?: string
          inputs: Json
          outputs: Json
          plan_id: string
          reason: Database["public"]["Enums"]["snapshot_reason"]
          user_id: string
        }
        Update: {
          created_at?: string
          engine_version?: string
          id?: string
          inputs?: Json
          outputs?: Json
          plan_id?: string
          reason?: Database["public"]["Enums"]["snapshot_reason"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_snapshots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "retirement_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          analytics_consent: boolean
          birth_year: number | null
          created_at: string
          display_name: string | null
          emergency_fund_ready: boolean
          has_overdue_debt: boolean | null
          id: string
          monthly_reminder: boolean
          onboarding_completed_at: string | null
          reminder_day: number
          updated_at: string
          weekly_reminder: boolean
          work_type: Database["public"]["Enums"]["work_type"] | null
        }
        Insert: {
          analytics_consent?: boolean
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          emergency_fund_ready?: boolean
          has_overdue_debt?: boolean | null
          id: string
          monthly_reminder?: boolean
          onboarding_completed_at?: string | null
          reminder_day?: number
          updated_at?: string
          weekly_reminder?: boolean
          work_type?: Database["public"]["Enums"]["work_type"] | null
        }
        Update: {
          analytics_consent?: boolean
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          emergency_fund_ready?: boolean
          has_overdue_debt?: boolean | null
          id?: string
          monthly_reminder?: boolean
          onboarding_completed_at?: string | null
          reminder_day?: number
          updated_at?: string
          weekly_reminder?: boolean
          work_type?: Database["public"]["Enums"]["work_type"] | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_premium: boolean
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          total_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_premium?: boolean
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          total_days: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_premium?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          total_days?: number
        }
        Relationships: []
      }
      question_answers: {
        Row: {
          answered_at: string
          is_correct: boolean
          question_id: string
          selected_option: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          is_correct: boolean
          question_id: string
          selected_option: string
          user_id: string
        }
        Update: {
          answered_at?: string
          is_correct?: boolean
          question_id?: string
          selected_option?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "lesson_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      retirement_plans: {
        Row: {
          costs_aa: number
          created_at: string
          current_age: number
          desired_monthly_income: number
          horizon_age: number
          id: string
          inflation_aa: number
          initial_wealth: number
          inss_estimate: number | null
          is_primary: boolean
          monthly_contribution: number
          name: string
          retirement_age: number
          return_central: number
          return_conservative: number
          return_optimistic: number
          updated_at: string
          user_id: string
        }
        Insert: {
          costs_aa?: number
          created_at?: string
          current_age: number
          desired_monthly_income: number
          horizon_age?: number
          id?: string
          inflation_aa?: number
          initial_wealth?: number
          inss_estimate?: number | null
          is_primary?: boolean
          monthly_contribution?: number
          name?: string
          retirement_age: number
          return_central?: number
          return_conservative?: number
          return_optimistic?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          costs_aa?: number
          created_at?: string
          current_age?: number
          desired_monthly_income?: number
          horizon_age?: number
          id?: string
          inflation_aa?: number
          initial_wealth?: number
          inss_estimate?: number | null
          is_primary?: boolean
          monthly_contribution?: number
          name?: string
          retirement_age?: number
          return_central?: number
          return_conservative?: number
          return_optimistic?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_code: string
          earned_at: string
          user_id: string
        }
        Insert: {
          achievement_code: string
          earned_at?: string
          user_id: string
        }
        Update: {
          achievement_code?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
      }
      user_program_progress: {
        Row: {
          completed_at: string | null
          current_day: number
          program_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_day?: number
          program_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_day?: number
          program_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          best_week_streak: number
          level: number
          total_xp: number
          updated_at: string
          user_id: string
          week_streak: number
        }
        Insert: {
          best_week_streak?: number
          level?: number
          total_xp?: number
          updated_at?: string
          user_id: string
          week_streak?: number
        }
        Update: {
          best_week_streak?: number
          level?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
          week_streak?: number
        }
        Relationships: []
      }
      week_activity: {
        Row: {
          iso_week: string
          status: Database["public"]["Enums"]["week_status"]
          user_id: string
          week_start: string
        }
        Insert: {
          iso_week: string
          status: Database["public"]["Enums"]["week_status"]
          user_id: string
          week_start: string
        }
        Update: {
          iso_week?: string
          status?: Database["public"]["Enums"]["week_status"]
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_missions: {
        Row: {
          action_hint: string | null
          description: string
          id: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
        }
        Insert: {
          action_hint?: string | null
          description: string
          id?: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
        }
        Update: {
          action_hint?: string | null
          description?: string
          id?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          action_type: Database["public"]["Enums"]["xp_action"]
          created_at: string
          id: string
          period_key: string
          ref_id: string | null
          user_id: string
          xp: number
        }
        Insert: {
          action_type: Database["public"]["Enums"]["xp_action"]
          created_at?: string
          id?: string
          period_key: string
          ref_id?: string | null
          user_id: string
          xp: number
        }
        Update: {
          action_type?: Database["public"]["Enums"]["xp_action"]
          created_at?: string
          id?: string
          period_key?: string
          ref_id?: string | null
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _award_xp: {
        Args: {
          p_action: Database["public"]["Enums"]["xp_action"]
          p_key: string
          p_ref?: string
          p_user: string
          p_xp: number
        }
        Returns: number
      }
      _mark_week_active: { Args: { p_user: string }; Returns: undefined }
      _refresh_progress: { Args: { p_user: string }; Returns: Json }
      answer_question: {
        Args: { p_option: string; p_question: string }
        Returns: Json
      }
      complete_lesson: { Args: { p_lesson: string }; Returns: Json }
      complete_weekly_mission: { Args: { p_mission: string }; Returns: Json }
      export_my_data: { Args: never; Returns: Json }
      get_lesson_questions: {
        Args: { p_lesson: string }
        Returns: {
          id: string
          options: Json
          position: number
          prompt: string
        }[]
      }
      get_my_progress: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_contribution: {
        Args: {
          p_amount?: number
          p_destination?: Database["public"]["Enums"]["contribution_destination"]
          p_made: boolean
          p_month: string
          p_note?: string
        }
        Returns: Json
      }
      record_plan_event: {
        Args: {
          p_engine_version: string
          p_inputs: Json
          p_outputs: Json
          p_plan: string
          p_reason: Database["public"]["Enums"]["snapshot_reason"]
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      content_status: "rascunho" | "revisada" | "publicada"
      contribution_destination:
        | "previdencia"
        | "investimentos"
        | "reserva"
        | "outro"
      snapshot_reason:
        | "created"
        | "edit"
        | "quick_review"
        | "life_event"
        | "annual_review"
      week_status: "ativa" | "pausa"
      work_type: "pj" | "autonomo" | "mei" | "clt" | "servidor" | "outro"
      xp_action:
        | "lesson_completed"
        | "quiz_correct"
        | "weekly_mission"
        | "first_plan_created"
        | "contribution_logged"
        | "plan_quick_review"
        | "plan_life_event"
        | "program_completed"
        | "annual_review"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
      content_status: ["rascunho", "revisada", "publicada"],
      contribution_destination: [
        "previdencia",
        "investimentos",
        "reserva",
        "outro",
      ],
      snapshot_reason: [
        "created",
        "edit",
        "quick_review",
        "life_event",
        "annual_review",
      ],
      week_status: ["ativa", "pausa"],
      work_type: ["pj", "autonomo", "mei", "clt", "servidor", "outro"],
      xp_action: [
        "lesson_completed",
        "quiz_correct",
        "weekly_mission",
        "first_plan_created",
        "contribution_logged",
        "plan_quick_review",
        "plan_life_event",
        "program_completed",
        "annual_review",
      ],
    },
  },
} as const

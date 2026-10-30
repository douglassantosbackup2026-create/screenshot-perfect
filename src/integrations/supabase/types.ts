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
      accounts: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance: number
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance?: number
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          opening_balance?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
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
      allocation_targets: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          percent: number
          user_id: string
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          percent: number
          user_id: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          percent?: number
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          billing_enforced: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          billing_enforced?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          billing_enforced?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      asset_valuations: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          month: string
          user_id: string
          value: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          month: string
          user_id: string
          value: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          month?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_valuations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          category: Database["public"]["Enums"]["asset_category"]
          created_at: string
          for_retirement: boolean
          id: string
          name: string
          note: string | null
          source: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          category: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          for_retirement?: boolean
          id?: string
          name: string
          note?: string | null
          source?: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          category?: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          for_retirement?: boolean
          id?: string
          name?: string
          note?: string | null
          source?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      budget_assignments: {
        Row: {
          amount: number
          envelope: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          envelope: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          envelope?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_templates: {
        Row: {
          amount: number | null
          created_at: string
          deadline: string | null
          envelope: string
          id: string
          kind: Database["public"]["Enums"]["budget_template_kind"]
          percent: number | null
          target: number | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          deadline?: string | null
          envelope: string
          id?: string
          kind: Database["public"]["Enums"]["budget_template_kind"]
          percent?: number | null
          target?: number | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          deadline?: string | null
          envelope?: string
          id?: string
          kind?: Database["public"]["Enums"]["budget_template_kind"]
          percent?: number | null
          target?: number | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      category_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          op: Database["public"]["Enums"]["rule_op"]
          rename_to: string | null
          user_id: string
          value: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          op: Database["public"]["Enums"]["rule_op"]
          rename_to?: string | null
          user_id: string
          value: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          op?: Database["public"]["Enums"]["rule_op"]
          rename_to?: string | null
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          description: string
          metric: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          target: number
          title: string
          window_days: number
        }
        Insert: {
          description: string
          metric: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          target: number
          title: string
          window_days: number
        }
        Update: {
          description?: string
          metric?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          target?: number
          title?: string
          window_days?: number
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
      daily_mission_completions: {
        Row: {
          completed_at: string
          day: string
          kind: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          day: string
          kind: string
          user_id: string
        }
        Update: {
          completed_at?: string
          day?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      day_activity: {
        Row: {
          day: string
          user_id: string
        }
        Insert: {
          day: string
          user_id: string
        }
        Update: {
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          plan: string
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          plan: string
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          plan?: string
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          id: string
          kind: string
          target: number | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          kind: string
          target?: number | null
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          kind?: string
          target?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          asset_id: string
          created_at: string
          id: string
          name: string
          price: number
          price_updated_at: string
          user_id: string
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          asset_id: string
          created_at?: string
          id?: string
          name: string
          price?: number
          price_updated_at?: string
          user_id: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          asset_id?: string
          created_at?: string
          id?: string
          name?: string
          price?: number
          price_updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_links: {
        Row: {
          discreet: boolean
          last_tx_id: string | null
          phone: string
          proactive_opt_in: boolean
          updated_at: string
          user_id: string
          verified_at: string
        }
        Insert: {
          discreet?: boolean
          last_tx_id?: string | null
          phone: string
          proactive_opt_in?: boolean
          updated_at?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          discreet?: boolean
          last_tx_id?: string | null
          phone?: string
          proactive_opt_in?: boolean
          updated_at?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      whatsapp_link_codes: {
        Row: {
          code: string
          expires_at: string
          user_id: string
        }
        Insert: {
          code: string
          expires_at: string
          user_id: string
        }
        Update: {
          code?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          id: string
          received_at: string
        }
        Insert: {
          id: string
          received_at?: string
        }
        Update: {
          id?: string
          received_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          consent_marketing: boolean
          created_at: string
          email: string
          id: string
          simulation: Json | null
          source: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          consent_marketing: boolean
          created_at?: string
          email: string
          id?: string
          simulation?: Json | null
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          consent_marketing?: boolean
          created_at?: string
          email?: string
          id?: string
          simulation?: Json | null
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
          placement: boolean
          position: number
          prompt: string
        }
        Insert: {
          correct_option: string
          explanation: string
          id?: string
          lesson_id: string
          options: Json
          placement?: boolean
          position: number
          prompt: string
        }
        Update: {
          correct_option?: string
          explanation?: string
          id?: string
          lesson_id?: string
          options?: Json
          placement?: boolean
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
          journey_order: number | null
          key_points: Json
          objective: string
          program_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sources: Json
          status: Database["public"]["Enums"]["content_status"]
          title: string
          unit: number | null
        }
        Insert: {
          action_key?: string | null
          body_md?: string | null
          day: number
          id?: string
          journey_order?: number | null
          key_points?: Json
          objective: string
          program_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sources?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          unit?: number | null
        }
        Update: {
          action_key?: string | null
          body_md?: string | null
          day?: number
          id?: string
          journey_order?: number | null
          key_points?: Json
          objective?: string
          program_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sources?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          unit?: number | null
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
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          period: string
          plan: string
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id: string
          period: string
          plan: string
          status: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          period?: string
          plan?: string
          status?: string
          user_id?: string
        }
        Relationships: []
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
          goal_income: number | null
          goal_retirement_age: number | null
          has_overdue_debt: boolean | null
          hide_values: boolean
          id: string
          missing_fields: string[]
          monthly_reminder: boolean
          objective: string | null
          onboarding_completed_at: string | null
          reminder_day: number
          review_cadence: string
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
          goal_income?: number | null
          goal_retirement_age?: number | null
          has_overdue_debt?: boolean | null
          hide_values?: boolean
          id: string
          missing_fields?: string[]
          monthly_reminder?: boolean
          objective?: string | null
          onboarding_completed_at?: string | null
          reminder_day?: number
          review_cadence?: string
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
          goal_income?: number | null
          goal_retirement_age?: number | null
          has_overdue_debt?: boolean | null
          hide_values?: boolean
          id?: string
          missing_fields?: string[]
          monthly_reminder?: boolean
          objective?: string | null
          onboarding_completed_at?: string | null
          reminder_day?: number
          review_cadence?: string
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
      recurring_rules: {
        Row: {
          account_id: string
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          end_date: string | null
          every: number
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          note: string | null
          payee: string
          start_date: string
          user_id: string
          weekend: Database["public"]["Enums"]["weekend_rule"]
        }
        Insert: {
          account_id: string
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          every?: number
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          note?: string | null
          payee: string
          start_date: string
          user_id: string
          weekend?: Database["public"]["Enums"]["weekend_rule"]
        }
        Update: {
          account_id?: string
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          every?: number
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          note?: string | null
          payee?: string
          start_date?: string
          user_id?: string
          weekend?: Database["public"]["Enums"]["weekend_rule"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          kind: string
          period_key: string
          sent_at: string
          user_id: string
        }
        Insert: {
          kind: string
          period_key: string
          sent_at?: string
          user_id: string
        }
        Update: {
          kind?: string
          period_key?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
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
      subscriptions: {
        Row: {
          period: string
          plan: string
          preapproval_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          period: string
          plan: string
          preapproval_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          period?: string
          plan?: string
          preapproval_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          created_at: string
          date: string
          fees: number
          holding_id: string
          id: string
          quantity: number
          type: Database["public"]["Enums"]["trade_type"]
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          fees?: number
          holding_id: string
          id?: string
          quantity?: number
          type: Database["public"]["Enums"]["trade_type"]
          unit_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          fees?: number
          holding_id?: string
          id?: string
          quantity?: number
          type?: Database["public"]["Enums"]["trade_type"]
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          contribution_id: string | null
          created_at: string
          date: string
          id: string
          imported_id: string | null
          note: string | null
          occurrence_date: string | null
          payee: string
          recurring_id: string | null
          source: Database["public"]["Enums"]["tx_source"]
          transfer_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          contribution_id?: string | null
          created_at?: string
          date: string
          id?: string
          imported_id?: string | null
          note?: string | null
          occurrence_date?: string | null
          payee: string
          recurring_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          transfer_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          contribution_id?: string | null
          created_at?: string
          date?: string
          id?: string
          imported_id?: string | null
          note?: string | null
          occurrence_date?: string | null
          payee?: string
          recurring_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          transfer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      user_challenges: {
        Row: {
          challenge_slug: string
          completed_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          challenge_slug: string
          completed_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          challenge_slug?: string
          completed_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_program_progress: {
        Row: {
          completed_at: string | null
          current_day: number
          program_id: string
          started_at: string
          tested_out_units: number[]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_day?: number
          program_id: string
          started_at?: string
          tested_out_units?: number[]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_day?: number
          program_id?: string
          started_at?: string
          tested_out_units?: number[]
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
      user_state: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          best_day_streak: number
          best_week_streak: number
          day_streak: number
          level: number
          total_xp: number
          updated_at: string
          user_id: string
          week_streak: number
        }
        Insert: {
          best_day_streak?: number
          best_week_streak?: number
          day_streak?: number
          level?: number
          total_xp?: number
          updated_at?: string
          user_id: string
          week_streak?: number
        }
        Update: {
          best_day_streak?: number
          best_week_streak?: number
          day_streak?: number
          level?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
          week_streak?: number
        }
        Relationships: []
      }
      wealth_entries: {
        Row: {
          breakdown: Json | null
          created_at: string
          id: string
          month: string
          note: string | null
          previdencia: number | null
          total: number
          user_id: string
        }
        Insert: {
          breakdown?: Json | null
          created_at?: string
          id?: string
          month: string
          note?: string | null
          previdencia?: number | null
          total: number
          user_id: string
        }
        Update: {
          breakdown?: Json | null
          created_at?: string
          id?: string
          month?: string
          note?: string | null
          previdencia?: number | null
          total?: number
          user_id?: string
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
      _adjust_weekend: {
        Args: {
          p_date: string
          p_rule: Database["public"]["Enums"]["weekend_rule"]
        }
        Returns: string
      }
      admin_find_users: {
        Args: { p_query: string }
        Returns: {
          created_at: string
          display_name: string | null
          email: string
          last_sign_in_at: string | null
          payments: Json
          plan: string | null
          preapproval_id: string | null
          subscription_period: string | null
          subscription_status: string | null
          subscription_updated_at: string | null
          user_id: string
          valid_until: string | null
        }[]
      }
      admin_save_lesson: {
        Args: { p_lesson: Json; p_program_slug: string }
        Returns: string
      }
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
      _challenge_count: {
        Args: { p_from: string; p_metric: string; p_to: string; p_user: string }
        Returns: number
      }
      _daily_mission_kind: { Args: { p_user: string }; Returns: string }
      _lesson_unlocked: {
        Args: { p_lesson: string; p_user: string }
        Returns: boolean
      }
      _mark_week_active: { Args: { p_user: string }; Returns: undefined }
      _nominal_date: {
        Args: {
          k: number
          p_rule: Database["public"]["Tables"]["recurring_rules"]["Row"]
        }
        Returns: string
      }
      _refresh_progress: { Args: { p_user: string }; Returns: Json }
      _refresh_progress_core: { Args: { p_user: string }; Returns: Json }
      _settle_daily_mission: {
        Args: { p_kind: string; p_user: string }
        Returns: number
      }
      answer_question: {
        Args: { p_option: string; p_question: string }
        Returns: Json
      }
      complete_daily_mission: {
        Args: { p_answers?: Json; p_kind: string }
        Returns: Json
      }
      complete_goal: { Args: { p_goal: string }; Returns: Json }
      complete_lesson: { Args: { p_lesson: string }; Returns: Json }
      complete_month_close: { Args: never; Returns: Json }
      complete_weekly_mission: { Args: { p_mission: string }; Returns: Json }
      create_goal: {
        Args: {
          p_deadline?: string
          p_kind: string
          p_target?: number
          p_title: string
        }
        Returns: Json
      }
      create_transfer: {
        Args: {
          p_amount: number
          p_contribution?: Database["public"]["Enums"]["contribution_destination"]
          p_date: string
          p_from: string
          p_note?: string
          p_to: string
        }
        Returns: Json
      }
      credit_payment: {
        Args: {
          p_amount_cents: number
          p_id: string
          p_period: string
          p_plan: string
          p_user: string
        }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: undefined }
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
      has_active_entitlement: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_transactions: {
        Args: { p_account: string; p_fresh: Json; p_matched?: Json }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
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
      log_wealth: {
        Args: {
          p_breakdown?: Json
          p_month: string
          p_note?: string
          p_previdencia?: number
          p_total: number
        }
        Returns: Json
      }
      log_wealth_from_assets: { Args: { p_note?: string }; Returns: Json }
      materialize_recurring: { Args: never; Returns: number }
      month_close_status: { Args: { p_user?: string }; Returns: Json }
      move_budget: {
        Args: {
          p_amount: number
          p_from: string
          p_month: string
          p_to: string
        }
        Returns: undefined
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
      reminder_recipients: {
        Args: never
        Returns: {
          display_name: string
          email: string
          monthly_reminder: boolean
          reminder_day: number
          user_id: string
          weekly_reminder: boolean
        }[]
      }
      seed_default_categories: { Args: never; Returns: undefined }
      set_allocation_targets: { Args: { p_targets: Json }; Returns: Json }
      set_asset_value_from_holdings: {
        Args: { p_asset: string; p_value: number }
        Returns: undefined
      }
      start_challenge: { Args: { p_slug: string }; Returns: Json }
      submit_placement: {
        Args: { p_answers: Json; p_unit: number }
        Returns: Json
      }
      upsert_asset: {
        Args: {
          p_category: Database["public"]["Enums"]["asset_category"]
          p_for_retirement: boolean
          p_id?: string
          p_name: string
          p_note?: string
          p_value: number
        }
        Returns: string
      }
    }
    Enums: {
      account_kind:
        | "corrente"
        | "poupanca"
        | "carteira"
        | "cartao"
        | "investimento"
        | "previdencia"
        | "emprestimo"
      app_role: "admin" | "user"
      asset_category:
        | "pgbl"
        | "vgbl"
        | "investimentos"
        | "reserva"
        | "imovel"
        | "beneficio"
        | "divida"
        | "outro"
      asset_class:
        | "previdencia"
        | "renda_fixa"
        | "acoes"
        | "fiis"
        | "exterior"
        | "cripto"
        | "outros"
      budget_template_kind: "fixo" | "ate_data" | "percentual"
      category_kind: "receita" | "despesa"
      content_status: "rascunho" | "revisada" | "publicada"
      contribution_destination:
        | "previdencia"
        | "investimentos"
        | "reserva"
        | "outro"
      recurrence_frequency: "semanal" | "mensal" | "anual"
      rule_op: "contem" | "igual"
      snapshot_reason:
        | "created"
        | "edit"
        | "quick_review"
        | "life_event"
        | "annual_review"
      trade_type: "compra" | "venda" | "provento"
      tx_source: "manual" | "importado" | "recorrente"
      week_status: "ativa" | "pausa"
      weekend_rule: "manter" | "antes" | "depois"
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
        | "wealth_logged"
        | "goal_created"
        | "goal_completed"
        | "challenge_completed"
        | "daily_mission"
        | "statement_imported"
        | "budget_planned"
        | "investment_logged"
        | "month_closed"
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
      account_kind: [
        "corrente",
        "poupanca",
        "carteira",
        "cartao",
        "investimento",
        "previdencia",
        "emprestimo",
      ],
      app_role: ["admin", "user"],
      asset_category: [
        "pgbl",
        "vgbl",
        "investimentos",
        "reserva",
        "imovel",
        "beneficio",
        "divida",
        "outro",
      ],
      asset_class: [
        "previdencia",
        "renda_fixa",
        "acoes",
        "fiis",
        "exterior",
        "cripto",
        "outros",
      ],
      budget_template_kind: ["fixo", "ate_data", "percentual"],
      category_kind: ["receita", "despesa"],
      content_status: ["rascunho", "revisada", "publicada"],
      contribution_destination: [
        "previdencia",
        "investimentos",
        "reserva",
        "outro",
      ],
      recurrence_frequency: ["semanal", "mensal", "anual"],
      rule_op: ["contem", "igual"],
      snapshot_reason: [
        "created",
        "edit",
        "quick_review",
        "life_event",
        "annual_review",
      ],
      trade_type: ["compra", "venda", "provento"],
      tx_source: ["manual", "importado", "recorrente"],
      week_status: ["ativa", "pausa"],
      weekend_rule: ["manter", "antes", "depois"],
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
        "wealth_logged",
        "goal_created",
        "goal_completed",
        "challenge_completed",
        "daily_mission",
        "statement_imported",
        "budget_planned",
        "investment_logged",
        "month_closed",
      ],
    },
  },
} as const

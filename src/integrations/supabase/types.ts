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
      achievement_deadlines: {
        Row: {
          created_at: string | null
          id: string
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          set_at: string | null
          set_by: string | null
          submission_deadline: string
          updated_at: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          set_at?: string | null
          set_by?: string | null
          submission_deadline: string
          updated_at?: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          set_at?: string | null
          set_by?: string | null
          submission_deadline?: string
          updated_at?: string | null
          week_end_date?: string
          week_number?: number
          week_start_date?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievement_deadlines_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_reviews: {
        Row: {
          admin_id: string
          date: string
          decision: string | null
          employee_id: string
          id: string
          is_locked: boolean | null
          notes: string | null
          review_type: string
          reviewed_at: string | null
        }
        Insert: {
          admin_id: string
          date: string
          decision?: string | null
          employee_id: string
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          review_type: string
          reviewed_at?: string | null
        }
        Update: {
          admin_id?: string
          date?: string
          decision?: string | null
          employee_id?: string
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          review_type?: string
          reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_reviews_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          api_key: string | null
          created_at: string | null
          fallback_model_id: string | null
          id: string
          is_active: boolean | null
          model_id: string
          provider: string
          settings: Json | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string | null
          fallback_model_id?: string | null
          id?: string
          is_active?: boolean | null
          model_id: string
          provider: string
          settings?: Json | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string | null
          fallback_model_id?: string | null
          id?: string
          is_active?: boolean | null
          model_id?: string
          provider?: string
          settings?: Json | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_employee_scores: {
        Row: {
          ai_analysis: string | null
          ai_call_duration_ms: number | null
          ai_score: number | null
          ai_status: string | null
          analysis_timestamp: string | null
          consistency_score: number | null
          date: string
          id: string
          last_updated: string | null
          model_version: string | null
          plan_quality_score: number | null
          punctuality_score: number | null
          report_quality_score: number | null
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          ai_call_duration_ms?: number | null
          ai_score?: number | null
          ai_status?: string | null
          analysis_timestamp?: string | null
          consistency_score?: number | null
          date: string
          id?: string
          last_updated?: string | null
          model_version?: string | null
          plan_quality_score?: number | null
          punctuality_score?: number | null
          report_quality_score?: number | null
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          ai_call_duration_ms?: number | null
          ai_score?: number | null
          ai_status?: string | null
          analysis_timestamp?: string | null
          consistency_score?: number | null
          date?: string
          id?: string
          last_updated?: string | null
          model_version?: string | null
          plan_quality_score?: number | null
          punctuality_score?: number | null
          report_quality_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_employee_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_monthly_reports: {
        Row: {
          ai_model: string | null
          avg_org_score: number | null
          created_at: string | null
          detailed_analysis: string | null
          executive_summary: string | null
          generated_at: string | null
          id: string
          improvement_from_last_month: number | null
          month: string
          quarterly_projection: string | null
          strategic_concerns: Json | null
          strategic_recommendations: Json | null
          success_stories: Json | null
          token_usage: number | null
          top_departments: Json | null
          total_active_employees: number | null
        }
        Insert: {
          ai_model?: string | null
          avg_org_score?: number | null
          created_at?: string | null
          detailed_analysis?: string | null
          executive_summary?: string | null
          generated_at?: string | null
          id?: string
          improvement_from_last_month?: number | null
          month: string
          quarterly_projection?: string | null
          strategic_concerns?: Json | null
          strategic_recommendations?: Json | null
          success_stories?: Json | null
          token_usage?: number | null
          top_departments?: Json | null
          total_active_employees?: number | null
        }
        Update: {
          ai_model?: string | null
          avg_org_score?: number | null
          created_at?: string | null
          detailed_analysis?: string | null
          executive_summary?: string | null
          generated_at?: string | null
          id?: string
          improvement_from_last_month?: number | null
          month?: string
          quarterly_projection?: string | null
          strategic_concerns?: Json | null
          strategic_recommendations?: Json | null
          success_stories?: Json | null
          token_usage?: number | null
          top_departments?: Json | null
          total_active_employees?: number | null
        }
        Relationships: []
      }
      ai_nudges: {
        Row: {
          ai_score_at_trigger: number | null
          created_at: string | null
          date: string
          delivered_at: string | null
          dismissed_at: string | null
          hour_of_day: number | null
          id: string
          message: string
          nudge_type: string
          read_at: string | null
          target_audience: string
          trigger_reason: string
          user_id: string
        }
        Insert: {
          ai_score_at_trigger?: number | null
          created_at?: string | null
          date: string
          delivered_at?: string | null
          dismissed_at?: string | null
          hour_of_day?: number | null
          id?: string
          message: string
          nudge_type: string
          read_at?: string | null
          target_audience: string
          trigger_reason: string
          user_id: string
        }
        Update: {
          ai_score_at_trigger?: number | null
          created_at?: string | null
          date?: string
          delivered_at?: string | null
          dismissed_at?: string | null
          hour_of_day?: number | null
          id?: string
          message?: string
          nudge_type?: string
          read_at?: string | null
          target_audience?: string
          trigger_reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_nudges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          function_name: string
          id: string
          meta: Json | null
          model: string | null
          provider: string | null
          status: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          function_name: string
          id?: string
          meta?: Json | null
          model?: string | null
          provider?: string | null
          status?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          function_name?: string
          id?: string
          meta?: Json | null
          model?: string | null
          provider?: string | null
          status?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: []
      }
      ai_weekly_predictions: {
        Row: {
          ai_model: string | null
          at_risk_employees: Json | null
          created_at: string | null
          department_insights: Json | null
          full_analysis: string | null
          generated_at: string | null
          id: string
          org_avg_score: number | null
          org_prediction: string
          org_trend: string
          processing_time_ms: number | null
          recommended_actions: Json | null
          top_performers: Json | null
          week_end: string
          week_start: string
        }
        Insert: {
          ai_model?: string | null
          at_risk_employees?: Json | null
          created_at?: string | null
          department_insights?: Json | null
          full_analysis?: string | null
          generated_at?: string | null
          id?: string
          org_avg_score?: number | null
          org_prediction: string
          org_trend: string
          processing_time_ms?: number | null
          recommended_actions?: Json | null
          top_performers?: Json | null
          week_end: string
          week_start: string
        }
        Update: {
          ai_model?: string | null
          at_risk_employees?: Json | null
          created_at?: string | null
          department_insights?: Json | null
          full_analysis?: string | null
          generated_at?: string | null
          id?: string
          org_avg_score?: number | null
          org_prediction?: string
          org_trend?: string
          processing_time_ms?: number | null
          recommended_actions?: Json | null
          top_performers?: Json | null
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          is_marquee: boolean
          message: string
          priority: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean
          is_marquee?: boolean
          message: string
          priority?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          is_marquee?: boolean
          message?: string
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_lock_overrides: {
        Row: {
          admin_id: string | null
          created_at: string | null
          granted_by: string | null
          id: string
          override_date: string
          override_type: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          override_date: string
          override_type?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          override_date?: string
          override_type?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_lock_overrides_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_lock_overrides_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_lock_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          id: string
          ip_address: unknown
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          record_id: string | null
          record_type: string
          remarks: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          record_id?: string | null
          record_type: string
          remarks?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          record_id?: string | null
          record_type?: string
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_template_items: {
        Row: {
          category: string
          created_at: string
          default_quantity: number | null
          default_unit_cost: number | null
          id: string
          material_name: string
          phase_name: string | null
          sort_order: number | null
          specification: string | null
          template_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_quantity?: number | null
          default_unit_cost?: number | null
          id?: string
          material_name: string
          phase_name?: string | null
          sort_order?: number | null
          specification?: string | null
          template_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_quantity?: number | null
          default_unit_cost?: number | null
          id?: string
          material_name?: string
          phase_name?: string | null
          sort_order?: number | null
          specification?: string | null
          template_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boq_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "boq_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean | null
          updated_at: string
          vertical_code: string
          vertical_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          updated_at?: string
          vertical_code: string
          vertical_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          updated_at?: string
          vertical_code?: string
          vertical_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "boq_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_batches: {
        Row: {
          bank_ref_no: string | null
          batch_id: string
          cover_note_submitted_at: string | null
          cover_note_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          status: string
          total_amount: number
          total_transactions: number
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bank_ref_no?: string | null
          batch_id: string
          cover_note_submitted_at?: string | null
          cover_note_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          total_amount?: number
          total_transactions?: number
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bank_ref_no?: string | null
          batch_id?: string
          cover_note_submitted_at?: string | null
          cover_note_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          total_amount?: number
          total_transactions?: number
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      cafe_ads: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_active: boolean | null
          message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          message?: string | null
        }
        Relationships: []
      }
      cafe_daily_closings: {
        Row: {
          closing_date: string
          closing_manager_id: string | null
          closing_notes: string | null
          created_at: string | null
          id: string
          total_orders: number | null
          total_revenue: number | null
        }
        Insert: {
          closing_date: string
          closing_manager_id?: string | null
          closing_notes?: string | null
          created_at?: string | null
          id?: string
          total_orders?: number | null
          total_revenue?: number | null
        }
        Update: {
          closing_date?: string
          closing_manager_id?: string | null
          closing_notes?: string | null
          created_at?: string | null
          id?: string
          total_orders?: number | null
          total_revenue?: number | null
        }
        Relationships: []
      }
      cafe_master_menu: {
        Row: {
          allergens: string | null
          average_rating: number | null
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_non_veg: boolean | null
          is_veg: boolean | null
          item_description: string | null
          item_image_url: string | null
          item_name: string
          prep_time_minutes: number | null
          price: number
          review_count: number | null
          spice_level: string | null
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string | null
          average_rating?: number | null
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_non_veg?: boolean | null
          is_veg?: boolean | null
          item_description?: string | null
          item_image_url?: string | null
          item_name: string
          prep_time_minutes?: number | null
          price: number
          review_count?: number | null
          spice_level?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string | null
          average_rating?: number | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_non_veg?: boolean | null
          is_veg?: boolean | null
          item_description?: string | null
          item_image_url?: string | null
          item_name?: string
          prep_time_minutes?: number | null
          price?: number
          review_count?: number | null
          spice_level?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_master_menu_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_menu_items: {
        Row: {
          allergens: string | null
          available_date: string
          available_from: string | null
          available_to: string | null
          average_rating: number | null
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          is_available: boolean | null
          is_gluten_free: boolean | null
          is_non_veg: boolean | null
          is_veg: boolean | null
          is_vegan: boolean | null
          item_description: string | null
          item_image_url: string | null
          item_name: string
          low_stock_alert: number | null
          master_item_id: string | null
          out_of_stock: boolean | null
          prep_time_minutes: number | null
          price: number
          review_count: number | null
          spice_level: string | null
          stock_quantity: number | null
          total_orders: number | null
          unlimited_stock: boolean | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string | null
          available_date: string
          available_from?: string | null
          available_to?: string | null
          average_rating?: number | null
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_available?: boolean | null
          is_gluten_free?: boolean | null
          is_non_veg?: boolean | null
          is_veg?: boolean | null
          is_vegan?: boolean | null
          item_description?: string | null
          item_image_url?: string | null
          item_name: string
          low_stock_alert?: number | null
          master_item_id?: string | null
          out_of_stock?: boolean | null
          prep_time_minutes?: number | null
          price: number
          review_count?: number | null
          spice_level?: string | null
          stock_quantity?: number | null
          total_orders?: number | null
          unlimited_stock?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string | null
          available_date?: string
          available_from?: string | null
          available_to?: string | null
          average_rating?: number | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_available?: boolean | null
          is_gluten_free?: boolean | null
          is_non_veg?: boolean | null
          is_veg?: boolean | null
          is_vegan?: boolean | null
          item_description?: string | null
          item_image_url?: string | null
          item_name?: string
          low_stock_alert?: number | null
          master_item_id?: string | null
          out_of_stock?: boolean | null
          prep_time_minutes?: number | null
          price?: number
          review_count?: number | null
          spice_level?: string | null
          stock_quantity?: number | null
          total_orders?: number | null
          unlimited_stock?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_menu_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_menu_items_master_item_id_fkey"
            columns: ["master_item_id"]
            isOneToOne: false
            referencedRelation: "cafe_master_menu"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_order_items: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          item_price: number
          menu_item_id: string
          order_id: string
          quantity: number
          special_request: string | null
          subtotal: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          item_price: number
          menu_item_id: string
          order_id: string
          quantity?: number
          special_request?: string | null
          subtotal: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          item_price?: number
          menu_item_id?: string
          order_id?: string
          quantity?: number
          special_request?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "cafe_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "cafe_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "cafe_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_orders: {
        Row: {
          advance_order_for_date: string | null
          batch_time: string | null
          can_cancel: boolean | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          collected_at: string | null
          created_at: string | null
          customer_department: string | null
          customer_id: string | null
          customer_name: string
          feedback: string | null
          id: string
          is_advance_order: boolean | null
          marked_collected_by: string | null
          order_date: string
          order_number: string
          order_status: string
          order_time: string
          payment_proof_uploaded_at: string | null
          payment_proof_url: string | null
          payment_rejection_reason: string | null
          payment_status: string
          payment_verified_at: string | null
          payment_verified_by: string | null
          pickup_type: string
          preparation_completed_at: string | null
          preparation_started_at: string | null
          rated_at: string | null
          rating: number | null
          ready_at: string | null
          scheduled_pickup_time: string | null
          special_instructions: string | null
          status_updated_at: string | null
          total_amount: number
          trusted_order: boolean | null
          updated_at: string | null
        }
        Insert: {
          advance_order_for_date?: string | null
          batch_time?: string | null
          can_cancel?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          collected_at?: string | null
          created_at?: string | null
          customer_department?: string | null
          customer_id?: string | null
          customer_name: string
          feedback?: string | null
          id?: string
          is_advance_order?: boolean | null
          marked_collected_by?: string | null
          order_date?: string
          order_number: string
          order_status?: string
          order_time?: string
          payment_proof_uploaded_at?: string | null
          payment_proof_url?: string | null
          payment_rejection_reason?: string | null
          payment_status?: string
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          pickup_type?: string
          preparation_completed_at?: string | null
          preparation_started_at?: string | null
          rated_at?: string | null
          rating?: number | null
          ready_at?: string | null
          scheduled_pickup_time?: string | null
          special_instructions?: string | null
          status_updated_at?: string | null
          total_amount: number
          trusted_order?: boolean | null
          updated_at?: string | null
        }
        Update: {
          advance_order_for_date?: string | null
          batch_time?: string | null
          can_cancel?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          collected_at?: string | null
          created_at?: string | null
          customer_department?: string | null
          customer_id?: string | null
          customer_name?: string
          feedback?: string | null
          id?: string
          is_advance_order?: boolean | null
          marked_collected_by?: string | null
          order_date?: string
          order_number?: string
          order_status?: string
          order_time?: string
          payment_proof_uploaded_at?: string | null
          payment_proof_url?: string | null
          payment_rejection_reason?: string | null
          payment_status?: string
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          pickup_type?: string
          preparation_completed_at?: string | null
          preparation_started_at?: string | null
          rated_at?: string | null
          rating?: number | null
          ready_at?: string | null
          scheduled_pickup_time?: string | null
          special_instructions?: string | null
          status_updated_at?: string | null
          total_amount?: number
          trusted_order?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_orders_marked_collected_by_fkey"
            columns: ["marked_collected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_orders_payment_verified_by_fkey"
            columns: ["payment_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_payment_info: {
        Row: {
          account_holder_name: string | null
          alternate_upi_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          payment_instructions: string | null
          phone_number: string | null
          qr_code_url: string | null
          updated_at: string | null
          upi_id: string
        }
        Insert: {
          account_holder_name?: string | null
          alternate_upi_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          payment_instructions?: string | null
          phone_number?: string | null
          qr_code_url?: string | null
          updated_at?: string | null
          upi_id: string
        }
        Update: {
          account_holder_name?: string | null
          alternate_upi_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          payment_instructions?: string | null
          phone_number?: string | null
          qr_code_url?: string | null
          updated_at?: string | null
          upi_id?: string
        }
        Relationships: []
      }
      cafe_settings: {
        Row: {
          id: string
          is_open: boolean | null
          merchant_name: string | null
          qr_code_url: string | null
          updated_at: string
          updated_by: string | null
          upi_id: string
        }
        Insert: {
          id?: string
          is_open?: boolean | null
          merchant_name?: string | null
          qr_code_url?: string | null
          updated_at?: string
          updated_by?: string | null
          upi_id: string
        }
        Update: {
          id?: string
          is_open?: boolean | null
          merchant_name?: string | null
          qr_code_url?: string | null
          updated_at?: string
          updated_by?: string | null
          upi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_activity: {
        Row: {
          actor_id: string | null
          content: string | null
          created_at: string | null
          entity_id: string | null
          id: string
          is_read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          content?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          is_read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          content?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          is_read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_call_signals: {
        Row: {
          call_id: string
          created_at: string | null
          id: string
          payload: Json
          receiver_id: string
          sender_id: string
          type: string
        }
        Insert: {
          call_id: string
          created_at?: string | null
          id?: string
          payload?: Json
          receiver_id: string
          sender_id: string
          type: string
        }
        Update: {
          call_id?: string
          created_at?: string | null
          id?: string
          payload?: Json
          receiver_id?: string
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "chat_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_call_signals_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_call_signals_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_calls: {
        Row: {
          caller_id: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          receiver_id: string
          status: string
          system_message_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          caller_id: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          receiver_id: string
          status?: string
          system_message_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          caller_id?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          receiver_id?: string
          status?: string
          system_message_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_calls_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_calls_system_message_id_fkey"
            columns: ["system_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_connections: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_connections_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_connections_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          media_url: string | null
          metadata: Json | null
          reply_to_id: string | null
          sender_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_url?: string | null
          metadata?: Json | null
          reply_to_id?: string | null
          sender_id: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_url?: string | null
          metadata?: Json | null
          reply_to_id?: string | null
          sender_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          joined_at: string | null
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_collections: {
        Row: {
          amount: number
          collection_date: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          payment_mode: string
          project_id: string
          reference_number: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          collection_date?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_mode?: string
          project_id: string
          reference_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          collection_date?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_mode?: string
          project_id?: string
          reference_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_escalation_timeline: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          escalation_id: string
          id: string
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          escalation_id: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          escalation_id?: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_escalation_timeline_escalation_id_fkey"
            columns: ["escalation_id"]
            isOneToOne: false
            referencedRelation: "client_escalations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalation_timeline_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_escalations: {
        Row: {
          ack_deadline: string
          ack_late: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_by_boi_id: string | null
          assigned_gmo_id: string | null
          assigned_layer_1_id: string | null
          assigned_layer_2_id: string | null
          assigned_layer_3_id: string | null
          assigned_role: string | null
          assigned_smo_id: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          assigned_user_ids: string[] | null
          assigned_user_names: string[] | null
          bucket: string | null
          business_unit: string | null
          call_record_url: string | null
          category: string | null
          ceo_id: string | null
          client_name: string
          client_phone: string | null
          closed_by_admin_id: string | null
          closure_admin_id: string | null
          closure_approval_status: string | null
          closure_approved_at: string | null
          closure_approved_by: string | null
          closure_verified_at: string | null
          created_at: string
          created_by: string
          current_layer: string | null
          current_level: string | null
          current_owner: string
          department: string
          escalation_proof_url: string | null
          escalation_type: string | null
          evidence_url: string | null
          forwarded_to_gm_at: string | null
          gm_ack_at: string | null
          gm_ack_late: boolean | null
          gm_id: string | null
          gm_resolution_text: string | null
          gm_resolved_at: string | null
          grace_deadline: string | null
          id: string
          is_overdue: boolean | null
          is_repeat: boolean | null
          is_war_room: boolean | null
          issue_description: string
          issue_proof_url: string | null
          issue_title: string
          last_reminder_sent_at: string | null
          layer_1_resolved_at: string | null
          layer_2_resolved_at: string | null
          layer_3_resolved_at: string | null
          parent_escalation_id: string | null
          priority: string
          priority_level: string | null
          project_id: string | null
          proof_audio_url: string | null
          proof_screenshot_urls: string[] | null
          proof_submitted_at: string | null
          proof_submitted_by: string | null
          pushed_to_ceo_at: string | null
          raised_by_rsh_id: string | null
          rejection_reason: string | null
          reminder_count: number | null
          repeat_count: number | null
          resolution_audio_url: string | null
          resolution_evidence_url: string | null
          resolution_image_url: string | null
          resolution_proof_audio_url: string | null
          resolution_proof_screenshot_urls: string[] | null
          resolution_text: string | null
          resolve_deadline: string
          resolved_at: string | null
          resolved_by: string | null
          site_visit_target_id: string | null
          sla_hours: number | null
          status: string
          tags: string[] | null
          ticket_number: number
          updated_at: string
          urgency: string | null
          vertical: string | null
          war_room_url: string | null
        }
        Insert: {
          ack_deadline?: string
          ack_late?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_by_boi_id?: string | null
          assigned_gmo_id?: string | null
          assigned_layer_1_id?: string | null
          assigned_layer_2_id?: string | null
          assigned_layer_3_id?: string | null
          assigned_role?: string | null
          assigned_smo_id?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          assigned_user_ids?: string[] | null
          assigned_user_names?: string[] | null
          bucket?: string | null
          business_unit?: string | null
          call_record_url?: string | null
          category?: string | null
          ceo_id?: string | null
          client_name: string
          client_phone?: string | null
          closed_by_admin_id?: string | null
          closure_admin_id?: string | null
          closure_approval_status?: string | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          closure_verified_at?: string | null
          created_at?: string
          created_by: string
          current_layer?: string | null
          current_level?: string | null
          current_owner?: string
          department: string
          escalation_proof_url?: string | null
          escalation_type?: string | null
          evidence_url?: string | null
          forwarded_to_gm_at?: string | null
          gm_ack_at?: string | null
          gm_ack_late?: boolean | null
          gm_id?: string | null
          gm_resolution_text?: string | null
          gm_resolved_at?: string | null
          grace_deadline?: string | null
          id?: string
          is_overdue?: boolean | null
          is_repeat?: boolean | null
          is_war_room?: boolean | null
          issue_description: string
          issue_proof_url?: string | null
          issue_title: string
          last_reminder_sent_at?: string | null
          layer_1_resolved_at?: string | null
          layer_2_resolved_at?: string | null
          layer_3_resolved_at?: string | null
          parent_escalation_id?: string | null
          priority?: string
          priority_level?: string | null
          project_id?: string | null
          proof_audio_url?: string | null
          proof_screenshot_urls?: string[] | null
          proof_submitted_at?: string | null
          proof_submitted_by?: string | null
          pushed_to_ceo_at?: string | null
          raised_by_rsh_id?: string | null
          rejection_reason?: string | null
          reminder_count?: number | null
          repeat_count?: number | null
          resolution_audio_url?: string | null
          resolution_evidence_url?: string | null
          resolution_image_url?: string | null
          resolution_proof_audio_url?: string | null
          resolution_proof_screenshot_urls?: string[] | null
          resolution_text?: string | null
          resolve_deadline?: string
          resolved_at?: string | null
          resolved_by?: string | null
          site_visit_target_id?: string | null
          sla_hours?: number | null
          status?: string
          tags?: string[] | null
          ticket_number?: number
          updated_at?: string
          urgency?: string | null
          vertical?: string | null
          war_room_url?: string | null
        }
        Update: {
          ack_deadline?: string
          ack_late?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_by_boi_id?: string | null
          assigned_gmo_id?: string | null
          assigned_layer_1_id?: string | null
          assigned_layer_2_id?: string | null
          assigned_layer_3_id?: string | null
          assigned_role?: string | null
          assigned_smo_id?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          assigned_user_ids?: string[] | null
          assigned_user_names?: string[] | null
          bucket?: string | null
          business_unit?: string | null
          call_record_url?: string | null
          category?: string | null
          ceo_id?: string | null
          client_name?: string
          client_phone?: string | null
          closed_by_admin_id?: string | null
          closure_admin_id?: string | null
          closure_approval_status?: string | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          closure_verified_at?: string | null
          created_at?: string
          created_by?: string
          current_layer?: string | null
          current_level?: string | null
          current_owner?: string
          department?: string
          escalation_proof_url?: string | null
          escalation_type?: string | null
          evidence_url?: string | null
          forwarded_to_gm_at?: string | null
          gm_ack_at?: string | null
          gm_ack_late?: boolean | null
          gm_id?: string | null
          gm_resolution_text?: string | null
          gm_resolved_at?: string | null
          grace_deadline?: string | null
          id?: string
          is_overdue?: boolean | null
          is_repeat?: boolean | null
          is_war_room?: boolean | null
          issue_description?: string
          issue_proof_url?: string | null
          issue_title?: string
          last_reminder_sent_at?: string | null
          layer_1_resolved_at?: string | null
          layer_2_resolved_at?: string | null
          layer_3_resolved_at?: string | null
          parent_escalation_id?: string | null
          priority?: string
          priority_level?: string | null
          project_id?: string | null
          proof_audio_url?: string | null
          proof_screenshot_urls?: string[] | null
          proof_submitted_at?: string | null
          proof_submitted_by?: string | null
          pushed_to_ceo_at?: string | null
          raised_by_rsh_id?: string | null
          rejection_reason?: string | null
          reminder_count?: number | null
          repeat_count?: number | null
          resolution_audio_url?: string | null
          resolution_evidence_url?: string | null
          resolution_image_url?: string | null
          resolution_proof_audio_url?: string | null
          resolution_proof_screenshot_urls?: string[] | null
          resolution_text?: string | null
          resolve_deadline?: string
          resolved_at?: string | null
          resolved_by?: string | null
          site_visit_target_id?: string | null
          sla_hours?: number | null
          status?: string
          tags?: string[] | null
          ticket_number?: number
          updated_at?: string
          urgency?: string | null
          vertical?: string | null
          war_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_escalations_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_by_boi_id_fkey"
            columns: ["assigned_by_boi_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_gmo_id_fkey"
            columns: ["assigned_gmo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_layer_1_id_fkey"
            columns: ["assigned_layer_1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_layer_2_id_fkey"
            columns: ["assigned_layer_2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_layer_3_id_fkey"
            columns: ["assigned_layer_3_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_smo_id_fkey"
            columns: ["assigned_smo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_ceo_id_fkey"
            columns: ["ceo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_closed_by_admin_id_fkey"
            columns: ["closed_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_closure_admin_id_fkey"
            columns: ["closure_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_closure_approved_by_fkey"
            columns: ["closure_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_gm_id_fkey"
            columns: ["gm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_parent_escalation_id_fkey"
            columns: ["parent_escalation_id"]
            isOneToOne: false
            referencedRelation: "client_escalations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_proof_submitted_by_fkey"
            columns: ["proof_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_raised_by_rsh_id_fkey"
            columns: ["raised_by_rsh_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_escalations_site_visit_target_id_fkey"
            columns: ["site_visit_target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_calendar: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string | null
          event_type: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          description?: string | null
          event_type: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          event_type?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_calendar_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      core_heads: {
        Row: {
          achievement_date: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          tagged_at: string | null
          tagged_by: string | null
          target_date: string | null
          untagged_at: string | null
          untagged_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achievement_date?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tagged_at?: string | null
          tagged_by?: string | null
          target_date?: string | null
          untagged_at?: string | null
          untagged_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achievement_date?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tagged_at?: string | null
          tagged_by?: string | null
          target_date?: string | null
          untagged_at?: string | null
          untagged_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_heads_tagged_by_fkey"
            columns: ["tagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_heads_untagged_by_fkey"
            columns: ["untagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_heads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cultivation_cycles: {
        Row: {
          actual_harvest_date: string | null
          created_at: string | null
          created_by: string | null
          crop_type: string
          cycle_name: string
          expected_harvest_date: string | null
          growing_conditions: Json | null
          id: string
          notes: string | null
          project_id: string
          stage: string | null
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          actual_harvest_date?: string | null
          created_at?: string | null
          created_by?: string | null
          crop_type: string
          cycle_name: string
          expected_harvest_date?: string | null
          growing_conditions?: Json | null
          id?: string
          notes?: string | null
          project_id: string
          stage?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          actual_harvest_date?: string | null
          created_at?: string | null
          created_by?: string | null
          crop_type?: string
          cycle_name?: string
          expected_harvest_date?: string | null
          growing_conditions?: Json | null
          id?: string
          notes?: string | null
          project_id?: string
          stage?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cultivation_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultivation_cycles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "cultivation_cycles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_expense_sheet: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string | null
          department: string
          expense_date: string
          id: string
          payment_request_id: string | null
          vendor_name: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string | null
          department: string
          expense_date?: string
          id?: string
          payment_request_id?: string | null
          vendor_name: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string | null
          department?: string
          expense_date?: string
          id?: string
          payment_request_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_expense_sheet_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_farm_logs: {
        Row: {
          activity_details: string
          activity_type: string
          created_at: string | null
          cycle_id: string | null
          environmental_readings: Json | null
          id: string
          issues_reported: string | null
          location_data: Json | null
          log_date: string
          photos: Json | null
          project_id: string
          quantity_used: Json | null
          reported_by: string
          updated_at: string | null
          weather_data: Json | null
        }
        Insert: {
          activity_details: string
          activity_type: string
          created_at?: string | null
          cycle_id?: string | null
          environmental_readings?: Json | null
          id?: string
          issues_reported?: string | null
          location_data?: Json | null
          log_date?: string
          photos?: Json | null
          project_id: string
          quantity_used?: Json | null
          reported_by: string
          updated_at?: string | null
          weather_data?: Json | null
        }
        Update: {
          activity_details?: string
          activity_type?: string
          created_at?: string | null
          cycle_id?: string | null
          environmental_readings?: Json | null
          id?: string
          issues_reported?: string | null
          location_data?: Json | null
          log_date?: string
          photos?: Json | null
          project_id?: string
          quantity_used?: Json | null
          reported_by?: string
          updated_at?: string | null
          weather_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_farm_logs_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cultivation_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_farm_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_farm_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_farm_logs_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_site_updates: {
        Row: {
          created_at: string | null
          equipment_used: Json | null
          id: string
          issues_faced: string | null
          labor_breakdown: Json | null
          labor_count: number | null
          location_data: Json | null
          materials_used: Json | null
          phase_id: string | null
          photo_urls: string[] | null
          photos: Json | null
          progress_percentage: number | null
          project_id: string
          reported_by: string
          safety_incidents: string | null
          tomorrow_plan: string | null
          update_date: string | null
          video_urls: string[] | null
          weather_conditions: string | null
          weather_impact: string | null
          work_done: string
        }
        Insert: {
          created_at?: string | null
          equipment_used?: Json | null
          id?: string
          issues_faced?: string | null
          labor_breakdown?: Json | null
          labor_count?: number | null
          location_data?: Json | null
          materials_used?: Json | null
          phase_id?: string | null
          photo_urls?: string[] | null
          photos?: Json | null
          progress_percentage?: number | null
          project_id: string
          reported_by: string
          safety_incidents?: string | null
          tomorrow_plan?: string | null
          update_date?: string | null
          video_urls?: string[] | null
          weather_conditions?: string | null
          weather_impact?: string | null
          work_done: string
        }
        Update: {
          created_at?: string | null
          equipment_used?: Json | null
          id?: string
          issues_faced?: string | null
          labor_breakdown?: Json | null
          labor_count?: number | null
          location_data?: Json | null
          materials_used?: Json | null
          phase_id?: string | null
          photo_urls?: string[] | null
          photos?: Json | null
          progress_percentage?: number | null
          project_id?: string
          reported_by?: string
          safety_incidents?: string | null
          tomorrow_plan?: string | null
          update_date?: string | null
          video_urls?: string[] | null
          weather_conditions?: string | null
          weather_impact?: string | null
          work_done?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_site_updates_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_site_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_updates_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          created_at: string | null
          display_order: number | null
          expected_outcome: string | null
          id: string
          is_completed: boolean | null
          priority: string
          target_value: number | null
          task_date: string
          task_description: string | null
          task_title: string
          updated_at: string | null
          weekly_target_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          expected_outcome?: string | null
          id?: string
          is_completed?: boolean | null
          priority?: string
          target_value?: number | null
          task_date: string
          task_description?: string | null
          task_title: string
          updated_at?: string | null
          weekly_target_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          expected_outcome?: string | null
          id?: string
          is_completed?: boolean | null
          priority?: string
          target_value?: number | null
          task_date?: string
          task_description?: string | null
          task_title?: string
          updated_at?: string | null
          weekly_target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_weekly_target_id_fkey"
            columns: ["weekly_target_id"]
            isOneToOne: false
            referencedRelation: "weekly_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      day_plans: {
        Row: {
          date: string
          dependency: string | null
          expected_output: string
          id: string
          is_project_work: boolean
          submitted_at: string
          tasks: string[]
          user_id: string
        }
        Insert: {
          date: string
          dependency?: string | null
          expected_output: string
          id?: string
          is_project_work?: boolean
          submitted_at?: string
          tasks?: string[]
          user_id: string
        }
        Update: {
          date?: string
          dependency?: string | null
          expected_output?: string
          id?: string
          is_project_work?: boolean
          submitted_at?: string
          tasks?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_starts: {
        Row: {
          date: string
          day_plan: string
          id: string
          location_verified: boolean | null
          location_zone: string
          location_zone_other: string | null
          login_status: string | null
          submitted_at: string | null
          user_id: string | null
        }
        Insert: {
          date: string
          day_plan: string
          id?: string
          location_verified?: boolean | null
          location_zone: string
          location_zone_other?: string | null
          login_status?: string | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Update: {
          date?: string
          day_plan?: string
          id?: string
          location_verified?: boolean | null
          location_zone?: string
          location_zone_other?: string | null
          login_status?: string | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_starts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          head_of_department_id: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          head_of_department_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          head_of_department_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_issues: {
        Row: {
          admin_remark: string | null
          created_at: string | null
          employee_id: string
          hr_remark: string | null
          id: string
          impact_on_work: string | null
          issue_description: string
          issue_title: string
          related_date: string
          related_time_slot: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_remark?: string | null
          created_at?: string | null
          employee_id: string
          hr_remark?: string | null
          id?: string
          impact_on_work?: string | null
          issue_description: string
          issue_title: string
          related_date: string
          related_time_slot?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_remark?: string | null
          created_at?: string | null
          employee_id?: string
          hr_remark?: string | null
          id?: string
          impact_on_work?: string | null
          issue_description?: string
          issue_title?: string
          related_date?: string
          related_time_slot?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_issues_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_lop: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          lop_days: number
          month: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          lop_days?: number
          month: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          lop_days?: number
          month?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_lop_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      employee_master: {
        Row: {
          account_number: string | null
          bank: string | null
          bank_name: string | null
          basic_salary: number | null
          created_at: string | null
          department: string | null
          designation: string | null
          doj: string | null
          esi: string | null
          id: string
          ifsc: string | null
          ifsc_code: string | null
          incentive: number | null
          incentives: number | null
          increment: number | null
          lop_amount: number | null
          lop_days: number | null
          pf: string | null
          profile_id: string | null
          salary: number | null
          status: string | null
          tds_amount: number | null
          tds_percent: number | null
          total_salary: number | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          bank?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          doj?: string | null
          esi?: string | null
          id?: string
          ifsc?: string | null
          ifsc_code?: string | null
          incentive?: number | null
          incentives?: number | null
          increment?: number | null
          lop_amount?: number | null
          lop_days?: number | null
          pf?: string | null
          profile_id?: string | null
          salary?: number | null
          status?: string | null
          tds_amount?: number | null
          tds_percent?: number | null
          total_salary?: number | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          bank?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          doj?: string | null
          esi?: string | null
          id?: string
          ifsc?: string | null
          ifsc_code?: string | null
          incentive?: number | null
          incentives?: number | null
          increment?: number | null
          lop_amount?: number | null
          lop_days?: number | null
          pf?: string | null
          profile_id?: string | null
          salary?: number | null
          status?: string | null
          tds_amount?: number | null
          tds_percent?: number | null
          total_salary?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_master_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_onboarding_requests: {
        Row: {
          aadhaar_number: string | null
          aadhaar_path: string | null
          aadhaar_url: string | null
          aadhar_number: string | null
          account_number: string | null
          activated_at: string | null
          activation_expires_at: string | null
          activation_link: string | null
          activation_token: string | null
          admin_action_at: string | null
          admin_action_by: string | null
          admin_completed_at: string | null
          admin_completed_by: string | null
          auth_user_id: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_ifsc_code: string | null
          ceo_action_at: string | null
          ceo_action_by: string | null
          ceo_action_note: string | null
          ceo_rejection_reason: string | null
          completed_at: string | null
          contact_number: string | null
          correction_notes: string | null
          correction_reason: string | null
          correction_requested_at: string | null
          created_at: string | null
          created_by: string | null
          current_address: string | null
          date_of_birth: string | null
          degree_marksheet_path: string | null
          degree_marksheet_url: string | null
          department: string
          dob: string | null
          documents_submitted_at: string | null
          email: string
          email_resent_count: number | null
          email_sent: boolean | null
          email_sent_at: string | null
          emergency_contact_number: string | null
          full_name: string
          generated_password_temp: string | null
          generated_username: string | null
          hr_notes: string | null
          hr_policy_accepted: boolean | null
          hr_policy_path: string | null
          hr_policy_url: string | null
          hr_verified_at: string | null
          hr_verified_by: string | null
          id: string
          ifsc_code: string | null
          is_shift_user: boolean | null
          marksheet_10_path: string | null
          marksheet_10_url: string | null
          marksheet_12_path: string | null
          marksheet_12_url: string | null
          offer_letter_accepted: boolean | null
          offer_letter_path: string | null
          offer_letter_url: string | null
          parents_number: string | null
          passbook_path: string | null
          passbook_url: string | null
          permanent_address: string | null
          photo_path: string | null
          photo_url: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          resume_path: string | null
          resume_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selected_at: string | null
          shifted_at: string | null
          status: string | null
          temporary_password_hint: string | null
          token_expires_at: string | null
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          aadhaar_path?: string | null
          aadhaar_url?: string | null
          aadhar_number?: string | null
          account_number?: string | null
          activated_at?: string | null
          activation_expires_at?: string | null
          activation_link?: string | null
          activation_token?: string | null
          admin_action_at?: string | null
          admin_action_by?: string | null
          admin_completed_at?: string | null
          admin_completed_by?: string | null
          auth_user_id?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_ifsc_code?: string | null
          ceo_action_at?: string | null
          ceo_action_by?: string | null
          ceo_action_note?: string | null
          ceo_rejection_reason?: string | null
          completed_at?: string | null
          contact_number?: string | null
          correction_notes?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          degree_marksheet_path?: string | null
          degree_marksheet_url?: string | null
          department: string
          dob?: string | null
          documents_submitted_at?: string | null
          email: string
          email_resent_count?: number | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          emergency_contact_number?: string | null
          full_name: string
          generated_password_temp?: string | null
          generated_username?: string | null
          hr_notes?: string | null
          hr_policy_accepted?: boolean | null
          hr_policy_path?: string | null
          hr_policy_url?: string | null
          hr_verified_at?: string | null
          hr_verified_by?: string | null
          id?: string
          ifsc_code?: string | null
          is_shift_user?: boolean | null
          marksheet_10_path?: string | null
          marksheet_10_url?: string | null
          marksheet_12_path?: string | null
          marksheet_12_url?: string | null
          offer_letter_accepted?: boolean | null
          offer_letter_path?: string | null
          offer_letter_url?: string | null
          parents_number?: string | null
          passbook_path?: string | null
          passbook_url?: string | null
          permanent_address?: string | null
          photo_path?: string | null
          photo_url?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          resume_path?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_at?: string | null
          shifted_at?: string | null
          status?: string | null
          temporary_password_hint?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          aadhaar_path?: string | null
          aadhaar_url?: string | null
          aadhar_number?: string | null
          account_number?: string | null
          activated_at?: string | null
          activation_expires_at?: string | null
          activation_link?: string | null
          activation_token?: string | null
          admin_action_at?: string | null
          admin_action_by?: string | null
          admin_completed_at?: string | null
          admin_completed_by?: string | null
          auth_user_id?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_ifsc_code?: string | null
          ceo_action_at?: string | null
          ceo_action_by?: string | null
          ceo_action_note?: string | null
          ceo_rejection_reason?: string | null
          completed_at?: string | null
          contact_number?: string | null
          correction_notes?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          degree_marksheet_path?: string | null
          degree_marksheet_url?: string | null
          department?: string
          dob?: string | null
          documents_submitted_at?: string | null
          email?: string
          email_resent_count?: number | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          emergency_contact_number?: string | null
          full_name?: string
          generated_password_temp?: string | null
          generated_username?: string | null
          hr_notes?: string | null
          hr_policy_accepted?: boolean | null
          hr_policy_path?: string | null
          hr_policy_url?: string | null
          hr_verified_at?: string | null
          hr_verified_by?: string | null
          id?: string
          ifsc_code?: string | null
          is_shift_user?: boolean | null
          marksheet_10_path?: string | null
          marksheet_10_url?: string | null
          marksheet_12_path?: string | null
          marksheet_12_url?: string | null
          offer_letter_accepted?: boolean | null
          offer_letter_path?: string | null
          offer_letter_url?: string | null
          parents_number?: string | null
          passbook_path?: string | null
          passbook_url?: string | null
          permanent_address?: string | null
          photo_path?: string | null
          photo_url?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          resume_path?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_at?: string | null
          shifted_at?: string | null
          status?: string | null
          temporary_password_hint?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_requests_hr_verified_by_fkey"
            columns: ["hr_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          bonus: number | null
          created_at: string | null
          department: string
          dob: string
          emergency_contact_number: string
          employee_id: string
          fixed_monthly_salary: number
          full_name: string
          id: string
          incentive: number | null
          increment_amount: number
          joining_date: string
          location_name: string | null
          location_type: string
          phone_number: string
          status: string
          total_salary: number | null
          updated_at: string | null
        }
        Insert: {
          address: string
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bonus?: number | null
          created_at?: string | null
          department: string
          dob: string
          emergency_contact_number: string
          employee_id: string
          fixed_monthly_salary?: number
          full_name: string
          id?: string
          incentive?: number | null
          increment_amount?: number
          joining_date: string
          location_name?: string | null
          location_type: string
          phone_number: string
          status?: string
          total_salary?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bonus?: number | null
          created_at?: string | null
          department?: string
          dob?: string
          emergency_contact_number?: string
          employee_id?: string
          fixed_monthly_salary?: number
          full_name?: string
          id?: string
          incentive?: number | null
          increment_amount?: number
          joining_date?: string
          location_name?: string | null
          location_type?: string
          phone_number?: string
          status?: string
          total_salary?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      eod_reports: {
        Row: {
          completed_work: string
          completion_percentage: number | null
          date: string
          id: string
          pending_items: string | null
          planned_work: string
          submitted_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_work: string
          completion_percentage?: number | null
          date: string
          id?: string
          pending_items?: string | null
          planned_work: string
          submitted_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_work?: string
          completion_percentage?: number | null
          date?: string
          id?: string
          pending_items?: string | null
          planned_work?: string
          submitted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eod_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          priority_level: string | null
          sla_hours: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority_level?: string | null
          sla_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority_level?: string | null
          sla_hours?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      escalation_timeline: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          escalation_id: string
          id: string
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          escalation_id: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          escalation_id?: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_timeline_escalation_id_fkey"
            columns: ["escalation_id"]
            isOneToOne: false
            referencedRelation: "escalations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_timeline_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          admin_remarks: string | null
          ceo_remarks: string | null
          complaint_source: string | null
          complaint_text: string
          created_at: string
          customer_id: string
          customer_name: string | null
          customer_phone: string | null
          escalation_number: number
          gm_id: string | null
          gm_resolved_at: string | null
          gm_viewed_at: string | null
          id: string
          project_id: string | null
          resolution_evidence_url: string | null
          resolution_text: string | null
          site_evidence_url: string | null
          sla_breach_notified_at: string | null
          sla_breached: boolean | null
          sla_deadline: string
          smo_id: string | null
          smo_submitted_at: string
          status: string
          updated_at: string
          vertical: string
        }
        Insert: {
          admin_remarks?: string | null
          ceo_remarks?: string | null
          complaint_source?: string | null
          complaint_text: string
          created_at?: string
          customer_id: string
          customer_name?: string | null
          customer_phone?: string | null
          escalation_number?: number
          gm_id?: string | null
          gm_resolved_at?: string | null
          gm_viewed_at?: string | null
          id?: string
          project_id?: string | null
          resolution_evidence_url?: string | null
          resolution_text?: string | null
          site_evidence_url?: string | null
          sla_breach_notified_at?: string | null
          sla_breached?: boolean | null
          sla_deadline?: string
          smo_id?: string | null
          smo_submitted_at?: string
          status?: string
          updated_at?: string
          vertical?: string
        }
        Update: {
          admin_remarks?: string | null
          ceo_remarks?: string | null
          complaint_source?: string | null
          complaint_text?: string
          created_at?: string
          customer_id?: string
          customer_name?: string | null
          customer_phone?: string | null
          escalation_number?: number
          gm_id?: string | null
          gm_resolved_at?: string | null
          gm_viewed_at?: string | null
          id?: string
          project_id?: string | null
          resolution_evidence_url?: string | null
          resolution_text?: string | null
          site_evidence_url?: string | null
          sla_breach_notified_at?: string | null
          sla_breached?: boolean | null
          sla_deadline?: string
          smo_id?: string | null
          smo_submitted_at?: string
          status?: string
          updated_at?: string
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_gm_id_fkey"
            columns: ["gm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_smo_id_fkey"
            columns: ["smo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_work_entries: {
        Row: {
          created_at: string
          date: string
          description: string
          id: string
          proof_url: string | null
          time_slot: string
          user_id: string
          work_type: string
        }
        Insert: {
          created_at?: string
          date: string
          description: string
          id?: string
          proof_url?: string | null
          time_slot: string
          user_id: string
          work_type: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          id?: string
          proof_url?: string | null
          time_slot?: string
          user_id?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_work_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_manager_remarks: {
        Row: {
          created_at: string | null
          created_by: string
          created_by_name: string | null
          created_by_role: string | null
          farm_log_id: string | null
          id: string
          remark_text: string | null
          remark_type: string
          site_update_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          created_by_name?: string | null
          created_by_role?: string | null
          farm_log_id?: string | null
          id?: string
          remark_text?: string | null
          remark_type: string
          site_update_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          created_by_name?: string | null
          created_by_role?: string | null
          farm_log_id?: string | null
          id?: string
          remark_text?: string | null
          remark_type?: string
          site_update_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_manager_remarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_manager_remarks_farm_log_id_fkey"
            columns: ["farm_log_id"]
            isOneToOne: false
            referencedRelation: "daily_farm_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_manager_remarks_site_update_id_fkey"
            columns: ["site_update_id"]
            isOneToOne: false
            referencedRelation: "daily_site_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_pattern_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          pattern_description: string
          payment_ids: string[] | null
          requester_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          vendor_name: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          pattern_description: string
          payment_ids?: string[] | null
          requester_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          vendor_name?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          pattern_description?: string
          payment_ids?: string[] | null
          requester_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_pattern_alerts_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_pattern_alerts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_zones: {
        Row: {
          assigned_to: string[] | null
          center_lat: number
          center_lng: number
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          radius_meters: number
        }
        Insert: {
          assigned_to?: string[] | null
          center_lat: number
          center_lng: number
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          radius_meters: number
        }
        Update: {
          assigned_to?: string[] | null
          center_lat?: number
          center_lng?: number
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          radius_meters?: number
        }
        Relationships: []
      }
      geofences: {
        Row: {
          action_type: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          updated_at: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geofences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gmo_categories: {
        Row: {
          category_group: string
          category_value: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category_group: string
          category_value: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category_group?: string
          category_value?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmo_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_records: {
        Row: {
          created_at: string | null
          cycle_id: string
          harvest_date: string
          id: string
          notes: string | null
          project_id: string
          quality_grade: string | null
          quantity: number
          recorded_by: string
          unit: string
        }
        Insert: {
          created_at?: string | null
          cycle_id: string
          harvest_date?: string
          id?: string
          notes?: string | null
          project_id: string
          quality_grade?: string | null
          quantity: number
          recorded_by: string
          unit?: string
        }
        Update: {
          created_at?: string | null
          cycle_id?: string
          harvest_date?: string
          id?: string
          notes?: string | null
          project_id?: string
          quality_grade?: string | null
          quantity?: number
          recorded_by?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "harvest_records_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cultivation_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "harvest_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_critical_timeline: {
        Row: {
          action: string
          created_at: string
          critical_id: string
          details: Json | null
          id: string
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          critical_id: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          critical_id?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hourly_critical_timeline_critical_id_fkey"
            columns: ["critical_id"]
            isOneToOne: false
            referencedRelation: "hourly_criticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_critical_timeline_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_criticals: {
        Row: {
          ack_deadline: string
          ack_late: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_by_boi_id: string | null
          assigned_gmo_id: string | null
          assigned_role: string | null
          assigned_smo_id: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          assigned_user_ids: string[] | null
          assigned_user_names: string[] | null
          audit_admin_id: string | null
          audit_verified_at: string | null
          blast_notified_admin: boolean | null
          blast_notified_ceo: boolean | null
          blast_notified_gm: boolean | null
          blast_triggered_at: string | null
          bucket: string | null
          business_unit: string | null
          call_record_url: string | null
          closure_approval_status: string | null
          closure_approved_at: string | null
          closure_approved_by: string | null
          created_at: string
          created_by: string
          current_owner: string | null
          department: string
          id: string
          is_repeat: boolean | null
          issue_description: string
          issue_title: string
          issue_type: string
          parent_critical_id: string | null
          project_id: string | null
          proof_audio_url: string | null
          proof_screenshot_urls: string[] | null
          proof_submitted_at: string | null
          proof_submitted_by: string | null
          proof_url: string
          rejection_reason: string | null
          repeat_count: number | null
          resolution_audio_url: string | null
          resolution_evidence_url: string | null
          resolution_image_url: string | null
          resolution_proof_audio_url: string | null
          resolution_proof_screenshot_urls: string[] | null
          resolution_proof_url: string | null
          resolution_text: string | null
          resolve_deadline: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          ticket_number: number
          updated_at: string
          urgency: string | null
          vertical: string | null
        }
        Insert: {
          ack_deadline?: string
          ack_late?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_by_boi_id?: string | null
          assigned_gmo_id?: string | null
          assigned_role?: string | null
          assigned_smo_id?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          assigned_user_ids?: string[] | null
          assigned_user_names?: string[] | null
          audit_admin_id?: string | null
          audit_verified_at?: string | null
          blast_notified_admin?: boolean | null
          blast_notified_ceo?: boolean | null
          blast_notified_gm?: boolean | null
          blast_triggered_at?: string | null
          bucket?: string | null
          business_unit?: string | null
          call_record_url?: string | null
          closure_approval_status?: string | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          created_at?: string
          created_by: string
          current_owner?: string | null
          department: string
          id?: string
          is_repeat?: boolean | null
          issue_description: string
          issue_title: string
          issue_type: string
          parent_critical_id?: string | null
          project_id?: string | null
          proof_audio_url?: string | null
          proof_screenshot_urls?: string[] | null
          proof_submitted_at?: string | null
          proof_submitted_by?: string | null
          proof_url: string
          rejection_reason?: string | null
          repeat_count?: number | null
          resolution_audio_url?: string | null
          resolution_evidence_url?: string | null
          resolution_image_url?: string | null
          resolution_proof_audio_url?: string | null
          resolution_proof_screenshot_urls?: string[] | null
          resolution_proof_url?: string | null
          resolution_text?: string | null
          resolve_deadline?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          ticket_number?: number
          updated_at?: string
          urgency?: string | null
          vertical?: string | null
        }
        Update: {
          ack_deadline?: string
          ack_late?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_by_boi_id?: string | null
          assigned_gmo_id?: string | null
          assigned_role?: string | null
          assigned_smo_id?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          assigned_user_ids?: string[] | null
          assigned_user_names?: string[] | null
          audit_admin_id?: string | null
          audit_verified_at?: string | null
          blast_notified_admin?: boolean | null
          blast_notified_ceo?: boolean | null
          blast_notified_gm?: boolean | null
          blast_triggered_at?: string | null
          bucket?: string | null
          business_unit?: string | null
          call_record_url?: string | null
          closure_approval_status?: string | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          created_at?: string
          created_by?: string
          current_owner?: string | null
          department?: string
          id?: string
          is_repeat?: boolean | null
          issue_description?: string
          issue_title?: string
          issue_type?: string
          parent_critical_id?: string | null
          project_id?: string | null
          proof_audio_url?: string | null
          proof_screenshot_urls?: string[] | null
          proof_submitted_at?: string | null
          proof_submitted_by?: string | null
          proof_url?: string
          rejection_reason?: string | null
          repeat_count?: number | null
          resolution_audio_url?: string | null
          resolution_evidence_url?: string | null
          resolution_image_url?: string | null
          resolution_proof_audio_url?: string | null
          resolution_proof_screenshot_urls?: string[] | null
          resolution_proof_url?: string | null
          resolution_text?: string | null
          resolve_deadline?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          ticket_number?: number
          updated_at?: string
          urgency?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hourly_criticals_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_assigned_by_boi_id_fkey"
            columns: ["assigned_by_boi_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_assigned_gmo_id_fkey"
            columns: ["assigned_gmo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_assigned_smo_id_fkey"
            columns: ["assigned_smo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_audit_admin_id_fkey"
            columns: ["audit_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_closure_approved_by_fkey"
            columns: ["closure_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_parent_critical_id_fkey"
            columns: ["parent_critical_id"]
            isOneToOne: false
            referencedRelation: "hourly_criticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "hourly_criticals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_proof_submitted_by_fkey"
            columns: ["proof_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_criticals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_plans: {
        Row: {
          date: string
          id: string
          plan_text: string
          slot_start_time_actual: string | null
          status: string
          submitted_at: string | null
          time_slot: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          plan_text: string
          slot_start_time_actual?: string | null
          status?: string
          submitted_at?: string | null
          time_slot: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          plan_text?: string
          slot_start_time_actual?: string | null
          status?: string
          submitted_at?: string | null
          time_slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_reports: {
        Row: {
          date: string
          delay_minutes: number | null
          grace_period_end_time: string | null
          id: string
          is_late: boolean | null
          report_text: string
          slot_end_time: string | null
          status: string
          submitted_at: string | null
          time_slot: string
          user_id: string
        }
        Insert: {
          date: string
          delay_minutes?: number | null
          grace_period_end_time?: string | null
          id?: string
          is_late?: boolean | null
          report_text: string
          slot_end_time?: string | null
          status?: string
          submitted_at?: string | null
          time_slot: string
          user_id: string
        }
        Update: {
          date?: string
          delay_minutes?: number | null
          grace_period_end_time?: string | null
          id?: string
          is_late?: boolean | null
          report_text?: string
          slot_end_time?: string | null
          status?: string
          submitted_at?: string | null
          time_slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_attestations: {
        Row: {
          attested_at: string | null
          date: string
          employee_id: string
          hr_id: string
          id: string
          remarks: string | null
          status: string
        }
        Insert: {
          attested_at?: string | null
          date: string
          employee_id: string
          hr_id: string
          id?: string
          remarks?: string | null
          status: string
        }
        Update: {
          attested_at?: string | null
          date?: string
          employee_id?: string
          hr_id?: string
          id?: string
          remarks?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_attestations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attestations_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_usage_logs: {
        Row: {
          created_at: string | null
          id: string
          inventory_id: string
          log_date: string
          logged_by: string
          logged_by_name: string | null
          project_id: string
          purpose: string | null
          quantity_used: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_id: string
          log_date?: string
          logged_by: string
          logged_by_name?: string | null
          project_id: string
          purpose?: string | null
          quantity_used: number
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_id?: string
          log_date?: string
          logged_by?: string
          logged_by_name?: string | null
          project_id?: string
          purpose?: string | null
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_usage_logs_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_consumption_summary"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "inventory_usage_logs_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "project_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_usage_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_usage_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inventory_usage_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      late_reasons: {
        Row: {
          date: string
          delay_reason: string
          detailed_explanation: string
          hourly_report_id: string
          id: string
          proof_url: string | null
          status: string | null
          submitted_at: string | null
          time_slot: string
          user_id: string
        }
        Insert: {
          date: string
          delay_reason: string
          detailed_explanation: string
          hourly_report_id: string
          id?: string
          proof_url?: string | null
          status?: string | null
          submitted_at?: string | null
          time_slot: string
          user_id: string
        }
        Update: {
          date?: string
          delay_reason?: string
          detailed_explanation?: string
          hourly_report_id?: string
          id?: string
          proof_url?: string | null
          status?: string | null
          submitted_at?: string | null
          time_slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_reasons_hourly_report_id_fkey"
            columns: ["hourly_report_id"]
            isOneToOne: false
            referencedRelation: "hourly_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_reasons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_remarks: string | null
          admin_reviewed_at: string | null
          admin_reviewed_by: string | null
          ceo_remarks: string | null
          ceo_reviewed_at: string | null
          ceo_reviewed_by: string | null
          created_at: string
          duration_category: string | null
          employee_id: string | null
          end_date: string
          end_time: string | null
          hr_remarks: string | null
          hr_reviewed_at: string | null
          hr_reviewed_by: string | null
          id: string
          leave_type_id: string
          proof_url: string | null
          reason: string
          rejected_by: string | null
          rejection_reason: string | null
          shift: string | null
          start_date: string
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_remarks?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          ceo_remarks?: string | null
          ceo_reviewed_at?: string | null
          ceo_reviewed_by?: string | null
          created_at?: string
          duration_category?: string | null
          employee_id?: string | null
          end_date: string
          end_time?: string | null
          hr_remarks?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          id?: string
          leave_type_id: string
          proof_url?: string | null
          reason: string
          rejected_by?: string | null
          rejection_reason?: string | null
          shift?: string | null
          start_date: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_remarks?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          ceo_remarks?: string | null
          ceo_reviewed_at?: string | null
          ceo_reviewed_by?: string | null
          created_at?: string
          duration_category?: string | null
          employee_id?: string | null
          end_date?: string
          end_time?: string | null
          hr_remarks?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          id?: string
          leave_type_id?: string
          proof_url?: string | null
          reason?: string
          rejected_by?: string | null
          rejection_reason?: string | null
          shift?: string | null
          start_date?: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_admin_reviewed_by_fkey"
            columns: ["admin_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_ceo_reviewed_by_fkey"
            columns: ["ceo_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_hr_reviewed_by_fkey"
            columns: ["hr_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          allow_retroactive: boolean | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_proof: boolean | null
        }
        Insert: {
          allow_retroactive?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_proof?: boolean | null
        }
        Update: {
          allow_retroactive?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_proof?: boolean | null
        }
        Relationships: []
      }
      live_locations: {
        Row: {
          battery_level: number | null
          created_at: string | null
          heading: number | null
          is_active: boolean | null
          last_updated: string | null
          latitude: number
          longitude: number
          speed: number | null
          user_id: string
        }
        Insert: {
          battery_level?: number | null
          created_at?: string | null
          heading?: number | null
          is_active?: boolean | null
          last_updated?: string | null
          latitude: number
          longitude: number
          speed?: number | null
          user_id: string
        }
        Update: {
          battery_level?: number | null
          created_at?: string | null
          heading?: number | null
          is_active?: boolean | null
          last_updated?: string | null
          latitude?: number
          longitude?: number
          speed?: number | null
          user_id?: string
        }
        Relationships: []
      }
      location_logs: {
        Row: {
          accuracy: number | null
          battery_level: number | null
          id: string
          latitude: number
          longitude: number
          speed: number | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          battery_level?: number | null
          id?: string
          latitude: number
          longitude: number
          speed?: number | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          battery_level?: number | null
          id?: string
          latitude?: number
          longitude?: number
          speed?: number | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lop_audit_logs: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          lop_date: string
          lop_days: number
          lop_type: string
          original_lop_id: string
          original_status: string
          reason: string
          reversal_proof_url: string | null
          reversal_reason: string
          reversed_at: string
          reversed_by: string
          source: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          lop_date: string
          lop_days: number
          lop_type: string
          original_lop_id: string
          original_status: string
          reason: string
          reversal_proof_url?: string | null
          reversal_reason: string
          reversed_at?: string
          reversed_by: string
          source: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          lop_date?: string
          lop_days?: number
          lop_type?: string
          original_lop_id?: string
          original_status?: string
          reason?: string
          reversal_proof_url?: string | null
          reversal_reason?: string
          reversed_at?: string
          reversed_by?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lop_audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lop_audit_logs_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lop_entries: {
        Row: {
          admin_verified_at: string | null
          admin_verified_by: string | null
          auto_reason: string | null
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          evidence_url: string
          id: string
          lop_date: string
          lop_days: number
          lop_type: string
          lop_value: number | null
          reason: string
          rejection_reason: string | null
          reversal_admin_reviewed_at: string | null
          reversal_admin_reviewed_by: string | null
          reversal_boi_reviewed_at: string | null
          reversal_boi_reviewed_by: string | null
          reversal_ceo_reviewed_at: string | null
          reversal_ceo_reviewed_by: string | null
          reversal_proof_url: string | null
          reversal_reason: string | null
          reversal_requested: boolean | null
          reversal_requested_at: string | null
          reversal_status: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_verified_at?: string | null
          admin_verified_by?: string | null
          auto_reason?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          evidence_url: string
          id?: string
          lop_date: string
          lop_days?: number
          lop_type: string
          lop_value?: number | null
          reason: string
          rejection_reason?: string | null
          reversal_admin_reviewed_at?: string | null
          reversal_admin_reviewed_by?: string | null
          reversal_boi_reviewed_at?: string | null
          reversal_boi_reviewed_by?: string | null
          reversal_ceo_reviewed_at?: string | null
          reversal_ceo_reviewed_by?: string | null
          reversal_proof_url?: string | null
          reversal_reason?: string | null
          reversal_requested?: boolean | null
          reversal_requested_at?: string | null
          reversal_status?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_verified_at?: string | null
          admin_verified_by?: string | null
          auto_reason?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          evidence_url?: string
          id?: string
          lop_date?: string
          lop_days?: number
          lop_type?: string
          lop_value?: number | null
          reason?: string
          rejection_reason?: string | null
          reversal_admin_reviewed_at?: string | null
          reversal_admin_reviewed_by?: string | null
          reversal_boi_reviewed_at?: string | null
          reversal_boi_reviewed_by?: string | null
          reversal_ceo_reviewed_at?: string | null
          reversal_ceo_reviewed_by?: string | null
          reversal_proof_url?: string | null
          reversal_reason?: string | null
          reversal_requested?: boolean | null
          reversal_requested_at?: string | null
          reversal_status?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lop_entries_admin_verified_by_fkey"
            columns: ["admin_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lop_entries_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lop_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lop_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lop_entries_reversal_admin_reviewed_by_fkey"
            columns: ["reversal_admin_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lop_entries_reversal_boi_reviewed_by_fkey"
            columns: ["reversal_boi_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lop_entries_reversal_ceo_reviewed_by_fkey"
            columns: ["reversal_ceo_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          actual_delivery_date: string | null
          added_to_inventory: boolean | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          approval_status: string | null
          approved_for_sourcing_at: string | null
          assigned_auditor_at: string | null
          assigned_auditor_by: string | null
          assigned_auditor_id: string | null
          assigned_to_purchase: string | null
          boi_approved_at: string | null
          boi_approved_by: string | null
          boq_items: Json | null
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          created_at: string | null
          delivery_challan_number: string | null
          delivery_notes: string | null
          delivery_photo_urls: string[] | null
          delivery_received_by: string | null
          delivery_status: string | null
          delivery_vehicle_number: string | null
          estimated_delivery_date: string | null
          expected_delivery_date: string | null
          farm_audit_notes: string | null
          farm_audit_status: string | null
          farm_audited_at: string | null
          farm_audited_by: string | null
          gm_approved_at: string | null
          gm_approved_by: string | null
          gm_rejection_reason: string | null
          gmo_approved_at: string | null
          gmo_approved_by: string | null
          grn_generated_at: string | null
          grn_generated_by: string | null
          grn_number: string | null
          id: string
          invoice_url: string | null
          linked_payment_id: string | null
          notes: string | null
          order_notes: string | null
          order_status: string | null
          phase_id: string | null
          project_id: string
          requested_by: string
          requester_department: string | null
          selected_quote_id: string | null
          smo_approved_at: string | null
          smo_approved_by: string | null
          split_group_id: string | null
          status: string | null
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          added_to_inventory?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          approval_status?: string | null
          approved_for_sourcing_at?: string | null
          assigned_auditor_at?: string | null
          assigned_auditor_by?: string | null
          assigned_auditor_id?: string | null
          assigned_to_purchase?: string | null
          boi_approved_at?: string | null
          boi_approved_by?: string | null
          boq_items?: Json | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          delivery_challan_number?: string | null
          delivery_notes?: string | null
          delivery_photo_urls?: string[] | null
          delivery_received_by?: string | null
          delivery_status?: string | null
          delivery_vehicle_number?: string | null
          estimated_delivery_date?: string | null
          expected_delivery_date?: string | null
          farm_audit_notes?: string | null
          farm_audit_status?: string | null
          farm_audited_at?: string | null
          farm_audited_by?: string | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gm_rejection_reason?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          grn_generated_at?: string | null
          grn_generated_by?: string | null
          grn_number?: string | null
          id?: string
          invoice_url?: string | null
          linked_payment_id?: string | null
          notes?: string | null
          order_notes?: string | null
          order_status?: string | null
          phase_id?: string | null
          project_id: string
          requested_by: string
          requester_department?: string | null
          selected_quote_id?: string | null
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          split_group_id?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          added_to_inventory?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          approval_status?: string | null
          approved_for_sourcing_at?: string | null
          assigned_auditor_at?: string | null
          assigned_auditor_by?: string | null
          assigned_auditor_id?: string | null
          assigned_to_purchase?: string | null
          boi_approved_at?: string | null
          boi_approved_by?: string | null
          boq_items?: Json | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          delivery_challan_number?: string | null
          delivery_notes?: string | null
          delivery_photo_urls?: string[] | null
          delivery_received_by?: string | null
          delivery_status?: string | null
          delivery_vehicle_number?: string | null
          estimated_delivery_date?: string | null
          expected_delivery_date?: string | null
          farm_audit_notes?: string | null
          farm_audit_status?: string | null
          farm_audited_at?: string | null
          farm_audited_by?: string | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gm_rejection_reason?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          grn_generated_at?: string | null
          grn_generated_by?: string | null
          grn_number?: string | null
          id?: string
          invoice_url?: string | null
          linked_payment_id?: string | null
          notes?: string | null
          order_notes?: string | null
          order_status?: string | null
          phase_id?: string | null
          project_id?: string
          requested_by?: string
          requester_department?: string | null
          selected_quote_id?: string | null
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          split_group_id?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_assigned_auditor_by_fkey"
            columns: ["assigned_auditor_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_assigned_auditor_id_fkey"
            columns: ["assigned_auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_assigned_to_purchase_fkey"
            columns: ["assigned_to_purchase"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_boi_approved_by_fkey"
            columns: ["boi_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_delivery_received_by_fkey"
            columns: ["delivery_received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_farm_audited_by_fkey"
            columns: ["farm_audited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_gm_approved_by_fkey"
            columns: ["gm_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_grn_generated_by_fkey"
            columns: ["grn_generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_linked_payment_id_fkey"
            columns: ["linked_payment_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_selected_quote_id_fkey"
            columns: ["selected_quote_id"]
            isOneToOne: false
            referencedRelation: "vendor_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_split_group_id_fkey"
            columns: ["split_group_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_deviation_requests: {
        Row: {
          ceo_remarks: string | null
          ceo_reviewed_at: string | null
          ceo_reviewed_by: string | null
          created_at: string | null
          gmo_remarks: string | null
          gmo_reviewed_at: string | null
          gmo_reviewed_by: string | null
          id: string
          milestone_id: string
          new_proposed_date: string
          original_date: string
          project_id: string
          proof_url: string | null
          reason: string
          rejection_reason: string | null
          requested_by: string
          smo_remarks: string | null
          smo_reviewed_at: string | null
          smo_reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ceo_remarks?: string | null
          ceo_reviewed_at?: string | null
          ceo_reviewed_by?: string | null
          created_at?: string | null
          gmo_remarks?: string | null
          gmo_reviewed_at?: string | null
          gmo_reviewed_by?: string | null
          id?: string
          milestone_id: string
          new_proposed_date: string
          original_date: string
          project_id: string
          proof_url?: string | null
          reason: string
          rejection_reason?: string | null
          requested_by: string
          smo_remarks?: string | null
          smo_reviewed_at?: string | null
          smo_reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ceo_remarks?: string | null
          ceo_reviewed_at?: string | null
          ceo_reviewed_by?: string | null
          created_at?: string | null
          gmo_remarks?: string | null
          gmo_reviewed_at?: string | null
          gmo_reviewed_by?: string | null
          id?: string
          milestone_id?: string
          new_proposed_date?: string
          original_date?: string
          project_id?: string
          proof_url?: string | null
          reason?: string
          rejection_reason?: string | null
          requested_by?: string
          smo_remarks?: string | null
          smo_reviewed_at?: string | null
          smo_reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestone_deviation_requests_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_deviation_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "milestone_deviation_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          audio_url: string | null
          category: string
          id: string
          is_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          audio_url?: string | null
          category: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          audio_url?: string | null
          category?: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          link: string | null
          message: string
          read_status: boolean
          related_record_id: string | null
          role: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          link?: string | null
          message: string
          read_status?: boolean
          related_record_id?: string | null
          role: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          link?: string | null
          message?: string
          read_status?: boolean
          related_record_id?: string | null
          role?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_requests: {
        Row: {
          aadhaar_number: string | null
          aadhaar_url: string | null
          aadhar_number: string | null
          account_number: string | null
          activation_expires_at: string | null
          activation_link: string | null
          activation_token: string | null
          admin_action_at: string | null
          admin_action_by: string | null
          auth_user_id: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_ifsc_code: string | null
          ceo_action_at: string | null
          ceo_action_by: string | null
          ceo_rejection_reason: string | null
          contact_number: string | null
          correction_reason: string | null
          correction_requested_at: string | null
          created_at: string | null
          created_by: string | null
          current_address: string | null
          date_of_birth: string | null
          degree_marksheet_url: string | null
          department: string
          details_submitted_at: string | null
          dob: string | null
          documents_submitted_at: string | null
          email: string
          email_sent: boolean | null
          email_sent_at: string | null
          emergency_contact_number: string | null
          full_name: string
          generated_password_temp: string | null
          generated_username: string | null
          hr_notes: string | null
          hr_policy_accepted: boolean | null
          hr_policy_url: string | null
          hr_verified_at: string | null
          hr_verified_by: string | null
          id: string
          ifsc_code: string | null
          marksheet_10_url: string | null
          marksheet_12_url: string | null
          offer_letter_accepted: boolean | null
          offer_letter_url: string | null
          onboarding_status: string | null
          parents_number: string | null
          passbook_url: string | null
          permanent_address: string | null
          photo_url: string | null
          rejected_at: string | null
          rejection_reason: string | null
          resume_path: string | null
          resume_url: string | null
          status: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          aadhaar_url?: string | null
          aadhar_number?: string | null
          account_number?: string | null
          activation_expires_at?: string | null
          activation_link?: string | null
          activation_token?: string | null
          admin_action_at?: string | null
          admin_action_by?: string | null
          auth_user_id?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_ifsc_code?: string | null
          ceo_action_at?: string | null
          ceo_action_by?: string | null
          ceo_rejection_reason?: string | null
          contact_number?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          degree_marksheet_url?: string | null
          department: string
          details_submitted_at?: string | null
          dob?: string | null
          documents_submitted_at?: string | null
          email: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          emergency_contact_number?: string | null
          full_name: string
          generated_password_temp?: string | null
          generated_username?: string | null
          hr_notes?: string | null
          hr_policy_accepted?: boolean | null
          hr_policy_url?: string | null
          hr_verified_at?: string | null
          hr_verified_by?: string | null
          id?: string
          ifsc_code?: string | null
          marksheet_10_url?: string | null
          marksheet_12_url?: string | null
          offer_letter_accepted?: boolean | null
          offer_letter_url?: string | null
          onboarding_status?: string | null
          parents_number?: string | null
          passbook_url?: string | null
          permanent_address?: string | null
          photo_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          resume_path?: string | null
          resume_url?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          aadhaar_url?: string | null
          aadhar_number?: string | null
          account_number?: string | null
          activation_expires_at?: string | null
          activation_link?: string | null
          activation_token?: string | null
          admin_action_at?: string | null
          admin_action_by?: string | null
          auth_user_id?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_ifsc_code?: string | null
          ceo_action_at?: string | null
          ceo_action_by?: string | null
          ceo_rejection_reason?: string | null
          contact_number?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          degree_marksheet_url?: string | null
          department?: string
          details_submitted_at?: string | null
          dob?: string | null
          documents_submitted_at?: string | null
          email?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          emergency_contact_number?: string | null
          full_name?: string
          generated_password_temp?: string | null
          generated_username?: string | null
          hr_notes?: string | null
          hr_policy_accepted?: boolean | null
          hr_policy_url?: string | null
          hr_verified_at?: string | null
          hr_verified_by?: string | null
          id?: string
          ifsc_code?: string | null
          marksheet_10_url?: string | null
          marksheet_12_url?: string | null
          offer_letter_accepted?: boolean | null
          offer_letter_url?: string | null
          onboarding_status?: string | null
          parents_number?: string | null
          passbook_url?: string | null
          permanent_address?: string | null
          photo_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          resume_path?: string | null
          resume_url?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payees: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          ifsc_code: string | null
          name: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ifsc_code?: string | null
          name: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ifsc_code?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "payees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_deduplication_registry: {
        Row: {
          account_fingerprint: string | null
          amount: number
          bill_url_hash: string | null
          created_at: string
          duplicate_of: string | null
          id: string
          match_confidence: number | null
          match_rules_triggered: Json | null
          override_allowed: boolean | null
          override_at: string | null
          override_by: string | null
          override_reason: string | null
          payment_date: string
          payment_request_id: string
          status: string
          upi_fingerprint: string | null
          vendor_fingerprint: string | null
        }
        Insert: {
          account_fingerprint?: string | null
          amount: number
          bill_url_hash?: string | null
          created_at?: string
          duplicate_of?: string | null
          id?: string
          match_confidence?: number | null
          match_rules_triggered?: Json | null
          override_allowed?: boolean | null
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          payment_date?: string
          payment_request_id: string
          status?: string
          upi_fingerprint?: string | null
          vendor_fingerprint?: string | null
        }
        Update: {
          account_fingerprint?: string | null
          amount?: number
          bill_url_hash?: string | null
          created_at?: string
          duplicate_of?: string | null
          id?: string
          match_confidence?: number | null
          match_rules_triggered?: Json | null
          override_allowed?: boolean | null
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          payment_date?: string
          payment_request_id?: string
          status?: string
          upi_fingerprint?: string | null
          vendor_fingerprint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_deduplication_registry_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_deduplication_registry_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_deduplication_registry_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          accounts_executed_by: string | null
          accounts_reversal_reason: string | null
          accounts_reversed_at: string | null
          accounts_reversed_by: string | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejection_reason: string | null
          amount: number
          audit_timeline: Json | null
          auditor_approved_at: string | null
          auditor_approved_by: string | null
          bank_name: string | null
          beneficiary_name: string | null
          bill_url: string | null
          boi_approved_at: string | null
          boi_approved_by: string | null
          boi_rejection_reason: string | null
          boq_item_id: string | null
          bulk_batch_id: string | null
          bulk_prepared_at: string | null
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          ceo_hold_reason: string | null
          conversion_date: string | null
          converted_by: string | null
          converted_from_batch: boolean | null
          created_at: string
          cutoff_date: string | null
          cutoff_time: string | null
          department: string | null
          detailed_description: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          gm_approved_at: string | null
          gm_approved_by: string | null
          gmo_approved_at: string | null
          gmo_approved_by: string | null
          id: string
          is_jv_payment: boolean | null
          is_overridden: boolean | null
          is_petty_cash: boolean | null
          is_porter_payment: boolean | null
          is_project_work: boolean
          is_split_payment: boolean | null
          is_transport_payment: boolean | null
          material_request_id: string | null
          original_batch_id: string | null
          original_duplicate_score: number | null
          otp_verified_at: string | null
          override_reason: string | null
          paid_at: string | null
          payment_number: number
          payment_proof_url: string | null
          payment_type: string | null
          phase_id: string | null
          porter_end_km: number | null
          porter_start_km: number | null
          porter_total_km: number | null
          project_id: string | null
          purpose: string
          requester_id: string
          smo_approved_at: string | null
          smo_approved_by: string | null
          split_batch_id: string | null
          status: string
          tags: string[] | null
          total_splits: number | null
          transport_trips: Json | null
          updated_at: string
          urgency: string
          utr_match_confidence: number | null
          utr_number: string | null
          utr_requires_manual_review: boolean | null
          utr_verified_at: string | null
          utr_verified_by: string | null
          vendor_account_number: string | null
          vendor_bank_details: string
          vendor_contact_person: string | null
          vendor_ifsc_code: string | null
          vendor_name: string
          vendor_phone: string | null
          vendor_upi: string | null
          wo_number: string | null
          work_order_id: string | null
          work_proof_url: string | null
        }
        Insert: {
          accounts_executed_by?: string | null
          accounts_reversal_reason?: string | null
          accounts_reversed_at?: string | null
          accounts_reversed_by?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          amount: number
          audit_timeline?: Json | null
          auditor_approved_at?: string | null
          auditor_approved_by?: string | null
          bank_name?: string | null
          beneficiary_name?: string | null
          bill_url?: string | null
          boi_approved_at?: string | null
          boi_approved_by?: string | null
          boi_rejection_reason?: string | null
          boq_item_id?: string | null
          bulk_batch_id?: string | null
          bulk_prepared_at?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          ceo_hold_reason?: string | null
          conversion_date?: string | null
          converted_by?: string | null
          converted_from_batch?: boolean | null
          created_at?: string
          cutoff_date?: string | null
          cutoff_time?: string | null
          department?: string | null
          detailed_description?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          id?: string
          is_jv_payment?: boolean | null
          is_overridden?: boolean | null
          is_petty_cash?: boolean | null
          is_porter_payment?: boolean | null
          is_project_work?: boolean
          is_split_payment?: boolean | null
          is_transport_payment?: boolean | null
          material_request_id?: string | null
          original_batch_id?: string | null
          original_duplicate_score?: number | null
          otp_verified_at?: string | null
          override_reason?: string | null
          paid_at?: string | null
          payment_number?: number
          payment_proof_url?: string | null
          payment_type?: string | null
          phase_id?: string | null
          porter_end_km?: number | null
          porter_start_km?: number | null
          porter_total_km?: number | null
          project_id?: string | null
          purpose: string
          requester_id: string
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          split_batch_id?: string | null
          status?: string
          tags?: string[] | null
          total_splits?: number | null
          transport_trips?: Json | null
          updated_at?: string
          urgency?: string
          utr_match_confidence?: number | null
          utr_number?: string | null
          utr_requires_manual_review?: boolean | null
          utr_verified_at?: string | null
          utr_verified_by?: string | null
          vendor_account_number?: string | null
          vendor_bank_details: string
          vendor_contact_person?: string | null
          vendor_ifsc_code?: string | null
          vendor_name: string
          vendor_phone?: string | null
          vendor_upi?: string | null
          wo_number?: string | null
          work_order_id?: string | null
          work_proof_url?: string | null
        }
        Update: {
          accounts_executed_by?: string | null
          accounts_reversal_reason?: string | null
          accounts_reversed_at?: string | null
          accounts_reversed_by?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          amount?: number
          audit_timeline?: Json | null
          auditor_approved_at?: string | null
          auditor_approved_by?: string | null
          bank_name?: string | null
          beneficiary_name?: string | null
          bill_url?: string | null
          boi_approved_at?: string | null
          boi_approved_by?: string | null
          boi_rejection_reason?: string | null
          boq_item_id?: string | null
          bulk_batch_id?: string | null
          bulk_prepared_at?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          ceo_hold_reason?: string | null
          conversion_date?: string | null
          converted_by?: string | null
          converted_from_batch?: boolean | null
          created_at?: string
          cutoff_date?: string | null
          cutoff_time?: string | null
          department?: string | null
          detailed_description?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          id?: string
          is_jv_payment?: boolean | null
          is_overridden?: boolean | null
          is_petty_cash?: boolean | null
          is_porter_payment?: boolean | null
          is_project_work?: boolean
          is_split_payment?: boolean | null
          is_transport_payment?: boolean | null
          material_request_id?: string | null
          original_batch_id?: string | null
          original_duplicate_score?: number | null
          otp_verified_at?: string | null
          override_reason?: string | null
          paid_at?: string | null
          payment_number?: number
          payment_proof_url?: string | null
          payment_type?: string | null
          phase_id?: string | null
          porter_end_km?: number | null
          porter_start_km?: number | null
          porter_total_km?: number | null
          project_id?: string | null
          purpose?: string
          requester_id?: string
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          split_batch_id?: string | null
          status?: string
          tags?: string[] | null
          total_splits?: number | null
          transport_trips?: Json | null
          updated_at?: string
          urgency?: string
          utr_match_confidence?: number | null
          utr_number?: string | null
          utr_requires_manual_review?: boolean | null
          utr_verified_at?: string | null
          utr_verified_by?: string | null
          vendor_account_number?: string | null
          vendor_bank_details?: string
          vendor_contact_person?: string | null
          vendor_ifsc_code?: string | null
          vendor_name?: string
          vendor_phone?: string | null
          vendor_upi?: string | null
          wo_number?: string | null
          work_order_id?: string | null
          work_proof_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_accounts_executed_by_fkey"
            columns: ["accounts_executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_accounts_reversed_by_fkey"
            columns: ["accounts_reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_auditor_approved_by_fkey"
            columns: ["auditor_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_boi_approved_by_fkey"
            columns: ["boi_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "project_boq"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_bulk_batch_id_fkey"
            columns: ["bulk_batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_converted_by_fkey"
            columns: ["converted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_director_approved_by_fkey"
            columns: ["director_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_gm_approved_by_fkey"
            columns: ["gm_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_gmo_approved_by_fkey"
            columns: ["gmo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_original_batch_id_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_smo_approved_by_fkey"
            columns: ["smo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_utr_verified_by_fkey"
            columns: ["utr_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_tags: {
        Row: {
          code: string
          color: string
          created_at: string
          created_by: string | null
          departments: string[] | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          created_by?: string | null
          departments?: string[] | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          created_by?: string | null
          departments?: string[] | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      petty_cash_ledger: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          cumulative_spend: number
          department: string | null
          executed_at: string | null
          executed_by: string | null
          id: string
          payment_request_id: string | null
          purpose: string | null
          report_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          cumulative_spend?: number
          department?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          payment_request_id?: string | null
          purpose?: string | null
          report_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          cumulative_spend?: number
          department?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          payment_request_id?: string | null
          purpose?: string | null
          report_id?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      petty_cash_refill_requests: {
        Row: {
          accounts_executed_at: string | null
          accounts_executed_by: string | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          created_at: string | null
          current_balance: number
          director_approved_at: string | null
          director_approved_by: string | null
          id: string
          notes: string | null
          payment_request_id: string | null
          refill_number: number
          report_id: string | null
          requested_amount: number
          status: string
        }
        Insert: {
          accounts_executed_at?: string | null
          accounts_executed_by?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          current_balance: number
          director_approved_at?: string | null
          director_approved_by?: string | null
          id?: string
          notes?: string | null
          payment_request_id?: string | null
          refill_number?: number
          report_id?: string | null
          requested_amount: number
          status?: string
        }
        Update: {
          accounts_executed_at?: string | null
          accounts_executed_by?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          current_balance?: number
          director_approved_at?: string | null
          director_approved_by?: string | null
          id?: string
          notes?: string | null
          payment_request_id?: string | null
          refill_number?: number
          report_id?: string | null
          requested_amount?: number
          status?: string
        }
        Relationships: []
      }
      petty_cash_reports: {
        Row: {
          auditor_reviewed_at: string | null
          auditor_reviewed_by: string | null
          closing_balance: number | null
          created_at: string | null
          created_by: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          id: string
          notes: string | null
          opening_balance: number | null
          period_end: string
          period_start: string
          report_number: number
          status: string
          total_amount: number
          transaction_count: number
        }
        Insert: {
          auditor_reviewed_at?: string | null
          auditor_reviewed_by?: string | null
          closing_balance?: number | null
          created_at?: string | null
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number | null
          period_end: string
          period_start: string
          report_number?: number
          status?: string
          total_amount: number
          transaction_count: number
        }
        Update: {
          auditor_reviewed_at?: string | null
          auditor_reviewed_by?: string | null
          closing_balance?: number | null
          created_at?: string | null
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number | null
          period_end?: string
          period_start?: string
          report_number?: number
          status?: string
          total_amount?: number
          transaction_count?: number
        }
        Relationships: []
      }
      procurement_timeline: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          material_request_id: string | null
          performed_by: string | null
          performed_by_name: string | null
          vendor_work_request_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          material_request_id?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          vendor_work_request_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          material_request_id?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          vendor_work_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_timeline_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_timeline_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_timeline_vendor_work_request_id_fkey"
            columns: ["vendor_work_request_id"]
            isOneToOne: false
            referencedRelation: "vendor_work_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_gmo_categories: {
        Row: {
          created_at: string
          created_by: string | null
          gmo_category_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gmo_category_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gmo_category_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_gmo_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_gmo_categories_gmo_category_id_fkey"
            columns: ["gmo_category_id"]
            isOneToOne: false
            referencedRelation: "gmo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_gmo_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_activated: boolean | null
          created_at: string | null
          department: string
          department_type: string | null
          destination: string | null
          email: string
          id: string
          is_active: boolean
          login_credential_password: string | null
          login_enabled: boolean
          name: string
          office_number: string | null
          onboarding_completed: boolean | null
          onboarding_status: string | null
          password: string | null
          role: string
          status: string | null
          updated_at: string | null
          username: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_activated?: boolean | null
          created_at?: string | null
          department: string
          department_type?: string | null
          destination?: string | null
          email: string
          id: string
          is_active?: boolean
          login_credential_password?: string | null
          login_enabled?: boolean
          name?: string
          office_number?: string | null
          onboarding_completed?: boolean | null
          onboarding_status?: string | null
          password?: string | null
          role: string
          status?: string | null
          updated_at?: string | null
          username?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_activated?: boolean | null
          created_at?: string | null
          department?: string
          department_type?: string | null
          destination?: string | null
          email?: string
          id?: string
          is_active?: boolean
          login_credential_password?: string | null
          login_enabled?: boolean
          name?: string
          office_number?: string | null
          onboarding_completed?: boolean | null
          onboarding_status?: string | null
          password?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
          username?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      project_assignment_audit: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by_admin_id: string | null
          id: string
          new_assigned_engineer_id: string | null
          new_assigned_gmo_id: string | null
          new_assigned_smo_id: string | null
          new_intake_status: string | null
          old_assigned_engineer_id: string | null
          old_assigned_gmo_id: string | null
          old_assigned_smo_id: string | null
          old_intake_status: string | null
          project_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by_admin_id?: string | null
          id?: string
          new_assigned_engineer_id?: string | null
          new_assigned_gmo_id?: string | null
          new_assigned_smo_id?: string | null
          new_intake_status?: string | null
          old_assigned_engineer_id?: string | null
          old_assigned_gmo_id?: string | null
          old_assigned_smo_id?: string | null
          old_intake_status?: string | null
          project_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by_admin_id?: string | null
          id?: string
          new_assigned_engineer_id?: string | null
          new_assigned_gmo_id?: string | null
          new_assigned_smo_id?: string | null
          new_intake_status?: string | null
          old_assigned_engineer_id?: string | null
          old_assigned_gmo_id?: string | null
          old_assigned_smo_id?: string | null
          old_intake_status?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignment_audit_changed_by_admin_id_fkey"
            columns: ["changed_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_audit_new_assigned_engineer_id_fkey"
            columns: ["new_assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_audit_new_assigned_gmo_id_fkey"
            columns: ["new_assigned_gmo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_audit_new_assigned_smo_id_fkey"
            columns: ["new_assigned_smo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_audit_old_assigned_engineer_id_fkey"
            columns: ["old_assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_audit_old_assigned_gmo_id_fkey"
            columns: ["old_assigned_gmo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_audit_old_assigned_smo_id_fkey"
            columns: ["old_assigned_smo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_audit_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignment_audit_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_boq: {
        Row: {
          actual_total: number | null
          actual_unit_cost: number | null
          category: string | null
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          delivery_notes: string | null
          estimated_unit_cost: number | null
          id: string
          line_number: number
          linked_po_id: string | null
          linked_wo_id: string | null
          material_name: string
          notes: string | null
          ordered_at: string | null
          phase_id: string | null
          project_id: string
          quantity: number
          sourced_via: string | null
          specification: string | null
          status: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          actual_total?: number | null
          actual_unit_cost?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          estimated_unit_cost?: number | null
          id?: string
          line_number: number
          linked_po_id?: string | null
          linked_wo_id?: string | null
          material_name: string
          notes?: string | null
          ordered_at?: string | null
          phase_id?: string | null
          project_id: string
          quantity: number
          sourced_via?: string | null
          specification?: string | null
          status?: string | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          actual_total?: number | null
          actual_unit_cost?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          estimated_unit_cost?: number | null
          id?: string
          line_number?: number
          linked_po_id?: string | null
          linked_wo_id?: string | null
          material_name?: string
          notes?: string | null
          ordered_at?: string | null
          phase_id?: string | null
          project_id?: string
          quantity?: number
          sourced_via?: string | null
          specification?: string | null
          status?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_boq_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boq_linked_po_id_fkey"
            columns: ["linked_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boq_linked_wo_id_fkey"
            columns: ["linked_wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boq_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boq_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_boq_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_execution_proofs: {
        Row: {
          file_url: string | null
          id: string
          location_data: Json | null
          notes: string | null
          phase_id: string | null
          project_id: string
          proof_type: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_url?: string | null
          id?: string
          location_data?: Json | null
          notes?: string | null
          phase_id?: string | null
          project_id: string
          proof_type?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_url?: string | null
          id?: string
          location_data?: Json | null
          notes?: string | null
          phase_id?: string | null
          project_id?: string
          proof_type?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_execution_proofs_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_execution_proofs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_execution_proofs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_execution_proofs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_inventory: {
        Row: {
          audit_notes: string | null
          audit_status: string | null
          audited_at: string | null
          audited_by: string | null
          challan_number: string | null
          created_at: string | null
          delivery_date: string | null
          id: string
          material_name: string
          material_request_id: string | null
          phase_id: string | null
          project_id: string
          quantity_ordered: number | null
          quantity_received: number
          quantity_used: number
          specification: string | null
          unit: string
          unit_price: number | null
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          audit_notes?: string | null
          audit_status?: string | null
          audited_at?: string | null
          audited_by?: string | null
          challan_number?: string | null
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          material_name: string
          material_request_id?: string | null
          phase_id?: string | null
          project_id: string
          quantity_ordered?: number | null
          quantity_received?: number
          quantity_used?: number
          specification?: string | null
          unit: string
          unit_price?: number | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          audit_notes?: string | null
          audit_status?: string | null
          audited_at?: string | null
          audited_by?: string | null
          challan_number?: string | null
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          material_name?: string
          material_request_id?: string | null
          phase_id?: string | null
          project_id?: string
          quantity_ordered?: number | null
          quantity_received?: number
          quantity_used?: number
          specification?: string | null
          unit?: string
          unit_price?: number | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_inventory_audited_by_fkey"
            columns: ["audited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inventory_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inventory_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          actual_date: string | null
          completion_percentage: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          milestone_name: string
          phase_id: string | null
          planned_date: string
          project_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_date?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          milestone_name: string
          phase_id?: string | null
          planned_date: string
          project_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_date?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          milestone_name?: string
          phase_id?: string | null
          planned_date?: string
          project_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          actual_cost: number | null
          completed_at: string | null
          completion_percentage: number | null
          created_at: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          phase_name: string
          phase_order: number
          project_id: string
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          phase_name: string
          phase_order: number
          project_id: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          phase_name?: string
          phase_order?: number
          project_id?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timeline: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          project_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          project_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timeline_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_timeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_variations: {
        Row: {
          amount: number
          approved_at: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          project_id: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          project_id?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          project_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_variations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_variations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_verticals: {
        Row: {
          category: string
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          default_duration_days: number | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category: string
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_duration_days?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: string
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_duration_days?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_verticals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          admin_review_notes: string | null
          admin_reviewed_at: string | null
          admin_reviewed_by: string | null
          approved_budget: number | null
          assigned_engineer_id: string | null
          assigned_manager_id: string | null
          assigned_project_engineer_id: string | null
          assigned_site_manager_id: string | null
          boq_approved_at: string | null
          boq_approved_by: string | null
          boq_rejection_reason: string | null
          boq_smo_approved_at: string | null
          boq_smo_approved_by: string | null
          boq_submitted_at: string | null
          boq_submitted_by: string | null
          client_contact: string
          client_name: string
          created_at: string | null
          created_by: string | null
          current_phase_id: string | null
          current_spend: number | null
          customer_testimonial_text: string | null
          customer_testimonial_url: string | null
          deal_file_url: string | null
          deal_uploaded_at: string | null
          deal_uploaded_by: string | null
          department: string | null
          discount_percentage: number | null
          execution_started_at: string | null
          id: string
          intake_status: string | null
          is_budget_frozen: boolean | null
          jv_commitments: string | null
          lifecycle_stage: string | null
          location_city: string
          location_state: string
          material_status: string | null
          onboarded_date: string | null
          overall_completion_percentage: number | null
          project_category: string | null
          project_category_tags: string[] | null
          project_id: string
          project_name: string
          project_type: string | null
          project_vertical: string | null
          remarks: string | null
          sourcing_started_at: string | null
          stage_boq_approved_at: string | null
          stage_boq_submitted_at: string | null
          stage_completed_at: string | null
          stage_engineering_assigned_at: string | null
          stage_execution_at: string | null
          stage_new_deal_at: string | null
          stage_sourcing_at: string | null
          status: string | null
          target_completion_date: string | null
          target_start_date: string
          total_project_value: number | null
          updated_at: string | null
          uploaded_by_bd_data_id: string | null
          vertical: string
          vertical_id: string | null
          work_order_count_max: number | null
          work_order_count_min: number | null
          work_order_status: string | null
        }
        Insert: {
          admin_review_notes?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          approved_budget?: number | null
          assigned_engineer_id?: string | null
          assigned_manager_id?: string | null
          assigned_project_engineer_id?: string | null
          assigned_site_manager_id?: string | null
          boq_approved_at?: string | null
          boq_approved_by?: string | null
          boq_rejection_reason?: string | null
          boq_smo_approved_at?: string | null
          boq_smo_approved_by?: string | null
          boq_submitted_at?: string | null
          boq_submitted_by?: string | null
          client_contact: string
          client_name: string
          created_at?: string | null
          created_by?: string | null
          current_phase_id?: string | null
          current_spend?: number | null
          customer_testimonial_text?: string | null
          customer_testimonial_url?: string | null
          deal_file_url?: string | null
          deal_uploaded_at?: string | null
          deal_uploaded_by?: string | null
          department?: string | null
          discount_percentage?: number | null
          execution_started_at?: string | null
          id?: string
          intake_status?: string | null
          is_budget_frozen?: boolean | null
          jv_commitments?: string | null
          lifecycle_stage?: string | null
          location_city: string
          location_state: string
          material_status?: string | null
          onboarded_date?: string | null
          overall_completion_percentage?: number | null
          project_category?: string | null
          project_category_tags?: string[] | null
          project_id: string
          project_name: string
          project_type?: string | null
          project_vertical?: string | null
          remarks?: string | null
          sourcing_started_at?: string | null
          stage_boq_approved_at?: string | null
          stage_boq_submitted_at?: string | null
          stage_completed_at?: string | null
          stage_engineering_assigned_at?: string | null
          stage_execution_at?: string | null
          stage_new_deal_at?: string | null
          stage_sourcing_at?: string | null
          status?: string | null
          target_completion_date?: string | null
          target_start_date: string
          total_project_value?: number | null
          updated_at?: string | null
          uploaded_by_bd_data_id?: string | null
          vertical: string
          vertical_id?: string | null
          work_order_count_max?: number | null
          work_order_count_min?: number | null
          work_order_status?: string | null
        }
        Update: {
          admin_review_notes?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          approved_budget?: number | null
          assigned_engineer_id?: string | null
          assigned_manager_id?: string | null
          assigned_project_engineer_id?: string | null
          assigned_site_manager_id?: string | null
          boq_approved_at?: string | null
          boq_approved_by?: string | null
          boq_rejection_reason?: string | null
          boq_smo_approved_at?: string | null
          boq_smo_approved_by?: string | null
          boq_submitted_at?: string | null
          boq_submitted_by?: string | null
          client_contact?: string
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          current_phase_id?: string | null
          current_spend?: number | null
          customer_testimonial_text?: string | null
          customer_testimonial_url?: string | null
          deal_file_url?: string | null
          deal_uploaded_at?: string | null
          deal_uploaded_by?: string | null
          department?: string | null
          discount_percentage?: number | null
          execution_started_at?: string | null
          id?: string
          intake_status?: string | null
          is_budget_frozen?: boolean | null
          jv_commitments?: string | null
          lifecycle_stage?: string | null
          location_city?: string
          location_state?: string
          material_status?: string | null
          onboarded_date?: string | null
          overall_completion_percentage?: number | null
          project_category?: string | null
          project_category_tags?: string[] | null
          project_id?: string
          project_name?: string
          project_type?: string | null
          project_vertical?: string | null
          remarks?: string | null
          sourcing_started_at?: string | null
          stage_boq_approved_at?: string | null
          stage_boq_submitted_at?: string | null
          stage_completed_at?: string | null
          stage_engineering_assigned_at?: string | null
          stage_execution_at?: string | null
          stage_new_deal_at?: string | null
          stage_sourcing_at?: string | null
          status?: string | null
          target_completion_date?: string | null
          target_start_date?: string
          total_project_value?: number | null
          updated_at?: string | null
          uploaded_by_bd_data_id?: string | null
          vertical?: string
          vertical_id?: string | null
          work_order_count_max?: number | null
          work_order_count_min?: number | null
          work_order_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_admin_reviewed_by_fkey"
            columns: ["admin_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_engineer_id_fkey"
            columns: ["assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_project_engineer_id_fkey"
            columns: ["assigned_project_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_site_manager_id_fkey"
            columns: ["assigned_site_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_boq_approved_by_fkey"
            columns: ["boq_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_boq_smo_approved_by_fkey"
            columns: ["boq_smo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_boq_submitted_by_fkey"
            columns: ["boq_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_current_phase_id_fkey"
            columns: ["current_phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_uploaded_by_fkey"
            columns: ["deal_uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_uploaded_by_bd_data_id_fkey"
            columns: ["uploaded_by_bd_data_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "project_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          purchase_order_id: string | null
          quantity: number
          total_price: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          purchase_order_id?: string | null
          quantity: number
          total_price: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          purchase_order_id?: string | null
          quantity?: number
          total_price?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          material_request_id: string | null
          po_number: string
          project_id: string | null
          status: string
          total_amount: number
          updated_at: string | null
          vendor_quote_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_request_id?: string | null
          po_number: string
          project_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
          vendor_quote_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_request_id?: string | null
          po_number?: string
          project_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
          vendor_quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_quote_id_fkey"
            columns: ["vendor_quote_id"]
            isOneToOne: false
            referencedRelation: "vendor_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_progress_logs: {
        Row: {
          created_at: string
          id: string
          material_request_id: string
          status_update: string | null
          update_text: string
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          material_request_id: string
          status_update?: string | null
          update_text: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          material_request_id?: string
          status_update?: string | null
          update_text?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_progress_logs_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_progress_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_additions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          proof_url: string | null
          record_id: string
          remarks: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          proof_url?: string | null
          record_id: string
          remarks?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          proof_url?: string | null
          record_id?: string
          remarks?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_additions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "rental_monthly_records"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_categories: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          name: string
          owner_department: string | null
          owner_role: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          name: string
          owner_department?: string | null
          owner_role: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          name?: string
          owner_department?: string | null
          owner_role?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rental_deductions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          proof_url: string | null
          record_id: string | null
          remarks: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          proof_url?: string | null
          record_id?: string | null
          remarks?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          proof_url?: string | null
          record_id?: string | null
          remarks?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_deductions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "rental_monthly_records"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_discussions: {
        Row: {
          attachments: string[] | null
          created_at: string | null
          id: string
          message: string
          record_id: string | null
          user_id: string | null
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string | null
          id?: string
          message: string
          record_id?: string | null
          user_id?: string | null
        }
        Update: {
          attachments?: string[] | null
          created_at?: string | null
          id?: string
          message?: string
          record_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_discussions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "rental_monthly_records"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          proof_url: string | null
          property_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date: string
          id?: string
          proof_url?: string | null
          property_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          proof_url?: string | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "rental_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_monthly_records: {
        Row: {
          addition_total: number | null
          base_rent: number
          created_at: string | null
          deduction_total: number | null
          electricity_bill_amount: number | null
          electricity_bill_link: string | null
          electricity_bill_proof_url: string | null
          id: string
          month_year: string
          net_payable_amount: number | null
          paid_at: string | null
          paid_to_account_number: string | null
          paid_to_bank_name: string | null
          paid_to_holder_name: string | null
          paid_to_ifsc_code: string | null
          payment_date: string | null
          payment_method: string | null
          payment_mode: string | null
          payment_proof_link: string | null
          payment_proof_url: string | null
          payment_utr: string | null
          property_id: string | null
          rejection_reason: string | null
          status: string | null
          updated_at: string | null
          utr_number: string | null
        }
        Insert: {
          addition_total?: number | null
          base_rent: number
          created_at?: string | null
          deduction_total?: number | null
          electricity_bill_amount?: number | null
          electricity_bill_link?: string | null
          electricity_bill_proof_url?: string | null
          id?: string
          month_year: string
          net_payable_amount?: number | null
          paid_at?: string | null
          paid_to_account_number?: string | null
          paid_to_bank_name?: string | null
          paid_to_holder_name?: string | null
          paid_to_ifsc_code?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_proof_link?: string | null
          payment_proof_url?: string | null
          payment_utr?: string | null
          property_id?: string | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
          utr_number?: string | null
        }
        Update: {
          addition_total?: number | null
          base_rent?: number
          created_at?: string | null
          deduction_total?: number | null
          electricity_bill_amount?: number | null
          electricity_bill_link?: string | null
          electricity_bill_proof_url?: string | null
          id?: string
          month_year?: string
          net_payable_amount?: number | null
          paid_at?: string | null
          paid_to_account_number?: string | null
          paid_to_bank_name?: string | null
          paid_to_holder_name?: string | null
          paid_to_ifsc_code?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_proof_link?: string | null
          payment_proof_url?: string | null
          payment_utr?: string | null
          property_id?: string | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
          utr_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_monthly_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "rental_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_properties: {
        Row: {
          account_number: string | null
          account_type: string | null
          advance_amount: number | null
          advance_paid_date: string | null
          advance_paid_on: string | null
          agreement_copy_link: string | null
          agreement_expiry_date: string | null
          agreement_sign_date: string | null
          agreement_start_date: string | null
          area: string | null
          bank_name: string | null
          branch_name: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          deduction_percentage: number | null
          edit_access_enabled: boolean | null
          farm_name: string | null
          google_drive_folder_link: string | null
          google_map_link: string | null
          holder_name: string | null
          id: string
          ifsc_code: string | null
          location: string | null
          monthly_base_rent: number
          moratorium_period: string | null
          owner_name: string | null
          partner_details: Json | null
          phone_number: string | null
          quotation_amount: number | null
          remarks: string | null
          rent_after_deduction: number | null
          rent_after_quotation_deduction: number | null
          rent_due_day: number | null
          rent_hike_enabled: boolean | null
          rent_hike_interval_years: number | null
          rent_hike_percent: number | null
          rent_hike_percentage: number | null
          rent_start_date: string | null
          rent_starts_from: string | null
          status: string | null
          title: string
          updated_at: string | null
          upi_id: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          advance_amount?: number | null
          advance_paid_date?: string | null
          advance_paid_on?: string | null
          agreement_copy_link?: string | null
          agreement_expiry_date?: string | null
          agreement_sign_date?: string | null
          agreement_start_date?: string | null
          area?: string | null
          bank_name?: string | null
          branch_name?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deduction_percentage?: number | null
          edit_access_enabled?: boolean | null
          farm_name?: string | null
          google_drive_folder_link?: string | null
          google_map_link?: string | null
          holder_name?: string | null
          id?: string
          ifsc_code?: string | null
          location?: string | null
          monthly_base_rent?: number
          moratorium_period?: string | null
          owner_name?: string | null
          partner_details?: Json | null
          phone_number?: string | null
          quotation_amount?: number | null
          remarks?: string | null
          rent_after_deduction?: number | null
          rent_after_quotation_deduction?: number | null
          rent_due_day?: number | null
          rent_hike_enabled?: boolean | null
          rent_hike_interval_years?: number | null
          rent_hike_percent?: number | null
          rent_hike_percentage?: number | null
          rent_start_date?: string | null
          rent_starts_from?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          upi_id?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          advance_amount?: number | null
          advance_paid_date?: string | null
          advance_paid_on?: string | null
          agreement_copy_link?: string | null
          agreement_expiry_date?: string | null
          agreement_sign_date?: string | null
          agreement_start_date?: string | null
          area?: string | null
          bank_name?: string | null
          branch_name?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deduction_percentage?: number | null
          edit_access_enabled?: boolean | null
          farm_name?: string | null
          google_drive_folder_link?: string | null
          google_map_link?: string | null
          holder_name?: string | null
          id?: string
          ifsc_code?: string | null
          location?: string | null
          monthly_base_rent?: number
          moratorium_period?: string | null
          owner_name?: string | null
          partner_details?: Json | null
          phone_number?: string | null
          quotation_amount?: number | null
          remarks?: string | null
          rent_after_deduction?: number | null
          rent_after_quotation_deduction?: number | null
          rent_due_day?: number | null
          rent_hike_enabled?: boolean | null
          rent_hike_interval_years?: number | null
          rent_hike_percent?: number | null
          rent_hike_percentage?: number | null
          rent_start_date?: string | null
          rent_starts_from?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_properties_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "rental_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_property_remarks: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          property_id: string
          remark: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          property_id: string
          remark: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          property_id?: string
          remark?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_property_remarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_property_remarks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "rental_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_approvals: {
        Row: {
          account_approved_by: string | null
          account_comment: string | null
          audited_by_auditor: string | null
          audited_by_director: string | null
          auditor_comment: string | null
          ceo_approved_by: string | null
          ceo_comment: string | null
          created_at: string | null
          director_comment: string | null
          file_name: string
          file_path: string
          from_day: number
          id: string
          month: number
          payroll_id: string
          status: string
          to_day: number
          updated_at: string | null
          uploaded_by: string | null
          year: number
        }
        Insert: {
          account_approved_by?: string | null
          account_comment?: string | null
          audited_by_auditor?: string | null
          audited_by_director?: string | null
          auditor_comment?: string | null
          ceo_approved_by?: string | null
          ceo_comment?: string | null
          created_at?: string | null
          director_comment?: string | null
          file_name: string
          file_path: string
          from_day: number
          id?: string
          month: number
          payroll_id: string
          status: string
          to_day: number
          updated_at?: string | null
          uploaded_by?: string | null
          year: number
        }
        Update: {
          account_approved_by?: string | null
          account_comment?: string | null
          audited_by_auditor?: string | null
          audited_by_director?: string | null
          auditor_comment?: string | null
          ceo_approved_by?: string | null
          ceo_comment?: string | null
          created_at?: string | null
          director_comment?: string | null
          file_name?: string
          file_path?: string
          from_day?: number
          id?: string
          month?: number
          payroll_id?: string
          status?: string
          to_day?: number
          updated_at?: string | null
          uploaded_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_approvals_account_approved_by_fkey"
            columns: ["account_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_approvals_audited_by_auditor_fkey"
            columns: ["audited_by_auditor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_approvals_audited_by_director_fkey"
            columns: ["audited_by_director"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_approvals_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_approvals_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_batch_employees: {
        Row: {
          account_number: string | null
          bank_name: string | null
          basic_salary: number
          batch_id: string
          created_at: string | null
          days_in_month: number
          department: string
          designation: string | null
          earned_salary: number
          employee_id: string | null
          employee_name: string
          esi_amount: number
          final_salary: number | null
          id: string
          ifsc_code: string | null
          incentive: number
          incentive_amount: number
          increment: number
          increment_amount: number
          lop_amount: number
          lop_bucket: string
          lop_days: number
          net_pay: number
          other_deduction: number
          other_earning: number
          per_day_salary: number
          pf_amount: number
          profile_id: string | null
          selected_days: number
          slip_path: string | null
          status: string
          tds: number
          tds_amount: number
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          basic_salary?: number
          batch_id: string
          created_at?: string | null
          days_in_month?: number
          department?: string
          designation?: string | null
          earned_salary?: number
          employee_id?: string | null
          employee_name?: string
          esi_amount?: number
          final_salary?: number | null
          id?: string
          ifsc_code?: string | null
          incentive?: number
          incentive_amount?: number
          increment?: number
          increment_amount?: number
          lop_amount?: number
          lop_bucket?: string
          lop_days?: number
          net_pay?: number
          other_deduction?: number
          other_earning?: number
          per_day_salary?: number
          pf_amount?: number
          profile_id?: string | null
          selected_days?: number
          slip_path?: string | null
          status?: string
          tds?: number
          tds_amount?: number
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          basic_salary?: number
          batch_id?: string
          created_at?: string | null
          days_in_month?: number
          department?: string
          designation?: string | null
          earned_salary?: number
          employee_id?: string | null
          employee_name?: string
          esi_amount?: number
          final_salary?: number | null
          id?: string
          ifsc_code?: string | null
          incentive?: number
          incentive_amount?: number
          increment?: number
          increment_amount?: number
          lop_amount?: number
          lop_bucket?: string
          lop_days?: number
          net_pay?: number
          other_deduction?: number
          other_earning?: number
          per_day_salary?: number
          pf_amount?: number
          profile_id?: string | null
          selected_days?: number
          slip_path?: string | null
          status?: string
          tds?: number
          tds_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_salary_batch_employees_profile_id"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batch_employees_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "salary_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batch_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batch_employees_profile_id_fk"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_batches: {
        Row: {
          accounts_processed_at: string | null
          accounts_processed_by: string | null
          auditor_approved_at: string | null
          auditor_approved_by: string | null
          batch_code: string
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          created_at: string | null
          created_by: string
          department: string | null
          from_day: number
          hr_verified_at: string | null
          hr_verified_by: string | null
          id: string
          month: number
          paid_at: string | null
          paid_by: string | null
          paid_date: string | null
          prepared_by: string | null
          rejection_reason: string | null
          released_at: string | null
          released_by: string | null
          selected_days_override: number[] | null
          status: string
          to_day: number
          total_amount: number | null
          total_employees: number | null
          total_incentives: number | null
          total_lop_amount: number | null
          total_net_pay: number | null
          total_salary: number
          total_tds: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          accounts_processed_at?: string | null
          accounts_processed_by?: string | null
          auditor_approved_at?: string | null
          auditor_approved_by?: string | null
          batch_code?: string
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          created_by?: string
          department?: string | null
          from_day?: number
          hr_verified_at?: string | null
          hr_verified_by?: string | null
          id?: string
          month: number
          paid_at?: string | null
          paid_by?: string | null
          paid_date?: string | null
          prepared_by?: string | null
          rejection_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          selected_days_override?: number[] | null
          status?: string
          to_day?: number
          total_amount?: number | null
          total_employees?: number | null
          total_incentives?: number | null
          total_lop_amount?: number | null
          total_net_pay?: number | null
          total_salary?: number
          total_tds?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          accounts_processed_at?: string | null
          accounts_processed_by?: string | null
          auditor_approved_at?: string | null
          auditor_approved_by?: string | null
          batch_code?: string
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          created_by?: string
          department?: string | null
          from_day?: number
          hr_verified_at?: string | null
          hr_verified_by?: string | null
          id?: string
          month?: number
          paid_at?: string | null
          paid_by?: string | null
          paid_date?: string | null
          prepared_by?: string | null
          rejection_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          selected_days_override?: number[] | null
          status?: string
          to_day?: number
          total_amount?: number | null
          total_employees?: number | null
          total_incentives?: number | null
          total_lop_amount?: number | null
          total_net_pay?: number | null
          total_salary?: number
          total_tds?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_batches_accounts_processed_by_fkey"
            columns: ["accounts_processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batches_auditor_approved_by_fkey"
            columns: ["auditor_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batches_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batches_hr_verified_by_fkey"
            columns: ["hr_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batches_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batches_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_batches_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_slips: {
        Row: {
          created_at: string | null
          department: string | null
          employee_id: string
          employee_name: string
          error_message: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          month: number
          pdf_path: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["salary_slip_status"]
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          employee_id: string
          employee_name: string
          error_message?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          month: number
          pdf_path?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["salary_slip_status"]
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          department?: string | null
          employee_id?: string
          employee_name?: string
          error_message?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          month?: number
          pdf_path?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["salary_slip_status"]
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      selfie_records: {
        Row: {
          captured_at: string
          created_at: string
          date: string
          expires_at: string
          id: string
          selfie_type: string
          selfie_url: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          date: string
          expires_at?: string
          id?: string
          selfie_type: string
          selfie_url: string
          user_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          date?: string
          expires_at?: string
          id?: string
          selfie_type?: string
          selfie_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "selfie_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignment_history: {
        Row: {
          action: string
          assignment_id: string | null
          created_at: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
          user_id: string
        }
        Insert: {
          action: string
          assignment_id?: string | null
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          user_id: string
        }
        Update: {
          action?: string
          assignment_id?: string | null
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_user_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignment_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_breaks: {
        Row: {
          break_end: string | null
          break_start: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          reason: string | null
          session_id: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          reason?: string | null
          session_id: string
        }
        Update: {
          break_end?: string | null
          break_start?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          reason?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_breaks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_eod_reports: {
        Row: {
          created_at: string | null
          id: string
          session_id: string
          submitted_at: string | null
          summary: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id: string
          submitted_at?: string | null
          summary: string
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string
          submitted_at?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_eod_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_hourly_slots: {
        Row: {
          created_at: string | null
          id: string
          plan: string | null
          plan_submitted_at: string | null
          report: string | null
          report_submitted_at: string | null
          session_id: string
          slot_end: string | null
          slot_number: number
          slot_start: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan?: string | null
          plan_submitted_at?: string | null
          report?: string | null
          report_submitted_at?: string | null
          session_id: string
          slot_end?: string | null
          slot_number: number
          slot_start: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          plan?: string | null
          plan_submitted_at?: string | null
          report?: string | null
          report_submitted_at?: string | null
          session_id?: string
          slot_end?: string | null
          slot_number?: number
          slot_start?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_hourly_slots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_sessions: {
        Row: {
          created_at: string | null
          date: string
          day_plan: string | null
          id: string
          login_location: Json | null
          login_selfie_url: string
          logout_location: Json | null
          logout_selfie_url: string | null
          max_hours: number
          net_working_minutes: number | null
          shift_end: string | null
          shift_start: string
          status: string
          target_hours: number
          total_break_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          day_plan?: string | null
          id?: string
          login_location?: Json | null
          login_selfie_url: string
          logout_location?: Json | null
          logout_selfie_url?: string | null
          max_hours?: number
          net_working_minutes?: number | null
          shift_end?: string | null
          shift_start?: string
          status?: string
          target_hours?: number
          total_break_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          day_plan?: string | null
          id?: string
          login_location?: Json | null
          login_selfie_url?: string
          logout_location?: Json | null
          logout_selfie_url?: string | null
          max_hours?: number
          net_working_minutes?: number | null
          shift_end?: string | null
          shift_start?: string
          status?: string
          target_hours?: number
          total_break_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_user_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          deactivated_at: string | null
          id: string
          is_active: boolean | null
          max_hours: number
          target_hours: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean | null
          max_hours?: number
          target_hours?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean | null
          max_hours?: number
          target_hours?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_user_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_user_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          assigned_person_name: string
          assigned_person_phone: string | null
          assigned_person_user_id: string | null
          assignment_remarks: string | null
          created_at: string | null
          expected_visit_date: string | null
          id: string
          request_id: string
          sla1_deadline: string
          sla1_status: string | null
          visit_instructions: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          assigned_person_name: string
          assigned_person_phone?: string | null
          assigned_person_user_id?: string | null
          assignment_remarks?: string | null
          created_at?: string | null
          expected_visit_date?: string | null
          id?: string
          request_id: string
          sla1_deadline: string
          sla1_status?: string | null
          visit_instructions?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          assigned_person_name?: string
          assigned_person_phone?: string | null
          assigned_person_user_id?: string | null
          assignment_remarks?: string | null
          created_at?: string | null
          expected_visit_date?: string | null
          id?: string
          request_id?: string
          sla1_deadline?: string
          sla1_status?: string | null
          visit_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_assignments_assigned_person_user_id_fkey"
            columns: ["assigned_person_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_assignments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "site_visit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_daily_reports: {
        Row: {
          assignment_id: string
          challenges_faced: string | null
          farm_manager_remarks: string | null
          farm_manager_review_at: string | null
          farm_manager_reviewed: boolean | null
          geotagged_image_urls: string[]
          id: string
          is_late_submission: boolean | null
          is_rental_polyhouse_visit: boolean | null
          is_visit_complete: boolean | null
          itc_data_available: boolean | null
          itc_data_reference: string | null
          itc_document_url: string | null
          itc_remarks: string | null
          location_accuracy_meters: number | null
          location_lat: number | null
          location_lng: number | null
          login_time: string
          logout_time: string
          next_day_plan: string | null
          report_date: string
          report_docx_url: string | null
          request_id: string
          site_location_address: string
          site_location_title: string
          site_observations: string | null
          soil_water_test_report_url: string | null
          submitted_at: string | null
          submitted_by: string | null
          submitted_by_name: string
          total_hours_on_site: number | null
          traveling_mode: string | null
          visit_day_number: number
          work_summary: string
        }
        Insert: {
          assignment_id: string
          challenges_faced?: string | null
          farm_manager_remarks?: string | null
          farm_manager_review_at?: string | null
          farm_manager_reviewed?: boolean | null
          geotagged_image_urls?: string[]
          id?: string
          is_late_submission?: boolean | null
          is_rental_polyhouse_visit?: boolean | null
          is_visit_complete?: boolean | null
          itc_data_available?: boolean | null
          itc_data_reference?: string | null
          itc_document_url?: string | null
          itc_remarks?: string | null
          location_accuracy_meters?: number | null
          location_lat?: number | null
          location_lng?: number | null
          login_time: string
          logout_time: string
          next_day_plan?: string | null
          report_date: string
          report_docx_url?: string | null
          request_id: string
          site_location_address: string
          site_location_title: string
          site_observations?: string | null
          soil_water_test_report_url?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_name: string
          total_hours_on_site?: number | null
          traveling_mode?: string | null
          visit_day_number?: number
          work_summary: string
        }
        Update: {
          assignment_id?: string
          challenges_faced?: string | null
          farm_manager_remarks?: string | null
          farm_manager_review_at?: string | null
          farm_manager_reviewed?: boolean | null
          geotagged_image_urls?: string[]
          id?: string
          is_late_submission?: boolean | null
          is_rental_polyhouse_visit?: boolean | null
          is_visit_complete?: boolean | null
          itc_data_available?: boolean | null
          itc_data_reference?: string | null
          itc_document_url?: string | null
          itc_remarks?: string | null
          location_accuracy_meters?: number | null
          location_lat?: number | null
          location_lng?: number | null
          login_time?: string
          logout_time?: string
          next_day_plan?: string | null
          report_date?: string
          report_docx_url?: string | null
          request_id?: string
          site_location_address?: string
          site_location_title?: string
          site_observations?: string | null
          soil_water_test_report_url?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_name?: string
          total_hours_on_site?: number | null
          traveling_mode?: string | null
          visit_day_number?: number
          work_summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_daily_reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "site_visit_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_daily_reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "site_visit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_daily_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_requests: {
        Row: {
          assigned_farm_manager_id: string | null
          client_contact_name: string
          client_email: string | null
          client_name: string
          client_phone: string
          client_type: string | null
          closed_at: string | null
          closed_by: string | null
          closure_remarks: string | null
          created_at: string | null
          id: string
          location_address: string
          location_city: string
          location_google_maps_url: string | null
          location_lat: number | null
          location_lng: number | null
          location_pincode: string | null
          location_state: string
          location_title: string
          parent_request_id: string | null
          priority: string
          purpose_description: string
          quotation_submitted_at: string | null
          quotation_submitted_by: string | null
          quotation_url: string | null
          reference_documents_url: string | null
          report_submitted_at: string | null
          report_submitted_by: string | null
          request_number: string
          requested_by_rsh_deadline: string | null
          requested_visit_deadline: string
          requester_id: string
          site_visit_report_url: string | null
          smo_rejection_reason: string | null
          smo_remarks: string | null
          smo_reviewed_at: string | null
          smo_reviewed_by: string | null
          soil_water_report_url: string | null
          soil_water_submitted_at: string | null
          soil_water_submitted_by: string | null
          special_instructions: string | null
          status: string
          updated_at: string | null
          visit_category: string
          visit_completed_at: string | null
        }
        Insert: {
          assigned_farm_manager_id?: string | null
          client_contact_name: string
          client_email?: string | null
          client_name: string
          client_phone: string
          client_type?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_remarks?: string | null
          created_at?: string | null
          id?: string
          location_address: string
          location_city: string
          location_google_maps_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_pincode?: string | null
          location_state: string
          location_title: string
          parent_request_id?: string | null
          priority?: string
          purpose_description: string
          quotation_submitted_at?: string | null
          quotation_submitted_by?: string | null
          quotation_url?: string | null
          reference_documents_url?: string | null
          report_submitted_at?: string | null
          report_submitted_by?: string | null
          request_number?: string
          requested_by_rsh_deadline?: string | null
          requested_visit_deadline: string
          requester_id: string
          site_visit_report_url?: string | null
          smo_rejection_reason?: string | null
          smo_remarks?: string | null
          smo_reviewed_at?: string | null
          smo_reviewed_by?: string | null
          soil_water_report_url?: string | null
          soil_water_submitted_at?: string | null
          soil_water_submitted_by?: string | null
          special_instructions?: string | null
          status?: string
          updated_at?: string | null
          visit_category: string
          visit_completed_at?: string | null
        }
        Update: {
          assigned_farm_manager_id?: string | null
          client_contact_name?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string
          client_type?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_remarks?: string | null
          created_at?: string | null
          id?: string
          location_address?: string
          location_city?: string
          location_google_maps_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_pincode?: string | null
          location_state?: string
          location_title?: string
          parent_request_id?: string | null
          priority?: string
          purpose_description?: string
          quotation_submitted_at?: string | null
          quotation_submitted_by?: string | null
          quotation_url?: string | null
          reference_documents_url?: string | null
          report_submitted_at?: string | null
          report_submitted_by?: string | null
          request_number?: string
          requested_by_rsh_deadline?: string | null
          requested_visit_deadline?: string
          requester_id?: string
          site_visit_report_url?: string | null
          smo_rejection_reason?: string | null
          smo_remarks?: string | null
          smo_reviewed_at?: string | null
          smo_reviewed_by?: string | null
          soil_water_report_url?: string | null
          soil_water_submitted_at?: string | null
          soil_water_submitted_by?: string | null
          special_instructions?: string | null
          status?: string
          updated_at?: string | null
          visit_category?: string
          visit_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_requests_assigned_farm_manager_id_fkey"
            columns: ["assigned_farm_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_requests_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "site_visit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_requests_quotation_submitted_by_fkey"
            columns: ["quotation_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_requests_report_submitted_by_fkey"
            columns: ["report_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_requests_smo_reviewed_by_fkey"
            columns: ["smo_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_requests_soil_water_submitted_by_fkey"
            columns: ["soil_water_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_session_reports: {
        Row: {
          assignment_id: string
          challenges: string | null
          created_at: string | null
          id: string
          location_accuracy_meters: number | null
          location_lat: number | null
          location_lng: number | null
          observations: string | null
          photo_urls: string[] | null
          report_date: string
          request_id: string
          session_end_time: string | null
          session_start_time: string | null
          session_type: string
          site_location_title: string | null
          submitted_at: string | null
          submitted_by: string
          submitted_by_name: string
          updated_at: string | null
          work_summary: string
        }
        Insert: {
          assignment_id: string
          challenges?: string | null
          created_at?: string | null
          id?: string
          location_accuracy_meters?: number | null
          location_lat?: number | null
          location_lng?: number | null
          observations?: string | null
          photo_urls?: string[] | null
          report_date?: string
          request_id: string
          session_end_time?: string | null
          session_start_time?: string | null
          session_type: string
          site_location_title?: string | null
          submitted_at?: string | null
          submitted_by: string
          submitted_by_name: string
          updated_at?: string | null
          work_summary: string
        }
        Update: {
          assignment_id?: string
          challenges?: string | null
          created_at?: string | null
          id?: string
          location_accuracy_meters?: number | null
          location_lat?: number | null
          location_lng?: number | null
          observations?: string | null
          photo_urls?: string[] | null
          report_date?: string
          request_id?: string
          session_end_time?: string | null
          session_start_time?: string | null
          session_type?: string
          site_location_title?: string | null
          submitted_at?: string | null
          submitted_by?: string
          submitted_by_name?: string
          updated_at?: string | null
          work_summary?: string
        }
        Relationships: []
      }
      site_visit_sla_tracking: {
        Row: {
          breach_notif_l1_sent_at: string | null
          breach_notif_l2_sent_at: string | null
          breach_notif_l3_sent_at: string | null
          clock_start_at: string
          completed_at: string | null
          created_at: string | null
          deadline_at: string
          id: string
          request_id: string
          sla_name: string
          sla_number: number
          status: string
          updated_at: string | null
        }
        Insert: {
          breach_notif_l1_sent_at?: string | null
          breach_notif_l2_sent_at?: string | null
          breach_notif_l3_sent_at?: string | null
          clock_start_at: string
          completed_at?: string | null
          created_at?: string | null
          deadline_at: string
          id?: string
          request_id: string
          sla_name: string
          sla_number: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          breach_notif_l1_sent_at?: string | null
          breach_notif_l2_sent_at?: string | null
          breach_notif_l3_sent_at?: string | null
          clock_start_at?: string
          completed_at?: string | null
          created_at?: string | null
          deadline_at?: string
          id?: string
          request_id?: string
          sla_name?: string
          sla_number?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_sla_tracking_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "site_visit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_timeline: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          request_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          request_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_timeline_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_timeline_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "site_visit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_travel_logs: {
        Row: {
          assignment_id: string
          created_at: string | null
          distance_km: number | null
          duration_minutes: number | null
          end_accuracy_meters: number | null
          end_lat: number | null
          end_lng: number | null
          ended_at: string | null
          id: string
          remarks: string | null
          request_id: string
          start_accuracy_meters: number | null
          start_lat: number | null
          start_lng: number | null
          started_at: string
          traveling_mode: string
          updated_at: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          end_accuracy_meters?: number | null
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          remarks?: string | null
          request_id: string
          start_accuracy_meters?: number | null
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
          traveling_mode?: string
          updated_at?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          end_accuracy_meters?: number | null
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          remarks?: string | null
          request_id?: string
          start_accuracy_meters?: number | null
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
          traveling_mode?: string
          updated_at?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      sop_assignments: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          assigned_at: string | null
          assigned_by: string
          assigned_to_department: string | null
          assigned_to_user_id: string | null
          id: string
          is_active: boolean | null
          sop_id: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          assigned_at?: string | null
          assigned_by: string
          assigned_to_department?: string | null
          assigned_to_user_id?: string | null
          id?: string
          is_active?: boolean | null
          sop_id: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          assigned_at?: string | null
          assigned_by?: string
          assigned_to_department?: string | null
          assigned_to_user_id?: string | null
          id?: string
          is_active?: boolean | null
          sop_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_assignments_acknowledged_by_user_id_fkey"
            columns: ["acknowledged_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_assignments_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_assignments_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          attachment_url: string | null
          category: string | null
          code: string | null
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          attachment_url?: string | null
          category?: string | null
          code?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          attachment_url?: string | null
          category?: string | null
          code?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sops_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sops_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      split_payments: {
        Row: {
          account_number: string | null
          amount: number
          batch_id: string
          beneficiary_name: string | null
          bill_url: string | null
          created_at: string | null
          id: string
          ifsc_code: string | null
          paid_at: string | null
          paid_by: string | null
          parent_payment_id: string
          payee_name: string
          payment_method: string
          payment_proof_url: string | null
          split_number: number
          split_title: string
          status: string | null
          updated_at: string | null
          upi_id: string | null
          utr_number: string | null
          work_proof_url: string | null
        }
        Insert: {
          account_number?: string | null
          amount: number
          batch_id: string
          beneficiary_name?: string | null
          bill_url?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          paid_at?: string | null
          paid_by?: string | null
          parent_payment_id: string
          payee_name: string
          payment_method: string
          payment_proof_url?: string | null
          split_number: number
          split_title: string
          status?: string | null
          updated_at?: string | null
          upi_id?: string | null
          utr_number?: string | null
          work_proof_url?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          batch_id?: string
          beneficiary_name?: string | null
          bill_url?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          paid_at?: string | null
          paid_by?: string | null
          parent_payment_id?: string
          payee_name?: string
          payment_method?: string
          payment_proof_url?: string | null
          split_number?: number
          split_title?: string
          status?: string | null
          updated_at?: string | null
          upi_id?: string | null
          utr_number?: string | null
          work_proof_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "split_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_payments_parent_payment_id_fkey"
            columns: ["parent_payment_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      task_achievements: {
        Row: {
          actual_achievement: string
          actual_value: number | null
          created_at: string | null
          daily_task_id: string
          id: string
          notes: string | null
          proof_url: string | null
          status: string
          updated_at: string | null
          weekly_achievement_id: string
        }
        Insert: {
          actual_achievement: string
          actual_value?: number | null
          created_at?: string | null
          daily_task_id: string
          id?: string
          notes?: string | null
          proof_url?: string | null
          status?: string
          updated_at?: string | null
          weekly_achievement_id: string
        }
        Update: {
          actual_achievement?: string
          actual_value?: number | null
          created_at?: string | null
          daily_task_id?: string
          id?: string
          notes?: string | null
          proof_url?: string | null
          status?: string
          updated_at?: string | null
          weekly_achievement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_achievements_daily_task_id_fkey"
            columns: ["daily_task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_achievements_weekly_achievement_id_fkey"
            columns: ["weekly_achievement_id"]
            isOneToOne: false
            referencedRelation: "weekly_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          attachments: string[] | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          priority: string
          progress_percentage: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          attachments?: string[] | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          priority?: string
          progress_percentage?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          attachments?: string[] | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          priority?: string
          progress_percentage?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          attachment_url: string | null
          comment: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          comment: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_views: {
        Row: {
          created_at: string
          id: string
          ticket_id: string
          ticket_type: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ticket_id: string
          ticket_type: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ticket_id?: string
          ticket_type?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      transport_batch_entries: {
        Row: {
          bank_proof_url: string | null
          batch_id: string
          batch_name: string | null
          created_at: string | null
          created_by: string | null
          cutoff_date: string | null
          cutoff_time: string | null
          id: string
          proof_folder_url: string | null
          status: string | null
          total_amount: number | null
          total_km: number | null
          total_trips: number | null
        }
        Insert: {
          bank_proof_url?: string | null
          batch_id: string
          batch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          cutoff_date?: string | null
          cutoff_time?: string | null
          id?: string
          proof_folder_url?: string | null
          status?: string | null
          total_amount?: number | null
          total_km?: number | null
          total_trips?: number | null
        }
        Update: {
          bank_proof_url?: string | null
          batch_id?: string
          batch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          cutoff_date?: string | null
          cutoff_time?: string | null
          id?: string
          proof_folder_url?: string | null
          status?: string | null
          total_amount?: number | null
          total_km?: number | null
          total_trips?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_batch_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_categories: {
        Row: {
          category_code: string
          category_description: string | null
          category_name: string
          color_code: string | null
          created_at: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          category_code: string
          category_description?: string | null
          category_name: string
          color_code?: string | null
          created_at?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          category_code?: string
          category_description?: string | null
          category_name?: string
          color_code?: string | null
          created_at?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transport_drivers: {
        Row: {
          created_at: string | null
          created_by: string | null
          driver_license_number: string | null
          driver_name: string
          driver_phone: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          updated_at: string | null
          vendor_company: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          driver_license_number?: string | null
          driver_name: string
          driver_phone?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string | null
          vendor_company?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          driver_license_number?: string | null
          driver_name?: string
          driver_phone?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string | null
          vendor_company?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_drivers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_expenses: {
        Row: {
          accounts_approved_at: string | null
          accounts_approved_by: string | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          batch_id: string | null
          category_code: string
          created_at: string | null
          created_by: string
          department: string
          dept_head_approved_at: string | null
          dept_head_approved_by: string | null
          driver_id: string | null
          driver_name: string | null
          from_location: string
          id: string
          is_batch_entry: boolean | null
          paid_at: string | null
          paid_by: string | null
          payment_date: string | null
          payment_mode: string | null
          payment_remarks: string | null
          payment_status: string | null
          proof_file_name: string | null
          proof_file_type: string | null
          proof_file_url: string
          purpose: string
          rate_per_km: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          to_location: string
          total_amount: number
          total_km: number
          trip_date: string
          updated_at: string | null
          utr_number: string | null
          vehicle_id: string | null
          vehicle_number: string | null
          vendor_name: string | null
        }
        Insert: {
          accounts_approved_at?: string | null
          accounts_approved_by?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          batch_id?: string | null
          category_code: string
          created_at?: string | null
          created_by: string
          department: string
          dept_head_approved_at?: string | null
          dept_head_approved_by?: string | null
          driver_id?: string | null
          driver_name?: string | null
          from_location: string
          id?: string
          is_batch_entry?: boolean | null
          paid_at?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_remarks?: string | null
          payment_status?: string | null
          proof_file_name?: string | null
          proof_file_type?: string | null
          proof_file_url: string
          purpose: string
          rate_per_km: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          to_location: string
          total_amount: number
          total_km: number
          trip_date: string
          updated_at?: string | null
          utr_number?: string | null
          vehicle_id?: string | null
          vehicle_number?: string | null
          vendor_name?: string | null
        }
        Update: {
          accounts_approved_at?: string | null
          accounts_approved_by?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          batch_id?: string | null
          category_code?: string
          created_at?: string | null
          created_by?: string
          department?: string
          dept_head_approved_at?: string | null
          dept_head_approved_by?: string | null
          driver_id?: string | null
          driver_name?: string | null
          from_location?: string
          id?: string
          is_batch_entry?: boolean | null
          paid_at?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_remarks?: string | null
          payment_status?: string | null
          proof_file_name?: string | null
          proof_file_type?: string | null
          proof_file_url?: string
          purpose?: string
          rate_per_km?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          to_location?: string
          total_amount?: number
          total_km?: number
          trip_date?: string
          updated_at?: string | null
          utr_number?: string | null
          vehicle_id?: string | null
          vehicle_number?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_expenses_accounts_approved_by_fkey"
            columns: ["accounts_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "transport_categories"
            referencedColumns: ["category_code"]
          },
          {
            foreignKeyName: "transport_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_dept_head_approved_by_fkey"
            columns: ["dept_head_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "transport_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "transport_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_split_payments: {
        Row: {
          account_number: string | null
          amount: number
          batch_id: string | null
          beneficiary_name: string | null
          created_at: string | null
          id: string
          ifsc_code: string | null
          payee_name: string
          payment_method: string | null
          upi_id: string | null
        }
        Insert: {
          account_number?: string | null
          amount: number
          batch_id?: string | null
          beneficiary_name?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          payee_name: string
          payment_method?: string | null
          upi_id?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          batch_id?: string | null
          beneficiary_name?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          payee_name?: string
          payment_method?: string | null
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_split_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "transport_batch_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      transport_vehicles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          ownership_type: string | null
          updated_at: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_number: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          ownership_type?: string | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_number: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          ownership_type?: string | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_number?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_claims: {
        Row: {
          admin_remarks: string | null
          admin_reviewed_at: string | null
          admin_reviewed_by: string | null
          calculated_distance_km: number | null
          ceo_remarks: string | null
          ceo_reviewed_at: string | null
          ceo_reviewed_by: string | null
          created_at: string
          employee_id: string
          flag_reason: string | null
          food_allowance: number | null
          fuel_cost: number | null
          id: string
          is_flagged: boolean | null
          misc_cost: number | null
          paid_at: string | null
          paid_by: string | null
          receipts: Json | null
          route_points: Json | null
          status: string
          submitted_at: string | null
          toll_cost: number | null
          total_claim: number | null
          travel_request_id: string
          updated_at: string
        }
        Insert: {
          admin_remarks?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          calculated_distance_km?: number | null
          ceo_remarks?: string | null
          ceo_reviewed_at?: string | null
          ceo_reviewed_by?: string | null
          created_at?: string
          employee_id: string
          flag_reason?: string | null
          food_allowance?: number | null
          fuel_cost?: number | null
          id?: string
          is_flagged?: boolean | null
          misc_cost?: number | null
          paid_at?: string | null
          paid_by?: string | null
          receipts?: Json | null
          route_points?: Json | null
          status?: string
          submitted_at?: string | null
          toll_cost?: number | null
          total_claim?: number | null
          travel_request_id: string
          updated_at?: string
        }
        Update: {
          admin_remarks?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          calculated_distance_km?: number | null
          ceo_remarks?: string | null
          ceo_reviewed_at?: string | null
          ceo_reviewed_by?: string | null
          created_at?: string
          employee_id?: string
          flag_reason?: string | null
          food_allowance?: number | null
          fuel_cost?: number | null
          id?: string
          is_flagged?: boolean | null
          misc_cost?: number | null
          paid_at?: string | null
          paid_by?: string | null
          receipts?: Json | null
          route_points?: Json | null
          status?: string
          submitted_at?: string | null
          toll_cost?: number | null
          total_claim?: number | null
          travel_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_claims_admin_reviewed_by_fkey"
            columns: ["admin_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_claims_ceo_reviewed_by_fkey"
            columns: ["ceo_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_claims_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_claims_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_claims_travel_request_id_fkey"
            columns: ["travel_request_id"]
            isOneToOne: false
            referencedRelation: "travel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_rate_config: {
        Row: {
          ceo_threshold: number
          created_at: string
          daily_claim_limit: number
          daily_food_limit: number
          id: string
          is_active: boolean
          rate_per_km: number
          transport_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ceo_threshold?: number
          created_at?: string
          daily_claim_limit?: number
          daily_food_limit?: number
          id?: string
          is_active?: boolean
          rate_per_km?: number
          transport_mode: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ceo_threshold?: number
          created_at?: string
          daily_claim_limit?: number
          daily_food_limit?: number
          id?: string
          is_active?: boolean
          rate_per_km?: number
          transport_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_rate_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_requests: {
        Row: {
          actual_distance_km: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          estimated_cost: number | null
          estimated_distance_km: number | null
          expected_return: string | null
          from_lat: number | null
          from_lng: number | null
          from_location: string
          id: string
          is_within_city: boolean | null
          purpose: string
          rejection_reason: string | null
          return_lat: number | null
          return_lng: number | null
          return_location: string | null
          status: string
          to_lat: number | null
          to_lng: number | null
          to_location: string
          transport_mode: string
          travel_date: string
          travel_type: string
          trip_ended_at: string | null
          trip_started_at: string | null
          updated_at: string
        }
        Insert: {
          actual_distance_km?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          estimated_cost?: number | null
          estimated_distance_km?: number | null
          expected_return?: string | null
          from_lat?: number | null
          from_lng?: number | null
          from_location: string
          id?: string
          is_within_city?: boolean | null
          purpose: string
          rejection_reason?: string | null
          return_lat?: number | null
          return_lng?: number | null
          return_location?: string | null
          status?: string
          to_lat?: number | null
          to_lng?: number | null
          to_location: string
          transport_mode?: string
          travel_date: string
          travel_type?: string
          trip_ended_at?: string | null
          trip_started_at?: string | null
          updated_at?: string
        }
        Update: {
          actual_distance_km?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          estimated_cost?: number | null
          estimated_distance_km?: number | null
          expected_return?: string | null
          from_lat?: number | null
          from_lng?: number | null
          from_location?: string
          id?: string
          is_within_city?: boolean | null
          purpose?: string
          rejection_reason?: string | null
          return_lat?: number | null
          return_lng?: number | null
          return_location?: string | null
          status?: string
          to_lat?: number | null
          to_lng?: number | null
          to_location?: string
          transport_mode?: string
          travel_date?: string
          travel_type?: string
          trip_ended_at?: string | null
          trip_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_route_logs: {
        Row: {
          accuracy: number | null
          altitude: number | null
          created_at: string
          heading: number | null
          id: string
          is_stop: boolean | null
          is_suspicious: boolean | null
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
          stop_duration_minutes: number | null
          suspicious_reason: string | null
          travel_request_id: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          is_stop?: boolean | null
          is_suspicious?: boolean | null
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
          stop_duration_minutes?: number | null
          suspicious_reason?: string | null
          travel_request_id: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          is_stop?: boolean | null
          is_suspicious?: boolean | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
          stop_duration_minutes?: number | null
          suspicious_reason?: string | null
          travel_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_route_logs_travel_request_id_fkey"
            columns: ["travel_request_id"]
            isOneToOne: false
            referencedRelation: "travel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_location_logs: {
        Row: {
          accuracy: number | null
          action_type: string
          device_info: Json | null
          id: string
          is_within_geofence: boolean | null
          latitude: number
          longitude: number
          matched_geofence_id: string | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          action_type: string
          device_info?: Json | null
          id?: string
          is_within_geofence?: boolean | null
          latitude: number
          longitude: number
          matched_geofence_id?: string | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          action_type?: string
          device_info?: Json | null
          id?: string
          is_within_geofence?: boolean | null
          latitude?: number
          longitude?: number
          matched_geofence_id?: string | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_location_logs_matched_geofence_id_fkey"
            columns: ["matched_geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_master: {
        Row: {
          aadhar_drive_link: string | null
          account_number: string | null
          address: string | null
          alternate_phone: string | null
          bank_name: string | null
          city: string
          company_name: string
          contact_person: string
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          ifsc_code: string | null
          is_verified: boolean | null
          pan_number: string | null
          phone: string
          rating: number | null
          sourced_by: string | null
          sourced_on: string | null
          state: string
          status: string
          total_orders: number | null
          updated_at: string
          vendor_code: string | null
          verification_notes: string | null
          work_types: string[]
        }
        Insert: {
          aadhar_drive_link?: string | null
          account_number?: string | null
          address?: string | null
          alternate_phone?: string | null
          bank_name?: string | null
          city: string
          company_name: string
          contact_person: string
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_verified?: boolean | null
          pan_number?: string | null
          phone: string
          rating?: number | null
          sourced_by?: string | null
          sourced_on?: string | null
          state: string
          status?: string
          total_orders?: number | null
          updated_at?: string
          vendor_code?: string | null
          verification_notes?: string | null
          work_types?: string[]
        }
        Update: {
          aadhar_drive_link?: string | null
          account_number?: string | null
          address?: string | null
          alternate_phone?: string | null
          bank_name?: string | null
          city?: string
          company_name?: string
          contact_person?: string
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_verified?: boolean | null
          pan_number?: string | null
          phone?: string
          rating?: number | null
          sourced_by?: string | null
          sourced_on?: string | null
          state?: string
          status?: string
          total_orders?: number | null
          updated_at?: string
          vendor_code?: string | null
          verification_notes?: string | null
          work_types?: string[]
        }
        Relationships: []
      }
      vendor_quotes: {
        Row: {
          boq_item_id: string | null
          created_at: string | null
          created_by: string | null
          delivery_days: number | null
          id: string
          is_selected: boolean | null
          material_request_id: string | null
          notes: string | null
          project_id: string
          quote_document_url: string | null
          quote_drive_link: string | null
          quoted_items: Json | null
          quoted_total: number
          quoted_unit_price: number
          validity_date: string | null
          vendor_account_number: string | null
          vendor_bank_name: string | null
          vendor_contact: string | null
          vendor_email: string | null
          vendor_gst: string | null
          vendor_ifsc: string | null
          vendor_name: string
        }
        Insert: {
          boq_item_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_days?: number | null
          id?: string
          is_selected?: boolean | null
          material_request_id?: string | null
          notes?: string | null
          project_id: string
          quote_document_url?: string | null
          quote_drive_link?: string | null
          quoted_items?: Json | null
          quoted_total: number
          quoted_unit_price: number
          validity_date?: string | null
          vendor_account_number?: string | null
          vendor_bank_name?: string | null
          vendor_contact?: string | null
          vendor_email?: string | null
          vendor_gst?: string | null
          vendor_ifsc?: string | null
          vendor_name: string
        }
        Update: {
          boq_item_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_days?: number | null
          id?: string
          is_selected?: boolean | null
          material_request_id?: string | null
          notes?: string | null
          project_id?: string
          quote_document_url?: string | null
          quote_drive_link?: string | null
          quoted_items?: Json | null
          quoted_total?: number
          quoted_unit_price?: number
          validity_date?: string | null
          vendor_account_number?: string | null
          vendor_bank_name?: string | null
          vendor_contact?: string | null
          vendor_email?: string | null
          vendor_gst?: string | null
          vendor_ifsc?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_quotes_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "project_boq"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_ratings: {
        Row: {
          communication_rating: number | null
          created_at: string | null
          id: string
          material_request_id: string | null
          overall_rating: number | null
          project_id: string | null
          quality_rating: number | null
          rated_at: string | null
          rated_by: string
          review_text: string | null
          timeliness_rating: number | null
          vendor_id: string
          work_request_id: string | null
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          material_request_id?: string | null
          overall_rating?: number | null
          project_id?: string | null
          quality_rating?: number | null
          rated_at?: string | null
          rated_by: string
          review_text?: string | null
          timeliness_rating?: number | null
          vendor_id: string
          work_request_id?: string | null
        }
        Update: {
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          material_request_id?: string | null
          overall_rating?: number | null
          project_id?: string | null
          quality_rating?: number | null
          rated_at?: string | null
          rated_by?: string
          review_text?: string | null
          timeliness_rating?: number | null
          vendor_id?: string
          work_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_ratings_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_ratings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_ratings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_ratings_rated_by_fkey"
            columns: ["rated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_ratings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_ratings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_master_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_ratings_work_request_id_fkey"
            columns: ["work_request_id"]
            isOneToOne: false
            referencedRelation: "vendor_work_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_sourcing_logs: {
        Row: {
          cities_covered: string[] | null
          date: string
          id: string
          states_covered: string[] | null
          submitted_at: string
          summary_notes: string | null
          user_id: string
          vendors_added: number | null
          work_types_covered: string[] | null
        }
        Insert: {
          cities_covered?: string[] | null
          date?: string
          id?: string
          states_covered?: string[] | null
          submitted_at?: string
          summary_notes?: string | null
          user_id: string
          vendors_added?: number | null
          work_types_covered?: string[] | null
        }
        Update: {
          cities_covered?: string[] | null
          date?: string
          id?: string
          states_covered?: string[] | null
          submitted_at?: string
          summary_notes?: string | null
          user_id?: string
          vendors_added?: number | null
          work_types_covered?: string[] | null
        }
        Relationships: []
      }
      vendor_sourcing_queue: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          queue_status: string
          sourcing_notes: string | null
          updated_at: string | null
          vendor_quotes: Json | null
          work_order_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          queue_status?: string
          sourcing_notes?: string | null
          updated_at?: string | null
          vendor_quotes?: Json | null
          work_order_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          queue_status?: string
          sourcing_notes?: string | null
          updated_at?: string | null
          vendor_quotes?: Json | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sourcing_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_sourcing_queue_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_sourcing_queue_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_work_requests: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          aligned_vendor_contact: string | null
          aligned_vendor_details: Json | null
          aligned_vendor_name: string | null
          approval_status: string | null
          approved_for_sourcing_at: string | null
          assigned_to_sourcing: string | null
          boi_approved_at: string | null
          boi_approved_by: string | null
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          created_at: string | null
          estimated_budget: number | null
          final_price: number | null
          gm_approved_at: string | null
          gm_approved_by: string | null
          gmo_approved_at: string | null
          gmo_approved_by: string | null
          id: string
          linked_wo_id: string | null
          phase_id: string | null
          project_id: string
          requested_by: string
          smo_approved_at: string | null
          smo_approved_by: string | null
          status: string | null
          timeline_days: number | null
          updated_at: string | null
          vendor_account_number: string | null
          vendor_bank_name: string | null
          vendor_gst: string | null
          vendor_ifsc: string | null
          vendor_upi: string | null
          wo_approval_status: string | null
          work_description: string
          work_type: string
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          aligned_vendor_contact?: string | null
          aligned_vendor_details?: Json | null
          aligned_vendor_name?: string | null
          approval_status?: string | null
          approved_for_sourcing_at?: string | null
          assigned_to_sourcing?: string | null
          boi_approved_at?: string | null
          boi_approved_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          estimated_budget?: number | null
          final_price?: number | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          id?: string
          linked_wo_id?: string | null
          phase_id?: string | null
          project_id: string
          requested_by: string
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          status?: string | null
          timeline_days?: number | null
          updated_at?: string | null
          vendor_account_number?: string | null
          vendor_bank_name?: string | null
          vendor_gst?: string | null
          vendor_ifsc?: string | null
          vendor_upi?: string | null
          wo_approval_status?: string | null
          work_description: string
          work_type: string
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          aligned_vendor_contact?: string | null
          aligned_vendor_details?: Json | null
          aligned_vendor_name?: string | null
          approval_status?: string | null
          approved_for_sourcing_at?: string | null
          assigned_to_sourcing?: string | null
          boi_approved_at?: string | null
          boi_approved_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          created_at?: string | null
          estimated_budget?: number | null
          final_price?: number | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          id?: string
          linked_wo_id?: string | null
          phase_id?: string | null
          project_id?: string
          requested_by?: string
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          status?: string | null
          timeline_days?: number | null
          updated_at?: string | null
          vendor_account_number?: string | null
          vendor_bank_name?: string | null
          vendor_gst?: string | null
          vendor_ifsc?: string | null
          vendor_upi?: string | null
          wo_approval_status?: string | null
          work_description?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_work_requests_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_assigned_to_sourcing_fkey"
            columns: ["assigned_to_sourcing"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_boi_approved_by_fkey"
            columns: ["boi_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_gm_approved_by_fkey"
            columns: ["gm_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_gmo_approved_by_fkey"
            columns: ["gmo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_linked_wo_id_fkey"
            columns: ["linked_wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_work_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_work_requests_smo_approved_by_fkey"
            columns: ["smo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      week_off_assignments: {
        Row: {
          assigned_by: string | null
          assignment_type: string
          created_at: string | null
          employee_id: string
          id: string
          is_active: boolean | null
          reason: string | null
          recurring_day: number | null
          updated_at: string | null
          week_off_date: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_type: string
          created_at?: string | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          recurring_day?: number | null
          updated_at?: string | null
          week_off_date: string
        }
        Update: {
          assigned_by?: string | null
          assignment_type?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          recurring_day?: number | null
          updated_at?: string | null
          week_off_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_off_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_off_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_achievements: {
        Row: {
          action_items: string | null
          admin_remarks: string | null
          challenges_faced: string | null
          completed_tasks: number | null
          completion_percentage: number | null
          core_head_id: string
          created_at: string | null
          id: string
          is_late: boolean | null
          is_reviewed: boolean | null
          is_submitted: boolean | null
          key_achievements: string | null
          lessons_learned: string | null
          overall_summary: string
          reviewed_at: string | null
          reviewed_by: string | null
          submission_deadline: string | null
          submitted_at: string | null
          total_tasks: number | null
          updated_at: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          weekly_target_id: string
          year: number
        }
        Insert: {
          action_items?: string | null
          admin_remarks?: string | null
          challenges_faced?: string | null
          completed_tasks?: number | null
          completion_percentage?: number | null
          core_head_id: string
          created_at?: string | null
          id?: string
          is_late?: boolean | null
          is_reviewed?: boolean | null
          is_submitted?: boolean | null
          key_achievements?: string | null
          lessons_learned?: string | null
          overall_summary: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_deadline?: string | null
          submitted_at?: string | null
          total_tasks?: number | null
          updated_at?: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          weekly_target_id: string
          year: number
        }
        Update: {
          action_items?: string | null
          admin_remarks?: string | null
          challenges_faced?: string | null
          completed_tasks?: number | null
          completion_percentage?: number | null
          core_head_id?: string
          created_at?: string | null
          id?: string
          is_late?: boolean | null
          is_reviewed?: boolean | null
          is_submitted?: boolean | null
          key_achievements?: string | null
          lessons_learned?: string | null
          overall_summary?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_deadline?: string | null
          submitted_at?: string | null
          total_tasks?: number | null
          updated_at?: string | null
          week_end_date?: string
          week_number?: number
          week_start_date?: string
          weekly_target_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_achievements_core_head_id_fkey"
            columns: ["core_head_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_achievements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_achievements_weekly_target_id_fkey"
            columns: ["weekly_target_id"]
            isOneToOne: true
            referencedRelation: "weekly_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_targets: {
        Row: {
          core_head_id: string
          created_at: string | null
          id: string
          is_locked: boolean | null
          is_unlocked_by_admin: boolean | null
          locked_at: string | null
          unlock_reason: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Insert: {
          core_head_id: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_unlocked_by_admin?: boolean | null
          locked_at?: string | null
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string | null
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Update: {
          core_head_id?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_unlocked_by_admin?: boolean | null
          locked_at?: string | null
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string | null
          week_end_date?: string
          week_number?: number
          week_start_date?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_targets_core_head_id_fkey"
            columns: ["core_head_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_targets_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_final_audits: {
        Row: {
          approval_proof_url: string | null
          audit_remarks: string | null
          audit_status: string
          audited_by: string
          created_at: string
          explanation: string
          id: string
          image_urls: string[] | null
          payment_id: string | null
          proof_of_call: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          approval_proof_url?: string | null
          audit_remarks?: string | null
          audit_status?: string
          audited_by: string
          created_at?: string
          explanation: string
          id?: string
          image_urls?: string[] | null
          payment_id?: string | null
          proof_of_call?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          approval_proof_url?: string | null
          audit_remarks?: string | null
          audit_status?: string
          audited_by?: string
          created_at?: string
          explanation?: string
          id?: string
          image_urls?: string[] | null
          payment_id?: string | null
          proof_of_call?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_final_audits_audited_by_fkey"
            columns: ["audited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_final_audits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "work_order_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_final_audits_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_payments: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejection_reason: string | null
          amount: number
          boi_rejection_reason: string | null
          boi_verified_at: string | null
          boi_verified_by: string | null
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          ceo_hold_reason: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          linked_payment_id: string | null
          payment_number: number
          payment_type: string
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          amount?: number
          boi_rejection_reason?: string | null
          boi_verified_at?: string | null
          boi_verified_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          ceo_hold_reason?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_payment_id?: string | null
          payment_number?: number
          payment_type?: string
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          amount?: number
          boi_rejection_reason?: string | null
          boi_verified_at?: string | null
          boi_verified_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          ceo_hold_reason?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_payment_id?: string | null
          payment_number?: number
          payment_type?: string
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_payments_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_payments_boi_verified_by_fkey"
            columns: ["boi_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_payments_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_payments_linked_payment_id_fkey"
            columns: ["linked_payment_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_payments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejection_reason: string | null
          advance_amount: number | null
          approved_budget: number
          boi_rejection_reason: string | null
          boi_verified_at: string | null
          boi_verified_by: string | null
          boq_item_id: string | null
          budget_approved_at: string | null
          budget_approved_by: string | null
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          ceo_hold_reason: string | null
          created_at: string
          detailed_scope: string
          deviation_amount: number | null
          deviation_percentage: number | null
          estimated_amount: number
          final_amount: number | null
          gm_approved_at: string | null
          gm_approved_by: string | null
          gm_rejection_reason: string | null
          gm_verified_at: string | null
          gm_verified_by: string | null
          gmo_approved_at: string | null
          gmo_approved_by: string | null
          gmo_rejection_reason: string | null
          has_budget_deviation: boolean | null
          id: string
          linked_payment_id: string | null
          negotiated_amount: number | null
          payment_stage: string
          project_id: string | null
          project_milestone_id: string | null
          project_phase_id: string | null
          remaining_budget: number | null
          requester_id: string
          signed_document_url: string | null
          signed_uploaded_at: string | null
          signed_uploaded_by: string | null
          smo_approved_at: string | null
          smo_approved_by: string | null
          smo_rejection_reason: string | null
          start_date: string | null
          status: string
          terms_and_conditions: string | null
          total_paid: number | null
          updated_at: string
          vendor_account_number: string | null
          vendor_contact: string | null
          vendor_gst: string | null
          vendor_ifsc_code: string | null
          vendor_name: string | null
          vendor_sourced: boolean | null
          vendor_sourced_at: string | null
          vendor_sourced_by: string | null
          vendor_upi: string | null
          vendor_work_request_id: string | null
          wo_document_url: string
          wo_number: number
          work_description: string
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          advance_amount?: number | null
          approved_budget?: number
          boi_rejection_reason?: string | null
          boi_verified_at?: string | null
          boi_verified_by?: string | null
          boq_item_id?: string | null
          budget_approved_at?: string | null
          budget_approved_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          ceo_hold_reason?: string | null
          created_at?: string
          detailed_scope: string
          deviation_amount?: number | null
          deviation_percentage?: number | null
          estimated_amount: number
          final_amount?: number | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gm_rejection_reason?: string | null
          gm_verified_at?: string | null
          gm_verified_by?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          gmo_rejection_reason?: string | null
          has_budget_deviation?: boolean | null
          id?: string
          linked_payment_id?: string | null
          negotiated_amount?: number | null
          payment_stage?: string
          project_id?: string | null
          project_milestone_id?: string | null
          project_phase_id?: string | null
          remaining_budget?: number | null
          requester_id: string
          signed_document_url?: string | null
          signed_uploaded_at?: string | null
          signed_uploaded_by?: string | null
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          smo_rejection_reason?: string | null
          start_date?: string | null
          status?: string
          terms_and_conditions?: string | null
          total_paid?: number | null
          updated_at?: string
          vendor_account_number?: string | null
          vendor_contact?: string | null
          vendor_gst?: string | null
          vendor_ifsc_code?: string | null
          vendor_name?: string | null
          vendor_sourced?: boolean | null
          vendor_sourced_at?: string | null
          vendor_sourced_by?: string | null
          vendor_upi?: string | null
          vendor_work_request_id?: string | null
          wo_document_url: string
          wo_number: number
          work_description: string
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          advance_amount?: number | null
          approved_budget?: number
          boi_rejection_reason?: string | null
          boi_verified_at?: string | null
          boi_verified_by?: string | null
          boq_item_id?: string | null
          budget_approved_at?: string | null
          budget_approved_by?: string | null
          ceo_approved_at?: string | null
          ceo_approved_by?: string | null
          ceo_hold_reason?: string | null
          created_at?: string
          detailed_scope?: string
          deviation_amount?: number | null
          deviation_percentage?: number | null
          estimated_amount?: number
          final_amount?: number | null
          gm_approved_at?: string | null
          gm_approved_by?: string | null
          gm_rejection_reason?: string | null
          gm_verified_at?: string | null
          gm_verified_by?: string | null
          gmo_approved_at?: string | null
          gmo_approved_by?: string | null
          gmo_rejection_reason?: string | null
          has_budget_deviation?: boolean | null
          id?: string
          linked_payment_id?: string | null
          negotiated_amount?: number | null
          payment_stage?: string
          project_id?: string | null
          project_milestone_id?: string | null
          project_phase_id?: string | null
          remaining_budget?: number | null
          requester_id?: string
          signed_document_url?: string | null
          signed_uploaded_at?: string | null
          signed_uploaded_by?: string | null
          smo_approved_at?: string | null
          smo_approved_by?: string | null
          smo_rejection_reason?: string | null
          start_date?: string | null
          status?: string
          terms_and_conditions?: string | null
          total_paid?: number | null
          updated_at?: string
          vendor_account_number?: string | null
          vendor_contact?: string | null
          vendor_gst?: string | null
          vendor_ifsc_code?: string | null
          vendor_name?: string | null
          vendor_sourced?: boolean | null
          vendor_sourced_at?: string | null
          vendor_sourced_by?: string | null
          vendor_upi?: string | null
          vendor_work_request_id?: string | null
          wo_document_url?: string
          wo_number?: number
          work_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_boi_verified_by_fkey"
            columns: ["boi_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "project_boq"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_budget_approved_by_fkey"
            columns: ["budget_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_ceo_approved_by_fkey"
            columns: ["ceo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_gm_approved_by_fkey"
            columns: ["gm_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_gm_verified_by_fkey"
            columns: ["gm_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_gmo_approved_by_fkey"
            columns: ["gmo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_milestone_id_fkey"
            columns: ["project_milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_phase_id_fkey"
            columns: ["project_phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_signed_uploaded_by_fkey"
            columns: ["signed_uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_smo_approved_by_fkey"
            columns: ["smo_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_sourced_by_fkey"
            columns: ["vendor_sourced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_work_request_id_fkey"
            columns: ["vendor_work_request_id"]
            isOneToOne: false
            referencedRelation: "vendor_work_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_consumption_summary: {
        Row: {
          audit_status: string | null
          balance: number | null
          created_at: string | null
          days_remaining_estimate: number | null
          inventory_id: string | null
          material_name: string | null
          project_id: string | null
          project_name: string | null
          quantity_received: number | null
          quantity_used: number | null
          stock_value: number | null
          today_usage: number | null
          unit: string | null
          unit_price: number | null
          weekly_usage: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_escalation_stats: {
        Row: {
          critical_escalations: number | null
          project_id: string | null
          total_escalations: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_execution_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_execution_summary: {
        Row: {
          approved_pos: number | null
          approved_wos: number | null
          client_name: string | null
          completed_phases: number | null
          current_phase_id: string | null
          delivered_boq_items: number | null
          lifecycle_stage: string | null
          material_status: string | null
          ordered_boq_items: number | null
          overall_completion_percentage: number | null
          pending_boq_items: number | null
          pending_payments: number | null
          pending_pos: number | null
          pending_wos: number | null
          project_id: string | null
          project_name: string | null
          total_boq_items: number | null
          total_paid: number | null
          total_phases: number | null
          total_pos: number | null
          total_wos: number | null
          work_order_status: string | null
        }
        Insert: {
          approved_pos?: never
          approved_wos?: never
          client_name?: string | null
          completed_phases?: never
          current_phase_id?: string | null
          delivered_boq_items?: never
          lifecycle_stage?: string | null
          material_status?: string | null
          ordered_boq_items?: never
          overall_completion_percentage?: number | null
          pending_boq_items?: never
          pending_payments?: never
          pending_pos?: never
          pending_wos?: never
          project_id?: string | null
          project_name?: string | null
          total_boq_items?: never
          total_paid?: never
          total_phases?: never
          total_pos?: never
          total_wos?: never
          work_order_status?: string | null
        }
        Update: {
          approved_pos?: never
          approved_wos?: never
          client_name?: string | null
          completed_phases?: never
          current_phase_id?: string | null
          delivered_boq_items?: never
          lifecycle_stage?: string | null
          material_status?: string | null
          ordered_boq_items?: never
          overall_completion_percentage?: number | null
          pending_boq_items?: never
          pending_payments?: never
          pending_pos?: never
          pending_wos?: never
          project_id?: string | null
          project_name?: string | null
          total_boq_items?: never
          total_paid?: never
          total_phases?: never
          total_pos?: never
          total_wos?: never
          work_order_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_current_phase_id_fkey"
            columns: ["current_phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_daily_reports_public: {
        Row: {
          assignment_id: string | null
          challenges_faced: string | null
          farm_manager_remarks: string | null
          farm_manager_review_at: string | null
          farm_manager_reviewed: boolean | null
          geotagged_image_urls: string[] | null
          id: string | null
          is_late_submission: boolean | null
          is_visit_complete: boolean | null
          itc_data_available: boolean | null
          itc_data_reference: string | null
          itc_document_url: string | null
          itc_remarks: string | null
          location_accuracy_meters: number | null
          location_lat: number | null
          location_lng: number | null
          login_time: string | null
          logout_time: string | null
          next_day_plan: string | null
          report_date: string | null
          request_id: string | null
          site_location_address: string | null
          site_location_title: string | null
          site_observations: string | null
          submitted_at: string | null
          submitted_by: string | null
          submitted_by_name: string | null
          total_hours_on_site: number | null
          visit_day_number: number | null
          work_summary: string | null
        }
        Insert: {
          assignment_id?: string | null
          challenges_faced?: string | null
          farm_manager_remarks?: string | null
          farm_manager_review_at?: string | null
          farm_manager_reviewed?: boolean | null
          geotagged_image_urls?: string[] | null
          id?: string | null
          is_late_submission?: boolean | null
          is_visit_complete?: boolean | null
          itc_data_available?: never
          itc_data_reference?: never
          itc_document_url?: never
          itc_remarks?: never
          location_accuracy_meters?: number | null
          location_lat?: number | null
          location_lng?: number | null
          login_time?: string | null
          logout_time?: string | null
          next_day_plan?: string | null
          report_date?: string | null
          request_id?: string | null
          site_location_address?: string | null
          site_location_title?: string | null
          site_observations?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          total_hours_on_site?: number | null
          visit_day_number?: number | null
          work_summary?: string | null
        }
        Update: {
          assignment_id?: string | null
          challenges_faced?: string | null
          farm_manager_remarks?: string | null
          farm_manager_review_at?: string | null
          farm_manager_reviewed?: boolean | null
          geotagged_image_urls?: string[] | null
          id?: string | null
          is_late_submission?: boolean | null
          is_visit_complete?: boolean | null
          itc_data_available?: never
          itc_data_reference?: never
          itc_document_url?: never
          itc_remarks?: never
          location_accuracy_meters?: number | null
          location_lat?: number | null
          location_lng?: number | null
          login_time?: string | null
          logout_time?: string | null
          next_day_plan?: string | null
          report_date?: string | null
          request_id?: string | null
          site_location_address?: string | null
          site_location_title?: string | null
          site_observations?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          total_hours_on_site?: number | null
          visit_day_number?: number | null
          work_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_daily_reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "site_visit_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_daily_reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "site_visit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_daily_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_master_safe: {
        Row: {
          address: string | null
          alternate_phone: string | null
          bank_account_masked: string | null
          bank_name: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          has_gst: boolean | null
          has_pan: boolean | null
          id: string | null
          is_verified: boolean | null
          phone: string | null
          rating: number | null
          sourced_by: string | null
          sourced_on: string | null
          state: string | null
          status: string | null
          total_orders: number | null
          vendor_code: string | null
          work_types: string[] | null
        }
        Insert: {
          address?: string | null
          alternate_phone?: string | null
          bank_account_masked?: never
          bank_name?: never
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          has_gst?: never
          has_pan?: never
          id?: string | null
          is_verified?: boolean | null
          phone?: string | null
          rating?: number | null
          sourced_by?: string | null
          sourced_on?: string | null
          state?: string | null
          status?: string | null
          total_orders?: number | null
          vendor_code?: string | null
          work_types?: string[] | null
        }
        Update: {
          address?: string | null
          alternate_phone?: string | null
          bank_account_masked?: never
          bank_name?: never
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          has_gst?: never
          has_pan?: never
          id?: string | null
          is_verified?: boolean | null
          phone?: string | null
          rating?: number | null
          sourced_by?: string | null
          sourced_on?: string | null
          state?: string | null
          status?: string | null
          total_orders?: number | null
          vendor_code?: string | null
          work_types?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      auditor_approve_salary_batch: {
        Args: { p_auditor_id: string; p_batch_id: string }
        Returns: Json
      }
      calculate_late_status: {
        Args: {
          p_date: string
          p_slot_number: number
          p_submission_time: string
        }
        Returns: string
      }
      can_submit_plan: {
        Args: { p_date: string; p_slot_number: number; p_user_id: string }
        Returns: boolean
      }
      can_submit_report: {
        Args: { p_date: string; p_slot_number: number; p_user_id: string }
        Returns: boolean
      }
      can_update_leave_request: {
        Args: { _request_id: string }
        Returns: boolean
      }
      ceo_approve_lop_reversal: {
        Args: { p_lop_id: string; p_reversal_reason?: string }
        Returns: Json
      }
      check_critical_compliance: { Args: never; Returns: Json }
      check_escalation_compliance: { Args: never; Returns: Json }
      check_escalation_sla_breach: { Args: never; Returns: undefined }
      check_habitual_late_pattern: {
        Args: { p_date: string; p_user_id: string }
        Returns: Json
      }
      check_inventory_stock_alerts: {
        Args: { p_project_id?: string }
        Returns: {
          alert_type: string
          balance: number
          inventory_id: string
          material_name: string
          project_id: string
          project_name: string
          stock_percent: number
          unit: string
        }[]
      }
      check_is_chat_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      check_report_compliance: { Args: never; Returns: Json }
      check_selfie_compliance: {
        Args: { p_selfie_type: string }
        Returns: Json
      }
      check_verticals_status: {
        Args: never
        Returns: {
          active: number
          category: string
          missing_expected: number
          total: number
        }[]
      }
      cleanup_expired_selfies: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_priority?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      cron_auto_mark_absent: { Args: never; Returns: Json }
      delete_expired_notifications: { Args: never; Returns: undefined }
      evaluate_reporting_compliance: {
        Args: { p_date: string; p_user_id: string }
        Returns: Json
      }
      generate_bulk_batch_id: { Args: never; Returns: string }
      generate_cafe_order_number: { Args: never; Returns: string }
      generate_monthly_rent_drafts: { Args: never; Returns: number }
      generate_monthly_rental_drafts:
        | { Args: never; Returns: undefined }
        | { Args: { target_date: string }; Returns: undefined }
      generate_site_visit_request_number: { Args: never; Returns: string }
      get_attendance_status_for_admin: {
        Args: { p_date: string }
        Returns: {
          day_start_time: string
          email: string
          id: string
          is_revoked: boolean
          morning_selfie_time: string
          name: string
          override_type: string
          role: string
        }[]
      }
      get_ceo_salary_batches: {
        Args: never
        Returns: {
          accounts_processed_at: string | null
          accounts_processed_by: string | null
          auditor_approved_at: string | null
          auditor_approved_by: string | null
          batch_code: string
          ceo_approved_at: string | null
          ceo_approved_by: string | null
          created_at: string | null
          created_by: string
          department: string | null
          from_day: number
          hr_verified_at: string | null
          hr_verified_by: string | null
          id: string
          month: number
          paid_at: string | null
          paid_by: string | null
          paid_date: string | null
          prepared_by: string | null
          rejection_reason: string | null
          released_at: string | null
          released_by: string | null
          selected_days_override: number[] | null
          status: string
          to_day: number
          total_amount: number | null
          total_employees: number | null
          total_incentives: number | null
          total_lop_amount: number | null
          total_net_pay: number | null
          total_salary: number
          total_tds: number | null
          updated_at: string | null
          year: number
        }[]
        SetofOptions: {
          from: "*"
          to: "salary_batches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_current_slot: { Args: never; Returns: number }
      get_daily_consumption_report: {
        Args: { p_date?: string; p_project_id: string }
        Returns: {
          logged_at: string
          logged_by_name: string
          material_name: string
          purpose: string
          quantity_used: number
          unit: string
        }[]
      }
      get_my_department: { Args: never; Returns: string }
      get_my_department_type: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_project_aging: { Args: { p_project_id: string }; Returns: Json }
      get_salary_analysis: {
        Args: { p_month: number; p_year: number }
        Returns: {
          bonus: number
          department: string
          employee_id: string
          fixed_monthly_salary: number
          full_name: string
          gross: number
          incentive: number
          increment_amount: number
          lop_amount: number
          lop_days: number
          net: number
          tds: number
        }[]
      }
      get_week_off_dates: {
        Args: {
          p_employee_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          assignment_type: string
          reason: string
          week_off_date: string
        }[]
      }
      has_elevated_role: { Args: never; Returns: boolean }
      is_engineering_employee: { Args: { _user_id: string }; Returns: boolean }
      is_executive: { Args: { _user_id: string }; Returns: boolean }
      is_management_role: { Args: { user_id: string }; Returns: boolean }
      is_non_working_day: { Args: { p_date?: string }; Returns: boolean }
      is_project_team_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_week_off_day: {
        Args: { p_date: string; p_employee_id: string }
        Returns: boolean
      }
      list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      mark_overdue_escalations: { Args: never; Returns: number }
      process_lop_reversal: {
        Args: { p_action: string; p_lop_id: string }
        Returns: Json
      }
      regenerate_onboarding_token: {
        Args: {
          p_expires_at: string
          p_new_link: string
          p_new_token: string
          p_onboarding_id: string
        }
        Returns: boolean
      }
      revoke_attendance_lock: {
        Args: {
          p_admin_id: string
          p_date: string
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      toggle_cron_job: {
        Args: { p_active: boolean; p_jobname: string }
        Returns: undefined
      }
      validate_onboarding_token: {
        Args: { p_token: string }
        Returns: {
          aadhaar_number: string
          aadhaar_url: string
          activation_token: string
          bank_account_number: string
          contact_number: string
          current_address: string
          date_of_birth: string
          degree_marksheet_url: string
          department: string
          email: string
          emergency_contact_number: string
          error_message: string
          full_name: string
          generated_username: string
          hr_policy_url: string
          id: string
          ifsc_code: string
          is_valid: boolean
          marksheet_10_url: string
          marksheet_12_url: string
          offer_letter_url: string
          parents_number: string
          passbook_url: string
          permanent_address: string
          photo_url: string
          resume_url: string
          status: string
          token_expires_at: string
        }[]
      }
    }
    Enums: {
      payment_status:
        | "pending"
        | "approved"
        | "rejected"
        | "director_approval"
        | "smo_approval"
        | "gmo_approval"
        | "gm_approval"
        | "boi_audit"
        | "admin_audit"
        | "ceo_approval"
        | "ceo_hold"
        | "accounts_execution"
        | "bulk_prepared"
        | "paid"
        | "draft"
      salary_slip_status: "generated" | "failed"
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
      payment_status: [
        "pending",
        "approved",
        "rejected",
        "director_approval",
        "smo_approval",
        "gmo_approval",
        "gm_approval",
        "boi_audit",
        "admin_audit",
        "ceo_approval",
        "ceo_hold",
        "accounts_execution",
        "bulk_prepared",
        "paid",
        "draft",
      ],
      salary_slip_status: ["generated", "failed"],
    },
  },
} as const
;

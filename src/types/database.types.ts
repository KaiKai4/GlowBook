export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointment_items: {
        Row: {
          appointment_id: string
          blocks_calendar: boolean
          created_at: string
          discount_amount: number
          duration_minutes: number
          employee_id: string
          end_time: string
          id: string
          ordering: number
          price: number
          salon_id: string
          service_id: string
          start_time: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          appointment_id: string
          blocks_calendar?: boolean
          created_at?: string
          discount_amount?: number
          duration_minutes: number
          employee_id: string
          end_time: string
          id?: string
          ordering?: number
          price?: number
          salon_id: string
          service_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          blocks_calendar?: boolean
          created_at?: string
          discount_amount?: number
          duration_minutes?: number
          employee_id?: string
          end_time?: string
          id?: string
          ordering?: number
          price?: number
          salon_id?: string
          service_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointment_items_employee_same_salon"
            columns: ["employee_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "fk_appointment_items_service_same_salon"
            columns: ["service_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      appointment_reminder_log: {
        Row: {
          appointment_id: string
          channel: string
          created_by: string | null
          id: string
          recipient_email: string | null
          recipient_phone: string | null
          salon_id: string
          sent_at: string
          template_id: string | null
        }
        ComputedFields: never
        Insert: {
          appointment_id: string
          channel: string
          created_by?: string | null
          id?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          salon_id: string
          sent_at?: string
          template_id?: string | null
        }
        Update: {
          appointment_id?: string
          channel?: string
          created_by?: string | null
          id?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          salon_id?: string
          sent_at?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminder_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminder_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminder_log_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminder_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          completion_price_note: string
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          end_time: string | null
          id: string
          notes: string
          payment_method: string
          salon_id: string
          start_time: string | null
          status: string
          total_price: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          completion_price_note?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          end_time?: string | null
          id?: string
          notes?: string
          payment_method?: string
          salon_id: string
          start_time?: string | null
          status?: string
          total_price?: number
          updated_at?: string
        }
        Update: {
          completion_price_note?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          end_time?: string | null
          id?: string
          notes?: string
          payment_method?: string
          salon_id?: string
          start_time?: string | null
          status?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_customer_same_salon"
            columns: ["customer_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      commercial_addons: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string
          id: string
          kind: string
          limit_delta: number | null
          metric_key: string | null
          module_key: string | null
          monthly_price: number
          name: string
          sort_order: number
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          kind: string
          limit_delta?: number | null
          metric_key?: string | null
          module_key?: string | null
          monthly_price?: number
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          kind?: string
          limit_delta?: number | null
          metric_key?: string | null
          module_key?: string | null
          monthly_price?: number
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_addons_metric_key_fkey"
            columns: ["metric_key"]
            isOneToOne: false
            referencedRelation: "commercial_limit_metrics"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "commercial_addons_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["key"]
          },
        ]
      }
      commercial_limit_metrics: {
        Row: {
          counter_key: string
          created_at: string
          default_count_scope: string
          description: string
          is_active: boolean
          is_archived: boolean
          key: string
          module_key: string
          name: string
          sort_order: number
          unit: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          counter_key: string
          created_at?: string
          default_count_scope?: string
          description?: string
          is_active?: boolean
          is_archived?: boolean
          key: string
          module_key: string
          name: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          counter_key?: string
          created_at?: string
          default_count_scope?: string
          description?: string
          is_active?: boolean
          is_archived?: boolean
          key?: string
          module_key?: string
          name?: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_limit_metrics_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["key"]
          },
        ]
      }
      commercial_plan_limits: {
        Row: {
          count_scope: string
          created_at: string
          enforcement_mode: string
          id: string
          max_value: number | null
          metric_key: string
          plan_id: string
          updated_at: string
          warning_threshold: number
        }
        ComputedFields: never
        Insert: {
          count_scope?: string
          created_at?: string
          enforcement_mode?: string
          id?: string
          max_value?: number | null
          metric_key: string
          plan_id: string
          updated_at?: string
          warning_threshold?: number
        }
        Update: {
          count_scope?: string
          created_at?: string
          enforcement_mode?: string
          id?: string
          max_value?: number | null
          metric_key?: string
          plan_id?: string
          updated_at?: string
          warning_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_plan_limits_metric_key_fkey"
            columns: ["metric_key"]
            isOneToOne: false
            referencedRelation: "commercial_limit_metrics"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "commercial_plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_plan_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          plan_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_plan_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "commercial_plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string
          id: string
          is_public: boolean
          monthly_price: number
          name: string
          sort_order: number
          status: string
          trial_days: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_public?: boolean
          monthly_price?: number
          name: string
          sort_order?: number
          status?: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_public?: boolean
          monthly_price?: number
          name?: string
          sort_order?: number
          status?: string
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          is_temporary: boolean
          last_name: string
          notes: string
          phone: string | null
          salon_id: string
          search_name: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          is_temporary?: boolean
          last_name: string
          notes?: string
          phone?: string | null
          salon_id: string
          search_name?: never
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          is_temporary?: boolean
          last_name?: string
          notes?: string
          phone?: string | null
          salon_id?: string
          search_name?: never
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_categories: {
        Row: {
          category_id: string
          employee_id: string
          salon_id: string
        }
        ComputedFields: never
        Insert: {
          category_id: string
          employee_id: string
          salon_id: string
        }
        Update: {
          category_id?: string
          employee_id?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_categories_category_same_salon"
            columns: ["category_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "fk_employee_categories_employee_same_salon"
            columns: ["employee_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      employee_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          employee_id: string
          expires_at: string
          id: string
          role_id: string | null
          salon_id: string
          token_hash: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          employee_id: string
          expires_at?: string
          id?: string
          role_id?: string | null
          salon_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          employee_id?: string
          expires_at?: string
          id?: string
          role_id?: string | null
          salon_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invitations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_services: {
        Row: {
          employee_id: string
          salon_id: string
          service_id: string
        }
        ComputedFields: never
        Insert: {
          employee_id: string
          salon_id: string
          service_id: string
        }
        Update: {
          employee_id?: string
          salon_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_services_employee_same_salon"
            columns: ["employee_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "fk_employee_services_service_same_salon"
            columns: ["service_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      employees: {
        Row: {
          commission_percentage: number
          created_at: string
          email: string
          first_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          last_name: string
          phone: string
          profile_id: string | null
          salon_id: string
          specialty: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          commission_percentage?: number
          created_at?: string
          email?: string
          first_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string
          profile_id?: string | null
          salon_id: string
          specialty?: string
          updated_at?: string
        }
        Update: {
          commission_percentage?: number
          created_at?: string
          email?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string
          profile_id?: string | null
          salon_id?: string
          specialty?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          concept: string | null
          created_at: string
          custom_category: string | null
          expense_date: string
          id: string
          note: string | null
          receipt_url: string | null
          salon_id: string
          updated_at: string
          vendor_name: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          category: string
          concept?: string | null
          created_at?: string
          custom_category?: string | null
          expense_date?: string
          id?: string
          note?: string | null
          receipt_url?: string | null
          salon_id: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category?: string
          concept?: string | null
          created_at?: string
          custom_category?: string | null
          expense_date?: string
          id?: string
          note?: string | null
          receipt_url?: string | null
          salon_id?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          message: string
          salon_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          salon_id: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          salon_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          location: string
          movement_type: string
          note: string | null
          product_id: string
          quantity_after: number
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
          salon_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          location: string
          movement_type: string
          note?: string | null
          product_id: string
          quantity_after: number
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
          salon_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity_after?: number
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_products: {
        Row: {
          category: string | null
          cost_price: number
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_retail_enabled: boolean
          name: string
          sale_price: number
          salon_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          category?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_retail_enabled?: boolean
          name: string
          sale_price?: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_retail_enabled?: boolean
          name?: string
          sale_price?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchase_items: {
        Row: {
          created_at: string
          id: string
          location: string
          product_id: string
          purchase_id: string
          quantity: number
          salon_id: string
          total_cost: number
          unit_cost: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          location: string
          product_id: string
          purchase_id: string
          quantity: number
          salon_id: string
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          salon_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchases: {
        Row: {
          created_at: string
          id: string
          note: string | null
          purchase_date: string
          salon_id: string
          supplier_name: string | null
          total_cost: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          purchase_date?: string
          salon_id: string
          supplier_name?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          purchase_date?: string
          salon_id?: string
          supplier_name?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchases_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_locations: {
        Row: {
          created_at: string
          id: string
          location: string
          minimum_quantity: number
          product_id: string
          quantity: number
          salon_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          location: string
          minimum_quantity?: number
          product_id: string
          quantity?: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          minimum_quantity?: number
          product_id?: string
          quantity?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_locations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_locations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_html: string
          body_text: string
          channel: string
          created_at: string
          event: string
          id: string
          is_active: boolean
          name: string
          recipient: string
          salon_id: string
          subject: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          body_html?: string
          body_text: string
          channel: string
          created_at?: string
          event: string
          id?: string
          is_active?: boolean
          name: string
          recipient?: string
          salon_id: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string
          channel?: string
          created_at?: string
          event?: string
          id?: string
          is_active?: boolean
          name?: string
          recipient?: string
          salon_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          id: string
          key: string
        }
        ComputedFields: never
        Insert: {
          description?: string
          id?: string
          key: string
        }
        Update: {
          description?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: NonNullable<Json>
          status: string
          target_resource_id: string | null
          target_resource_type: string | null
          target_salon_id: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: NonNullable<Json>
          status: string
          target_resource_id?: string | null
          target_resource_type?: string | null
          target_salon_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: NonNullable<Json>
          status?: string
          target_resource_id?: string | null
          target_resource_type?: string | null
          target_salon_id?: string | null
        }
        Relationships: []
      }
      platform_modules: {
        Row: {
          created_at: string
          description: string
          icon_name: string
          is_active: boolean
          is_archived: boolean
          key: string
          name: string
          nav_href: string
          sort_order: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string
          icon_name?: string
          is_active?: boolean
          is_archived?: boolean
          key: string
          name: string
          nav_href?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon_name?: string
          is_active?: boolean
          is_archived?: boolean
          key?: string
          name?: string
          nav_href?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          is_owner: boolean
          role_id: string | null
          salon_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          is_owner?: boolean
          role_id?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          role_id?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          count: number
          expires_at: string
          key: string
          window_started_at: string
        }
        ComputedFields: never
        Insert: {
          count: number
          expires_at: string
          key: string
          window_started_at: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
          window_started_at?: string
        }
        Relationships: []
      }
      retail_sale_items: {
        Row: {
          created_at: string
          id: string
          location: string
          product_id: string
          quantity: number
          sale_id: string
          salon_id: string
          total_price: number
          unit_price: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          location: string
          product_id: string
          quantity: number
          sale_id: string
          salon_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          salon_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "retail_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "retail_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_sale_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_sales: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          note: string | null
          payment_method: string
          sale_date: string
          salon_id: string
          total_amount: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          payment_method?: string
          sale_date?: string
          salon_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          payment_method?: string
          sale_date?: string
          salon_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
          salon_id: string
        }
        ComputedFields: never
        Insert: {
          permission_id: string
          role_id: string
          salon_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          name: string
          salon_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_activity_log: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          created_at: string
          id: string
          record_id: string | null
          record_label: string
          salon_id: string
          table_name: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
          record_label?: string
          salon_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
          record_label?: string
          salon_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_activity_log_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_business_hours: {
        Row: {
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          open_time: string | null
          salon_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          open_time?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          open_time?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_business_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          plan_id: string | null
          salon_id: string | null
          status: string
          token_hash: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          plan_id?: string | null
          salon_id?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          plan_id?: string | null
          salon_id?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_invitations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_invitations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_plan_alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          metric_key: string | null
          module_key: string | null
          plan_id: string | null
          salon_id: string
          severity: string
          status: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          message: string
          metric_key?: string | null
          module_key?: string | null
          plan_id?: string | null
          salon_id: string
          severity?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metric_key?: string | null
          module_key?: string | null
          plan_id?: string | null
          salon_id?: string
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_plan_alerts_metric_key_fkey"
            columns: ["metric_key"]
            isOneToOne: false
            referencedRelation: "commercial_limit_metrics"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "salon_plan_alerts_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "salon_plan_alerts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_plan_alerts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_plan_assignments: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          ends_at: string | null
          id: string
          notes: string
          plan_id: string
          salon_id: string
          starts_at: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          notes?: string
          plan_id: string
          salon_id: string
          starts_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          notes?: string
          plan_id?: string
          salon_id?: string
          starts_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_plan_assignments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_plan_overrides: {
        Row: {
          addon_id: string | null
          created_at: string
          ends_at: string | null
          enforcement_mode: string | null
          id: string
          is_gift: boolean
          max_delta: number | null
          max_override: number | null
          metric_key: string | null
          module_enabled: boolean | null
          module_key: string | null
          price_override: number | null
          quantity: number
          reason: string
          salon_id: string
          starts_at: string | null
          status: string
          updated_at: string
          warning_threshold: number | null
        }
        ComputedFields: never
        Insert: {
          addon_id?: string | null
          created_at?: string
          ends_at?: string | null
          enforcement_mode?: string | null
          id?: string
          is_gift?: boolean
          max_delta?: number | null
          max_override?: number | null
          metric_key?: string | null
          module_enabled?: boolean | null
          module_key?: string | null
          price_override?: number | null
          quantity?: number
          reason?: string
          salon_id: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          addon_id?: string | null
          created_at?: string
          ends_at?: string | null
          enforcement_mode?: string | null
          id?: string
          is_gift?: boolean
          max_delta?: number | null
          max_override?: number | null
          metric_key?: string | null
          module_enabled?: boolean | null
          module_key?: string | null
          price_override?: number | null
          quantity?: number
          reason?: string
          salon_id?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_plan_overrides_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "commercial_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_plan_overrides_metric_key_fkey"
            columns: ["metric_key"]
            isOneToOne: false
            referencedRelation: "commercial_limit_metrics"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "salon_plan_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "salon_plan_overrides_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_plan_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string
          paid_at: string
          period_end: string
          period_start: string
          plan_id: string | null
          salon_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string
          paid_at?: string
          period_end: string
          period_start: string
          plan_id?: string | null
          salon_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string
          paid_at?: string
          period_end?: string
          period_start?: string
          plan_id?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_plan_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_plan_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string
          allow_off_hours_bookings: boolean
          bg_style: string | null
          card_style: string | null
          created_at: string
          disabled_features: string[]
          email: string
          id: string
          is_active: boolean
          min_appointment_duration_minutes: number
          min_booking_notice_minutes: number
          name: string
          payment_methods: string[]
          phone: string
          primary_color: string
          secondary_color: string
          sidebar_style: string | null
          theme: string
          timezone: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          address?: string
          allow_off_hours_bookings?: boolean
          bg_style?: string | null
          card_style?: string | null
          created_at?: string
          disabled_features?: string[]
          email?: string
          id?: string
          is_active?: boolean
          min_appointment_duration_minutes?: number
          min_booking_notice_minutes?: number
          name: string
          payment_methods?: string[]
          phone?: string
          primary_color?: string
          secondary_color?: string
          sidebar_style?: string | null
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          allow_off_hours_bookings?: boolean
          bg_style?: string | null
          card_style?: string | null
          created_at?: string
          disabled_features?: string[]
          email?: string
          id?: string
          is_active?: boolean
          min_appointment_duration_minutes?: number
          min_booking_notice_minutes?: number
          name?: string
          payment_methods?: string[]
          phone?: string
          primary_color?: string
          secondary_color?: string
          sidebar_style?: string | null
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          employee_id: string
          exception_date: string
          id: string
          reason: string
          salon_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          employee_id: string
          exception_date: string
          id?: string
          reason?: string
          salon_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          exception_date?: string
          id?: string
          reason?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_employee_salon_fk"
            columns: ["salon_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["salon_id", "id"]
          },
          {
            foreignKeyName: "schedule_exceptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          ordering: number
          pricing_mode: string
          salon_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          ordering?: number
          pricing_mode?: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          ordering?: number
          pricing_mode?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string
          created_at: string
          description: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          salon_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          category_id: string
          created_at?: string
          description?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_services_category_same_salon"
            columns: ["category_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          employee_id: string
          end_time: string
          id: string
          is_active: boolean
          salon_id: string
          start_time: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          day_of_week: number
          employee_id: string
          end_time: string
          id?: string
          is_active?: boolean
          salon_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          employee_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          salon_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_work_schedules_employee_same_salon"
            columns: ["employee_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "work_schedules_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { p_full_name: string; p_salon_name: string; p_token: string }
        Returns: string
      }
      accept_invitation_admin: {
        Args: {
          p_email: string
          p_full_name: string
          p_salon_name: string
          p_token: string
          p_user_id: string
        }
        Returns: string
      }
      apply_inventory_stock_delta: {
        Args: {
          p_delta: number
          p_location: string
          p_movement_type: string
          p_note?: string
          p_product_id: string
          p_reference_id?: string
          p_reference_type?: string
          p_salon_id: string
        }
        Returns: number
      }
      consume_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      count_salon_usage: {
        Args: { p_counters: Json; p_salon_id: string }
        Returns: Json
      }
      create_appointment: { Args: { payload: Json }; Returns: string }
      create_salon_with_owner:
        | {
            Args: {
              p_full_name: string
              p_owner_id: string
              p_salon_name: string
            }
            Returns: string
          }
        | {
            Args: { p_full_name: string; p_salon_name: string }
            Returns: string
          }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_salon_completely: {
        Args: { p_salon_id: string }
        Returns: {
          user_id: string
        }[]
      }
      has_permission: { Args: { perm: string }; Returns: boolean }
      invite_salon: { Args: { p_email: string }; Returns: string }
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      platform_salon_overviews: {
        Args: Record<PropertyKey, never>
        Returns: {
          appointment_count: number
          collaborator_count: number
          contact_email: string
          created_at: string
          customer_count: number
          disabled_features: string[]
          email: string
          id: string
          invitation_count: number
          is_active: boolean
          last_appointment_at: string
          name: string
          owner_count: number
          owner_names: string[]
          phone: string
          service_count: number
        }[]
      }
      record_inventory_purchase: {
        Args: {
          p_note?: string
          p_product_id: string
          p_purchase_date: string
          p_quantity: number
          p_salon_id: string
          p_supplier_name: string
          p_unit_cost: number
        }
        Returns: string
      }
      record_inventory_transfer: {
        Args: {
          p_from_location: string
          p_note?: string
          p_product_id: string
          p_quantity: number
          p_salon_id: string
          p_to_location: string
        }
        Returns: undefined
      }
      record_retail_sale: {
        Args: {
          p_customer_id: string
          p_location: string
          p_note?: string
          p_payment_method: string
          p_product_id: string
          p_quantity: number
          p_salon_id: string
          p_unit_price: number
        }
        Returns: string
      }
      report_monthly_history: {
        Args: {
          p_end: string
          p_salon_id: string
          p_start: string
          p_timezone: string
        }
        Returns: Json
      }
      salon_id: { Args: Record<PropertyKey, never>; Returns: string }
      update_appointment: { Args: { payload: Json }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    : never = never
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

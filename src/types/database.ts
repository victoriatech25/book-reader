export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      book_tags: {
        Row: {
          book_id: string;
          tag_id: string;
        };
        Insert: {
          book_id: string;
          tag_id: string;
        };
        Update: {
          book_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "book_tags_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "book_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      books: {
        Row: {
          authors: string[];
          category_id: string | null;
          cover_url: string | null;
          created_at: string;
          format: string;
          id: string;
          isbn13: string | null;
          memo: string | null;
          ownership: string;
          published_on: string | null;
          publisher: string | null;
          source: string;
          source_ref: Json | null;
          subtitle: string | null;
          title: string;
          total_pages: number | null;
          translators: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          authors?: string[];
          category_id?: string | null;
          cover_url?: string | null;
          created_at?: string;
          format?: string;
          id?: string;
          isbn13?: string | null;
          memo?: string | null;
          ownership?: string;
          published_on?: string | null;
          publisher?: string | null;
          source?: string;
          source_ref?: Json | null;
          subtitle?: string | null;
          title: string;
          total_pages?: number | null;
          translators?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          authors?: string[];
          category_id?: string | null;
          cover_url?: string | null;
          created_at?: string;
          format?: string;
          id?: string;
          isbn13?: string | null;
          memo?: string | null;
          ownership?: string;
          published_on?: string | null;
          publisher?: string | null;
          source?: string;
          source_ref?: Json | null;
          subtitle?: string | null;
          title?: string;
          total_pages?: number | null;
          translators?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "books_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "books_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          id: string;
          metric: string;
          period: string;
          period_key: string;
          target: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metric?: string;
          period: string;
          period_key: string;
          target: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metric?: string;
          period?: string;
          period_key?: string;
          target?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          is_favorite: boolean;
          kind: string;
          location: number | null;
          reading_id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          is_favorite?: boolean;
          kind?: string;
          location?: number | null;
          reading_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          is_favorite?: boolean;
          kind?: string;
          location?: number | null;
          reading_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_reading_id_fkey";
            columns: ["reading_id"];
            isOneToOne: false;
            referencedRelation: "readings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          timezone: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      progress_logs: {
        Row: {
          created_at: string;
          id: string;
          logged_on: string;
          memo: string | null;
          minutes: number | null;
          reading_id: string;
          user_id: string;
          value_from: number | null;
          value_to: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logged_on?: string;
          memo?: string | null;
          minutes?: number | null;
          reading_id: string;
          user_id: string;
          value_from?: number | null;
          value_to: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          logged_on?: string;
          memo?: string | null;
          minutes?: number | null;
          reading_id?: string;
          user_id?: string;
          value_from?: number | null;
          value_to?: number;
        };
        Relationships: [
          {
            foreignKeyName: "progress_logs_reading_id_fkey";
            columns: ["reading_id"];
            isOneToOne: false;
            referencedRelation: "readings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      readings: {
        Row: {
          attempt_no: number;
          book_id: string;
          created_at: string;
          current_value: number;
          drop_reason: string | null;
          dropped_at: string | null;
          due_on: string | null;
          finished_at: string | null;
          id: string;
          progress_unit: string;
          rating: number | null;
          review: string | null;
          review_is_private: boolean;
          spoiler: boolean;
          started_at: string | null;
          status: string;
          target_value: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempt_no?: number;
          book_id: string;
          created_at?: string;
          current_value?: number;
          drop_reason?: string | null;
          dropped_at?: string | null;
          due_on?: string | null;
          finished_at?: string | null;
          id?: string;
          progress_unit?: string;
          rating?: number | null;
          review?: string | null;
          review_is_private?: boolean;
          spoiler?: boolean;
          started_at?: string | null;
          status?: string;
          target_value?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempt_no?: number;
          book_id?: string;
          created_at?: string;
          current_value?: number;
          drop_reason?: string | null;
          dropped_at?: string | null;
          due_on?: string | null;
          finished_at?: string | null;
          id?: string;
          progress_unit?: string;
          rating?: number | null;
          review?: string | null;
          review_is_private?: boolean;
          spoiler?: boolean;
          started_at?: string | null;
          status?: string;
          target_value?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "readings_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "readings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shelf_books: {
        Row: {
          book_id: string;
          shelf_id: string;
          sort_order: number;
        };
        Insert: {
          book_id: string;
          shelf_id: string;
          sort_order?: number;
        };
        Update: {
          book_id?: string;
          shelf_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "shelf_books_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shelf_books_shelf_id_fkey";
            columns: ["shelf_id"];
            isOneToOne: false;
            referencedRelation: "shelves";
            referencedColumns: ["id"];
          },
        ];
      };
      shelves: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shelves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      record_progress: {
        Args: {
          p_logged_on?: string;
          p_memo?: string;
          p_minutes?: number;
          p_reading_id: string;
          p_value_to: number;
        };
        Returns: {
          attempt_no: number;
          book_id: string;
          created_at: string;
          current_value: number;
          drop_reason: string | null;
          dropped_at: string | null;
          due_on: string | null;
          finished_at: string | null;
          id: string;
          progress_unit: string;
          rating: number | null;
          review: string | null;
          review_is_private: boolean;
          spoiler: boolean;
          started_at: string | null;
          status: string;
          target_value: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "readings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;

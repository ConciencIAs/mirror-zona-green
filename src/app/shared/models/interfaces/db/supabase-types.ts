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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      base_confianza: {
        Row: {
          agregado_el: string | null
          agregado_por: string | null
          id: string
          telefono: string
        }
        Insert: {
          agregado_el?: string | null
          agregado_por?: string | null
          id?: string
          telefono: string
        }
        Update: {
          agregado_el?: string | null
          agregado_por?: string | null
          id?: string
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_confianza_agregado_por_fkey"
            columns: ["agregado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrito: {
        Row: {
          cantidad: number
          id: string
          paquete_gramos: number | null
          producto_id: string
          usuario_id: string
        }
        Insert: {
          cantidad?: number
          id?: string
          paquete_gramos?: number | null
          producto_id: string
          usuario_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          paquete_gramos?: number | null
          producto_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrito_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrito_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_components: {
        Row: {
          created_at: string | null
          css_content: string | null
          html_content: string | null
          id: string
          js_content: string | null
          name: string | null
          project_data: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          css_content?: string | null
          html_content?: string | null
          id?: string
          js_content?: string | null
          name?: string | null
          project_data?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          css_content?: string | null
          html_content?: string | null
          id?: string
          js_content?: string | null
          name?: string | null
          project_data?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      historial_inventario: {
        Row: {
          admin_id: string | null
          cantidad_anterior: number
          cantidad_nueva: number
          created_at: string | null
          id: string
          motivo: string
          producto_id: string | null
          tipo_movimiento: string
        }
        Insert: {
          admin_id?: string | null
          cantidad_anterior: number
          cantidad_nueva: number
          created_at?: string | null
          id?: string
          motivo: string
          producto_id?: string | null
          tipo_movimiento: string
        }
        Update: {
          admin_id?: string | null
          cantidad_anterior?: number
          cantidad_nueva?: number
          created_at?: string | null
          id?: string
          motivo?: string
          producto_id?: string | null
          tipo_movimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_inventario_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          comentarios_usuario: string | null
          correo_cliente: string | null
          created_at: string | null
          direccion: string | null
          id: string
          lista_productos: Json
          nombre_cliente: string | null
          precio_total: number
          status: Database["public"]["Enums"]["estado_orden"]
          tipo_entrega: string
          tracking: Json | null
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          comentarios_usuario?: string | null
          correo_cliente?: string | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          lista_productos: Json
          nombre_cliente?: string | null
          precio_total: number
          status?: Database["public"]["Enums"]["estado_orden"]
          tipo_entrega?: string
          tracking?: Json | null
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          comentarios_usuario?: string | null
          correo_cliente?: string | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          lista_productos?: Json
          nombre_cliente?: string | null
          precio_total?: number
          status?: Database["public"]["Enums"]["estado_orden"]
          tipo_entrega?: string
          tracking?: Json | null
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_config: {
        Row: {
          config_name: string
          content: Json | null
          id: string
        }
        Insert: {
          config_name: string
          content?: Json | null
          id?: string
        }
        Update: {
          config_name?: string
          content?: Json | null
          id?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          codigo_invitacion: string | null
          correo: string
          created_at: string | null
          datos_adicionales: Json
          deleted_at: string | null
          documento: string | null
          fecha_nacimiento: string | null
          full_name: string | null
          id: string
          origen_autorizacion: string | null
          referido_por: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          status: Database["public"]["Enums"]["status_profile"] | null
          telefono: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_doc"] | null
          ubicacion: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_invitacion?: string | null
          correo: string
          created_at?: string | null
          datos_adicionales?: Json
          deleted_at?: string | null
          documento?: string | null
          fecha_nacimiento?: string | null
          full_name?: string | null
          id: string
          origen_autorizacion?: string | null
          referido_por?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          status?: Database["public"]["Enums"]["status_profile"] | null
          telefono?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_doc"] | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_invitacion?: string | null
          correo?: string
          created_at?: string | null
          datos_adicionales?: Json
          deleted_at?: string | null
          documento?: string | null
          fecha_nacimiento?: string | null
          full_name?: string | null
          id?: string
          origen_autorizacion?: string | null
          referido_por?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          status?: Database["public"]["Enums"]["status_profile"] | null
          telefono?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_doc"] | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          costo: number
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          es_por_gramos: boolean
          has_product_variantes: boolean | null
          id: string
          nombre: string
          ofertas: Json[] | null
          precio: number
          presentacion_venta:
            | Database["public"]["Enums"]["presentaciones_productos"]
            | null
          presentaciones: Json | null
          rating_average: number
          rating_count: number
          reservado: number | null
          sku: string
          status: Database["public"]["Enums"]["estado_producto"]
          stock_total: number
          tags: string[] | null
          updated_at: string | null
          urls_imagenes: string[] | null
        }
        Insert: {
          costo?: number
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          es_por_gramos?: boolean
          has_product_variantes?: boolean | null
          id?: string
          nombre: string
          ofertas?: Json[] | null
          precio?: number
          presentacion_venta?:
            | Database["public"]["Enums"]["presentaciones_productos"]
            | null
          presentaciones?: Json | null
          rating_average?: number
          rating_count?: number
          reservado?: number | null
          sku: string
          status?: Database["public"]["Enums"]["estado_producto"]
          stock_total?: number
          tags?: string[] | null
          updated_at?: string | null
          urls_imagenes?: string[] | null
        }
        Update: {
          costo?: number
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          es_por_gramos?: boolean
          has_product_variantes?: boolean | null
          id?: string
          nombre?: string
          ofertas?: Json[] | null
          precio?: number
          presentacion_venta?:
            | Database["public"]["Enums"]["presentaciones_productos"]
            | null
          presentaciones?: Json | null
          rating_average?: number
          rating_count?: number
          reservado?: number | null
          sku?: string
          status?: Database["public"]["Enums"]["estado_producto"]
          stock_total?: number
          tags?: string[] | null
          updated_at?: string | null
          urls_imagenes?: string[] | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          id: string
          nombre: Database["public"]["Enums"]["rol_usuario"]
          updated_at: string | null
          urls_permitidas: string[]
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string | null
          urls_permitidas?: string[]
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string | null
          urls_permitidas?: string[]
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      usuarios_publicos: {
        Row: {
          correo: string
          created_at: string | null
          id: string
          uid: string | null
        }
        Insert: {
          correo: string
          created_at?: string | null
          id?: string
          uid?: string | null
        }
        Update: {
          correo?: string
          created_at?: string | null
          id?: string
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_publicos_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      is_active_user: { Args: never; Returns: boolean }
      procesar_checkout: {
        Args: {
          p_comentarios?: string
          p_direccion?: string
          p_tipo_entrega?: string
        }
        Returns: Json
      }
      validar_codigo_referido: {
        Args: { codigo_prueba: string }
        Returns: boolean
      }
    }
    Enums: {
      estado_orden:
        | "pendiente"
        | "pagado"
        | "en_proceso"
        | "enviado"
        | "entregado"
        | "cancelado"
        | "aporte"
        | "seleccion"
      estado_producto: "activo" | "inactivo"
      presentaciones_productos: "und" | "gr" | "mg"
      rol_usuario:
        | "admin"
        | "customer"
        | "agente"
        | "super"
        | "medico"
        | "anonymous"
      status_profile: "activo" | "eliminado" | "bloqueado" | "inactivo"
      tipo_doc: "CC" | "CE" | "NIT" | "Pasaporte"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_orden: [
        "pendiente",
        "pagado",
        "en_proceso",
        "enviado",
        "entregado",
        "cancelado",
        "aporte",
        "seleccion",
      ],
      estado_producto: ["activo", "inactivo"],
      presentaciones_productos: ["und", "gr", "mg"],
      rol_usuario: [
        "admin",
        "customer",
        "agente",
        "super",
        "medico",
        "anonymous",
      ],
      status_profile: ["activo", "eliminado", "bloqueado", "inactivo"],
      tipo_doc: ["CC", "CE", "NIT", "Pasaporte"],
    },
  },
} as const
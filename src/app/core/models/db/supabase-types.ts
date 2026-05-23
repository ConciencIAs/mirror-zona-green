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
      carrito: {
        Row: {
          cantidad: number
          es_gramos: boolean
          id: string
          producto_id: string
          usuario_id: string
          variante_id: string | null
        }
        Insert: {
          cantidad?: number
          es_gramos?: boolean
          id?: string
          producto_id: string
          usuario_id: string
          variante_id?: string | null
        }
        Update: {
          cantidad?: number
          es_gramos?: boolean
          id?: string
          producto_id?: string
          usuario_id?: string
          variante_id?: string | null
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
          {
            foreignKeyName: "carrito_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "producto_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          deleted_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          deleted_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          deleted_at?: string | null
          id?: string
          nombre?: string
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
          variante_id: string | null
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
          variante_id?: string | null
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
          variante_id?: string | null
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
          {
            foreignKeyName: "historial_inventario_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "producto_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          comentarios_agente: string | null
          created_at: string | null
          id: string
          lista_productos: Json
          precio_total: number
          status: Database["public"]["Enums"]["estado_orden"]
          tipo_entrega: string
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          comentarios_agente?: string | null
          created_at?: string | null
          id?: string
          lista_productos: Json
          precio_total: number
          status?: Database["public"]["Enums"]["estado_orden"]
          tipo_entrega?: string
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          comentarios_agente?: string | null
          created_at?: string | null
          id?: string
          lista_productos?: Json
          precio_total?: number
          status?: Database["public"]["Enums"]["estado_orden"]
          tipo_entrega?: string
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
          franja_promocional: string | null
          id: string
          logo: string | null
          nombre: string
          telefono: string | null
          url_legislacion: string | null
          url_politica_datos: string | null
          url_terminos: string | null
        }
        Insert: {
          franja_promocional?: string | null
          id?: string
          logo?: string | null
          nombre: string
          telefono?: string | null
          url_legislacion?: string | null
          url_politica_datos?: string | null
          url_terminos?: string | null
        }
        Update: {
          franja_promocional?: string | null
          id?: string
          logo?: string | null
          nombre?: string
          telefono?: string | null
          url_legislacion?: string | null
          url_politica_datos?: string | null
          url_terminos?: string | null
        }
        Relationships: []
      }
      page_documentos: {
        Row: {
          id: string
          nombre: string
          url_pdf: string
        }
        Insert: {
          id?: string
          nombre: string
          url_pdf: string
        }
        Update: {
          id?: string
          nombre?: string
          url_pdf?: string
        }
        Relationships: []
      }
      page_home: {
        Row: {
          admin_uid: string | null
          banners: Json[]
          id: string
        }
        Insert: {
          admin_uid?: string | null
          banners?: Json[]
          id?: string
        }
        Update: {
          admin_uid?: string | null
          banners?: Json[]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_home_admin_uid_fkey"
            columns: ["admin_uid"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          correo: string
          created_at: string | null
          datos_adicionales: Json
          deleted_at: string | null
          documento: string | null
          fecha_nacimiento: string | null
          id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_doc"] | null
          ubicacion: string | null
          updated_at: string | null
        }
        Insert: {
          correo: string
          created_at?: string | null
          datos_adicionales?: Json
          deleted_at?: string | null
          documento?: string | null
          fecha_nacimiento?: string | null
          id: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_doc"] | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Update: {
          correo?: string
          created_at?: string | null
          datos_adicionales?: Json
          deleted_at?: string | null
          documento?: string | null
          fecha_nacimiento?: string | null
          id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_doc"] | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      producto_variantes: {
        Row: {
          cantidad_minima_venta: number | null
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          fecha_llegada: string | null
          gramos_disponibles: number | null
          id: string
          nombre: string
          opciones_venta: number[] | null
          precio: number
          precio_minimo_venta: number | null
          producto_id: string | null
          status: Database["public"]["Enums"]["estado_producto"]
          stock: number
          updated_at: string | null
          urls_imagenes: string[] | null
        }
        Insert: {
          cantidad_minima_venta?: number | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          fecha_llegada?: string | null
          gramos_disponibles?: number | null
          id?: string
          nombre: string
          opciones_venta?: number[] | null
          precio?: number
          precio_minimo_venta?: number | null
          producto_id?: string | null
          status?: Database["public"]["Enums"]["estado_producto"]
          stock?: number
          updated_at?: string | null
          urls_imagenes?: string[] | null
        }
        Update: {
          cantidad_minima_venta?: number | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          fecha_llegada?: string | null
          gramos_disponibles?: number | null
          id?: string
          nombre?: string
          opciones_venta?: number[] | null
          precio?: number
          precio_minimo_venta?: number | null
          producto_id?: string | null
          status?: Database["public"]["Enums"]["estado_producto"]
          stock?: number
          updated_at?: string | null
          urls_imagenes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "producto_variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          categoria_id: string | null
          costo: number
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          precio: number
          sku: string
          status: Database["public"]["Enums"]["estado_producto"]
          stock_total: number
          tags: string[] | null
          updated_at: string | null
          urls_imagenes: string[] | null
        }
        Insert: {
          categoria_id?: string | null
          costo?: number
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          precio?: number
          sku: string
          status?: Database["public"]["Enums"]["estado_producto"]
          stock_total?: number
          tags?: string[] | null
          updated_at?: string | null
          urls_imagenes?: string[] | null
        }
        Update: {
          categoria_id?: string | null
          costo?: number
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          precio?: number
          sku?: string
          status?: Database["public"]["Enums"]["estado_producto"]
          stock_total?: number
          tags?: string[] | null
          updated_at?: string | null
          urls_imagenes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
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
        }
        Insert: {
          id?: string
          nombre: string
        }
        Update: {
          id?: string
          nombre?: string
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
    }
    Enums: {
      estado_orden:
        | "pendiente"
        | "pagado"
        | "en_proceso"
        | "enviado"
        | "entregado"
        | "cancelado"
      estado_producto: "activo" | "inactivo"
      rol_usuario: "admin" | "customer" | "agente" | "medico" | "anonymous"
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
      ],
      estado_producto: ["activo", "inactivo"],
      rol_usuario: ["admin", "customer", "agente", "medico", "anonymous"],
      tipo_doc: ["CC", "CE", "NIT", "Pasaporte"],
    },
  },
} as const

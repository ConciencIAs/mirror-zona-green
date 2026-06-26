import { Injectable, inject } from '@angular/core';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service'
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';

@Injectable({
  providedIn: 'root'
})
export class ContentDbService {
  private supabase = inject(SupabaseDbService);

  async getContentById(id: string) {
    return await this.supabase.from(TableName.DYNAMIC_CONTENT)
      .select('*')
      .eq('id', id)
      .maybeSingle();
  }

  async createContent(content: { name: string; slug: string; project_data: any, html_content: string, css_content: string }) {
    return await this.supabase
      .from(TableName.DYNAMIC_CONTENT)
      .insert([content])
      .select()
      .single();
  }

  // Guardar/Actualizar una landing existente
  async updateContent(id: string, payload: { html_content: string; css_content: string; project_data: any }) {
    return await this.supabase
      .from(TableName.DYNAMIC_CONTENT)
      .update({
        html_content: payload.html_content,
        css_content: payload.css_content,
        project_data: payload.project_data,
        updated_at: new Date()
      })
      .eq('id', id)
      .select('id')
      .maybeSingle();
  }

  // 🗑️ Eliminar un contenido dinámico por id
  async deleteContent(id: string) {
    return await this.supabase
      .from(TableName.DYNAMIC_CONTENT)
      .delete()
      .eq('id', id);
  }

  // 🌐 Para el renderizador público por slug
  async getContentBySlug(slug: string) {
    return await this.supabase
      .from(TableName.DYNAMIC_CONTENT)
      .select('html_content, css_content')
      .eq('slug', slug)
      .maybeSingle();
  }

  async getContentHome() {
    return await this.supabase
      .from(TableName.DYNAMIC_CONTENT)
      .select('html_content, css_content')
      .eq('slug', 'home')
      .maybeSingle();
  }

  // 🛠️ Para el Editor (Admin): Carga por id para editar una página específica
  async getContentParaEditor(id: string) {
    return await this.supabase
      .from(TableName.DYNAMIC_CONTENT)
      .select('id, name, slug, project_data')
      .eq('id', id)
      .maybeSingle();
  }

  async getListContent() {
    return await this.supabase.from(TableName.DYNAMIC_CONTENT)
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false })
  }
}
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { ToastService } from '@src/app/core/services/ui/toast.service';

type Tag = {
  id?: string;
  nombre: string;
};

type Categoria = {
  id?: string;
  nombre: string;
  deleted_at?: string | null;
};

@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tags.html',
})
export class Tags implements OnInit {
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);

  tags = signal<Tag[]>([]);
  categories = signal<Categoria[]>([]);

  newTagName = signal('');
  newCategoryName = signal('');

  editingTagId = signal<string | null>(null);
  editingCategoryId = signal<string | null>(null);

  editingTagName = signal('');
  editingCategoryName = signal('');

  isLoading = signal(false);
  activeTab = signal<'tags' | 'categories'>('tags');

  ngOnInit() {
    this.loadTags();
    this.loadCategories();
  }

  // ========== TAGS ==========
  async loadTags() {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.dbService.select(TableName.TAGS);
      if (error) throw error;
      this.tags.set(data as any as Tag[] || []);
    } catch (err) {
      this.toastService.error('Error al cargar tags', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async addTag() {
    const nombre = this.newTagName().trim();
    if (!nombre) {
      this.toastService.error('El nombre del tag no puede estar vacío', 'error');
      return;
    }

    this.isLoading.set(true);
    try {
      const { error } = await this.dbService.insert(TableName.TAGS, { nombre });
      if (error) throw error;

      this.toastService.success('Tag creado exitosamente', 'success');
      this.newTagName.set('');
      await this.loadTags();
    } catch (err) {
      this.toastService.error('Error al crear tag', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  startEditTag(tag: Tag) {
    this.editingTagId.set(tag.id || null);
    this.editingTagName.set(tag.nombre);
  }

  cancelEditTag() {
    this.editingTagId.set(null);
    this.editingTagName.set('');
  }

  async updateTag(tag: Tag) {
    const nombre = this.editingTagName().trim();
    if (!nombre) {
      this.toastService.error('El nombre del tag no puede estar vacío', 'error');
      return;
    }

    this.isLoading.set(true);
    try {
      const { error } = await this.dbService.update(
        TableName.TAGS,
        { nombre },
        { id: tag.id }
      );
      if (error) throw error;

      this.toastService.success('Tag actualizado exitosamente', 'success');
      this.editingTagId.set(null);
      await this.loadTags();
    } catch (err) {
      this.toastService.error('Error al actualizar tag', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteTag(tag: Tag) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el tag "${tag.nombre}"?`)) {
      return;
    }

    this.isLoading.set(true);
    try {
      const { error } = await this.dbService.delete(
        TableName.TAGS,
        { id: tag.id }
      );
      if (error) throw error;

      this.toastService.success('Tag eliminado exitosamente', 'success');
      await this.loadTags();
    } catch (err) {
      this.toastService.error('Error al eliminar tag', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ========== CATEGORIAS ==========
  async loadCategories() {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.dbService.select(TableName.CATEGORIAS);
      if (error) throw error;
      this.categories.set(data as any as Categoria[] || []);
    } catch (err) {
      this.toastService.error('Error al cargar categorías', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async addCategory() {
    const nombre = this.newCategoryName().trim();
    if (!nombre) {
      this.toastService.error('El nombre de la categoría no puede estar vacío', 'error');
      return;
    }

    this.isLoading.set(true);
    try {
      const { error } = await this.dbService.insert(TableName.CATEGORIAS, { nombre });
      if (error) throw error;

      this.toastService.success('Categoría creada exitosamente', 'success');
      this.newCategoryName.set('');
      await this.loadCategories();
    } catch (err) {
      this.toastService.error('Error al crear categoría', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  startEditCategory(category: Categoria) {
    this.editingCategoryId.set(category.id || null);
    this.editingCategoryName.set(category.nombre);
  }

  cancelEditCategory() {
    this.editingCategoryId.set(null);
    this.editingCategoryName.set('');
  }

  async updateCategory(category: Categoria) {
    const nombre = this.editingCategoryName().trim();
    if (!nombre) {
      this.toastService.error('El nombre de la categoría no puede estar vacío', 'warn');
      return;
    }

    this.isLoading.set(true);
    try {
      const { error } = await this.dbService.update(
        TableName.CATEGORIAS,
        { nombre },
        { id: category.id }
      );
      if (error) throw error;

      this.toastService.success('Categoría actualizada exitosamente', 'success');
      this.editingCategoryId.set(null);
      await this.loadCategories();
    } catch (err) {
      this.toastService.error('Error al actualizar categoría', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteCategory(category: Categoria) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la categoría "${category.nombre}"?`)) {
      return;
    }

    this.isLoading.set(true);
    try {
      const { error } = await this.dbService.delete(
        TableName.CATEGORIAS,
        { id: category.id }
      );
      if (error) throw error;

      this.toastService.success('Categoría eliminada exitosamente', 'success');
      await this.loadCategories();
    } catch (err) {
      this.toastService.error('Error al eliminar categoría', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}

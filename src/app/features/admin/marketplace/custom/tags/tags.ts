import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { Tag } from '@src/app/shared/models/interfaces/db/db';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [FormsModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './tags.html',
})
export class Tags implements OnInit {
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);

  tags = signal<Tag[]>([]);

  newTagName = signal('');

  editingTagId = signal<string | null>(null);

  editingTagName = signal('');

  isLoading = signal(false);

  ngOnInit() {
    this.loadTags();
  }

  // ========== TAGS ==========
  async loadTags() {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.dbService.select(TableName.TAGS);
      if (error) throw error;
      this.tags.set((data as unknown as Tag[]) || []);
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
      const { error } = await this.dbService.update(TableName.TAGS, { nombre }, { id: tag.id });
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
      const { error } = await this.dbService.delete(TableName.TAGS, { id: tag.id });
      if (error) throw error;

      this.toastService.success('Tag eliminado exitosamente', 'success');
      await this.loadTags();
    } catch (err) {
      this.toastService.error('Error al eliminar tag', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

}

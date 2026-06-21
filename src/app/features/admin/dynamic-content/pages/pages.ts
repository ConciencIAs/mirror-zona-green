import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ConfirmationService } from 'primeng/api';

import { ContentDbService } from '@src/app/core/services/supabase/dynamic-content/content-db-page.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

export interface ContentListItem {
  id: string;
  name: string;
  slug: string;
  created_at: string | null;
}

@Component({
  selector: 'app-dynamic-content-list',
  imports: [TableModule, ButtonModule, ConfirmDialogModule, TagModule, DatePipe],
  providers: [ConfirmationService],
  templateUrl: './pages.html',
  styles: ``
})
export class DynamicContentList implements OnInit {
  private contentDbService = inject(ContentDbService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private confirmationService = inject(ConfirmationService);

  pages = signal<ContentListItem[]>([]);
  loading = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadPages();
  }

  async loadPages(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.contentDbService.getListContent();
      if (data) {
        this.pages.set(data as ContentListItem[]);
      }
      if (error) {
        this.toastService.error('Error al cargar las páginas');
      }
    } finally {
      this.loading.set(false);
    }
  }

  navigateToNew(): void {
    this.router.navigate(['/admin/dynamic-content/new']);
  }

  navigateToEditor(id: string): void {
    this.router.navigate(['/admin/dynamic-content/editor', id]);
  }

  confirmDelete(page: ContentListItem): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas eliminar la página <strong>"${page.name}"</strong>? Esta acción no se puede deshacer.`,
      header: 'Eliminar página',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deletePage(page.id),
    });
  }

  async deletePage(id: string): Promise<void> {
    try {
      const { error } = await this.contentDbService.deleteContent(id);
      if (error) {
        this.toastService.error('Error al eliminar la página');
        return;
      }
      this.toastService.success('Página eliminada correctamente');
      this.pages.update(pages => pages.filter(p => p.id !== id));
    } catch {
      this.toastService.error('Error inesperado al eliminar');
    }
  }
}

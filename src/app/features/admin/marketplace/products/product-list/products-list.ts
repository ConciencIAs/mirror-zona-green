import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/core/models/constans/db/tableName.enum';
import { Categoria, Producto } from '@src/app/core/models/interfaces/db/db';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './products-list.html',
  styles: ``,
})
export class ProductsList {
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly products = signal<Producto[]>([]);
  readonly categories = signal<Categoria[]>([]);

  constructor() {
    this.loadInitialData();
  }

  private async loadInitialData() {
    this.loading.set(true);

    const [productsRes, categoriesRes] = await Promise.all([
      this.dbService.select(TableName.PRODUCTOS),
      this.dbService.select(TableName.CATEGORIAS),
    ]);

    if (productsRes.error) {
      console.error('Error al cargar productos', productsRes.error);
      this.toastService.error('No se pudo cargar la lista de productos.');
      this.products.set([]);
    } else {
      this.products.set((productsRes.data as unknown as Producto[]) ?? []);
    }

    if (categoriesRes.error) {
      console.error('Error al cargar categorías', categoriesRes.error);
      this.toastService.error('No se pudo cargar las categorías.');
      this.categories.set([]);
    } else {
      this.categories.set((categoriesRes.data as unknown as Categoria[]) ?? []);
    }

    this.loading.set(false);
  }

  getCategoryName(categoryId: string | null) {
    return this.categories().find((category) => category.id === categoryId)?.nombre ?? '-';
  }

  openCreateForm() {
    this.router.navigate(['new'], { relativeTo: this.route });
  }

  editProduct(product: Producto) {
    this.router.navigate([product.id], { relativeTo: this.route });
  }
}

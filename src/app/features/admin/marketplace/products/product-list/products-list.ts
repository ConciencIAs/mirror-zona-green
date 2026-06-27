import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ConfirmationModalService } from '@src/app/core/services/ui/confirmation.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Producto } from '@src/app/shared/models/interfaces/db/db';

import { ButtonModule, ButtonSeverity } from 'primeng/button';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './products-list.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProductsList {
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmService = inject(ConfirmationModalService);

  readonly loading = signal(true);
  readonly products = signal<Producto[]>([]);

  constructor() {
    this.loadInitialData();
  }

  private async loadInitialData() {
    this.loading.set(true);

    const [productsRes] = await Promise.all([
      this.dbService.select(TableName.PRODUCTOS),
    ]);

    if (productsRes.error) {
      console.error('Error al cargar productos', productsRes.error);
      this.toastService.error('No se pudo cargar la lista de productos.');
      this.products.set([]);
    } else {
      this.products.set((productsRes.data as unknown as Producto[]) ?? []);
    }

    this.loading.set(false);
  }

  openCreateForm() {
    this.router.navigate(['new'], { relativeTo: this.route });
  }

  editProduct(product: Producto) {
    this.router.navigate([product.id], { relativeTo: this.route });
  }

  confirmProductDelete(product: Producto) {
    this.confirmService.confirm({
      message: `¿Estas seguro de eliminar el producto ${product.nombre}?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.deleteProduct(product);
      },
    });
  }

  private async deleteProduct(product: Producto) {
    const { error } = await this.dbService.delete(TableName.PRODUCTOS, { id: product.id });

    if (error) {
      console.error('Error al eliminar producto', error);
      this.toastService.error('No se pudo eliminar el producto.');
    } else {
      this.toastService.success('Producto eliminado correctamente');
      this.loadInitialData();
    }
  }

  getProductSeverity(status: string): ButtonSeverity {
    switch (status) {
      case 'activo':
        return 'success';
      case 'inactivo':
        return 'danger';
      default:
        return 'secondary';
    }
  }
}

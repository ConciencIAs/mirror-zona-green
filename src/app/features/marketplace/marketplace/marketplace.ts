import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ProductCard } from '@src/app/features/marketplace/product-card/product-card';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/core/models/constans/db/tableName.enum';
import { Categoria, Producto } from '@src/app/core/models/interfaces/db/db';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [RouterModule, ProductCard],
  templateUrl: './marketplace.html',
  styles: ``,
})
export class Marketplace {
  private readonly dbService = inject(SupabaseDbService);
  private readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);

  protected readonly products = signal<Producto[]>([]);
  protected readonly categories = signal<Categoria[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('');
  protected readonly selectedTags = signal<string[]>([]);

  protected readonly filteredProducts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const categoryId = this.selectedCategory();
    const selectedTags = this.selectedTags();

    return this.products().filter((product) => {
      if (product.status !== 'activo') {
        return false;
      }
      if (categoryId && product.categoria_id !== categoryId) {
        return false;
      }

      const matchesTerm =
        !term ||
        product.nombre.toLowerCase().includes(term) ||
        product.descripcion?.toLowerCase().includes(term) ||
        (product.tags?.some((tag) => tag.toLowerCase().includes(term)) ?? false);

      if (!matchesTerm) {
        return false;
      }

      if (selectedTags.length === 0) {
        return true;
      }

      const productTags = product.tags?.map((tag) => tag.toLowerCase()) ?? [];
      return selectedTags.every((tag) => productTags.includes(tag.toLowerCase()));
    });
  });

  protected readonly availableTags = computed(() => {
    const tags = new Set<string>();
    for (const product of this.products()) {
      product.tags?.forEach((tag) => tags.add(tag));
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  });

  protected ngOnInit(): void {
    void this.loadMarketplace();
  }

  protected async loadMarketplace(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [productsResult, categoriesResult] = await Promise.all([
        this.dbService
          .from(TableName.PRODUCTOS)
          .select('*')
          .order('created_at', { ascending: false }),
        this.dbService
          .from(TableName.CATEGORIAS)
          .select('*')
          .order('nombre', { ascending: true }),
      ]);

      if (productsResult.error) {
        throw productsResult.error;
      }
      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      this.products.set((productsResult.data as Producto[]) || []);
      this.categories.set((categoriesResult.data as Categoria[]) || []);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudieron cargar los productos. Intenta de nuevo más tarde.');
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleTag(tag: string): void {
    const selected = this.selectedTags();
    if (selected.includes(tag)) {
      this.selectedTags.set(selected.filter((item) => item !== tag));
    } else {
      this.selectedTags.set([...selected, tag]);
    }
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set('');
    this.selectedTags.set([]);
  }

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) {
      this.searchTerm.set(target.value);
    }
  }

  protected onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (target) {
      this.selectedCategory.set(target.value);
    }
  }

  protected addProductToCart(product: Producto): void {
    // Si el producto tiene variantes, redirigir a detalles
    if (product.has_product_variantes) {
      void this.router.navigate(['/marketplace/product-details', product.id]);
      return;
    }

    // Si es un producto simple, agregar al carrito
    this.cartStore.addItem({
      producto_id: product.id,
      variante_id: null,
      es_gramos: false,
      usuario_id: '',
      cantidad: 1,
    });
  }
}


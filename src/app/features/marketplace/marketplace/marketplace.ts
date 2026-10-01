import { Component, computed, inject, signal, effect, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProductCard } from '@src/app/shared/components/marketplace/product-card/product-card';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Producto, Tag } from '@src/app/shared/models/interfaces/db/db';

import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [RouterModule, ProductCard, ButtonModule],
  templateUrl: './marketplace.html',
  changeDetection: ChangeDetectionStrategy.Eager, // Optimizado para Signals
})
export class Marketplace implements OnDestroy {
  private readonly dbService = inject(SupabaseDbService);
  private scroller = inject(ViewportScroller);

  // Estados de datos primarios (Vienen de la BD)
  protected readonly products = signal<Producto[]>([]);
  protected readonly tags = signal<Tag[]>([]);

  // Estados de UI y Control
  protected readonly loading = signal(true);
  private readonly tagsLoaded = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal('');

  // Filtros activos
  protected readonly searchTerm = signal('');
  protected readonly selectedTags = signal<string[]>([]);

  // Paginación
  protected readonly currentPage = signal(0);
  protected readonly totalCount = signal(0);
  protected readonly hasMore = signal(false);
  private readonly pageSize = 9; // Cantidad de elementos por página
  private matchingProducts: Producto[] = [];

  // Stream intermedio para aplicar Debounce en la escritura del usuario
  private readonly searchSubject = new Subject<string>();

  // Mapeamos los tags para mantener la compatibilidad con el formato string del HTML
  protected readonly availableTags = computed(() => {
    return [...this.tags()]
      .sort(
        (a, b) =>
          (a.orden ?? Number.MAX_SAFE_INTEGER) - (b.orden ?? Number.MAX_SAFE_INTEGER) ||
          a.nombre.localeCompare(b.nombre),
      )
      .map(tag => tag.nombre);
  });

  constructor() {
    // 1. Configuración del Debounce: Espera 350ms antes de actualizar el término de búsqueda
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed() // Desuscripción automática en Angular moderna
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(0); // Reinicia a la primera página al buscar texto
    });

    // 2. Efecto reactivo: Escucha cambios en filtros o páginas y dispara la petición automáticamente
    effect(() => {
      const term = this.searchTerm();
      const selectedTags = this.selectedTags();
      const page = this.currentPage();
      if (!this.tagsLoaded()) return;

      this.loadProductsFromDB(term, selectedTags, page);
    }, { allowSignalWrites: true });
  }

  protected ngOnInit(): void {
    // Cargamos los filtros maestros (Categorías y Etiquetas) solo una vez al iniciar
    void this.loadMasterFilters();
  }

  /**
   * Carga inicial de categorías y tags disponibles en la plataforma
   */
  private async loadMasterFilters(): Promise<void> {
    try {
      const [tagsResult] = await Promise.all([
        this.dbService.from(TableName.TAGS).select('*').order('orden', { ascending: true })
      ]);

      if (tagsResult.data) {
        this.tags.set(
          [...(tagsResult.data as Tag[])].sort(
            (a, b) =>
              (a.orden ?? Number.MAX_SAFE_INTEGER) - (b.orden ?? Number.MAX_SAFE_INTEGER) ||
              a.nombre.localeCompare(b.nombre),
          ),
        );
      }
    } catch (err) {
      console.error('Error cargando filtros del ecosistema:', err);
    } finally {
      this.tagsLoaded.set(true);
    }
  }

  /**
   * Método neurálgico: Construye y ejecuta la query de Supabase según el estado de los filtros
   */
  private async loadProductsFromDB(term: string, selectedTags: string[], page: number): Promise<void> {
    if (page === 0) {
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    this.error.set('');

    try {
      if (page > 0) {
        const visibleCount = (page + 1) * this.pageSize;
        this.products.set(this.matchingProducts.slice(0, visibleCount));
        this.hasMore.set(visibleCount < this.matchingProducts.length);
        return;
      }

      // Se ordena el conjunto filtrado antes de paginar para respetar Tag.orden.
      let query = this.dbService
        .from(TableName.PRODUCTOS)
        .select('*', { count: 'exact' })
        .eq('status', 'activo')
        .order('created_at', { ascending: false });

      // Filtro 1: Búsqueda de texto en múltiples campos (Nombre o Descripción)
      if (term.trim()) {
        query = query.or(`nombre.ilike.%${term}%,descripcion.ilike.%${term}%`);
      }

      // Filtro 2: Coincidencia en array de etiquetas (Deben contener todos los seleccionados)
      if (selectedTags.length > 0) {
        query = query.contains('tags', selectedTags);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const incomingProducts = (data as Producto[]) || [];
      this.totalCount.set(count || 0);

      const tagOrder = new Map(this.tags().map(tag => [tag.nombre, tag.orden]));
      const getProductOrder = (product: Producto) =>
        (product.tags ?? []).reduce(
          (order, tag) => Math.min(order, tagOrder.get(tag) ?? Number.MAX_SAFE_INTEGER),
          Number.MAX_SAFE_INTEGER,
        );

      this.matchingProducts = incomingProducts.sort((a, b) => {
        const tagOrderDifference = getProductOrder(a) - getProductOrder(b);
        if (tagOrderDifference !== 0) return tagOrderDifference;

        const dateDifference = Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '');
        return (Number.isNaN(dateDifference) ? 0 : dateDifference) || a.nombre.localeCompare(b.nombre);
      });
      this.products.set(this.matchingProducts.slice(0, this.pageSize));

      this.hasMore.set(this.matchingProducts.length > this.pageSize);

    } catch (err) {
      console.error(err);
      this.error.set('Ocurrió un inconveniente al actualizar el catálogo de productos.');
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  goToTop() {
    this.scroller.scrollToPosition([0, 0]);
  }

  // --- CAPTURA DE EVENTOS DE LA UI ---

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchSubject.next(target.value);
    }
  }

  protected toggleTag(tag: string): void {
    this.currentPage.set(0); // Reset a pág 0
    this.selectedTags.update(selected =>
      selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]
    );
  }

  protected loadMore(): void {
    if (!this.loadingMore() && this.hasMore()) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected clearFilters(): void {
    this.selectedTags.set([]);
    this.currentPage.set(0);
    // Para limpiar el input visualmente, enviamos vacío al subject
    this.searchSubject.next('');
    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }
}
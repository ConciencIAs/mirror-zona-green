import { Component, computed, inject, signal, effect, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
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

  // Estados de datos primarios (Vienen de la BD)
  protected readonly products = signal<Producto[]>([]);
  protected readonly tags = signal<Tag[]>([]);

  // Estados de UI y Control
  protected readonly loading = signal(true);
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

  // Stream intermedio para aplicar Debounce en la escritura del usuario
  private readonly searchSubject = new Subject<string>();

  // Mapeamos los tags para mantener la compatibilidad con el formato string del HTML
  protected readonly availableTags = computed(() => {
    return this.tags()
      .map(t => t.nombre)
      .sort((a, b) => a.localeCompare(b));
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
        this.dbService.from(TableName.TAGS).select('*').order('nombre', { ascending: true })
      ]);

      if (tagsResult.data) this.tags.set(tagsResult.data as Tag[]);
    } catch (err) {
      console.error('Error cargando filtros del ecosistema:', err);
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
      const from = page * this.pageSize;
      const to = from + this.pageSize - 1;

      // query base con conteo exacto
      let query = this.dbService
        .from(TableName.PRODUCTOS)
        .select('*', { count: 'exact' })
        .eq('status', 'activo')
        .range(from, to)
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

      // Si es la página 0 reemplazamos el catálogo; si es subsecuente, concatenamos (Cargar más)
      this.products.update(current => page === 0 ? incomingProducts : [...current, ...incomingProducts]);

      // Evaluamos si existen más registros pendientes en el servidor
      this.hasMore.set(incomingProducts.length === this.pageSize);

    } catch (err) {
      console.error(err);
      this.error.set('Ocurrió un inconveniente al actualizar el catálogo de productos.');
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
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
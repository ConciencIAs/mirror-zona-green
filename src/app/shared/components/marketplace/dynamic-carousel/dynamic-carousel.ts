import { Component, ChangeDetectionStrategy, inject, input, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { Producto } from '@src/app/shared/models/interfaces/db/db';
import { ProductCard } from '@src/app/shared/components/marketplace/product-card/product-card';
import { CarouselModule } from 'primeng/carousel';

@Component({
  selector: 'app-dynamic-carousel',
  standalone: true,
  imports: [CommonModule, ProductCard, CarouselModule],
  template: `
    <div class="w-full">
      @if (loading()) {
        <div style="padding:20px; text-align:center; width:100%; color:#55644d;">Cargando productos...</div>
      } @else if (products().length === 0) {
        <div style="padding:20px; text-align:center; width:100%; color:#8a997a;">No se encontraron productos.</div>
      } @else {
        <p-carousel 
          [value]="products()" 
          [numVisible]="3" 
          [numScroll]="1" 
          [circular]="false" 
          [responsiveOptions]="responsiveOptions"
          [showIndicators]="true"
          [showNavigators]="true">
          <ng-template let-item pTemplate="item">
            <div class="p-2 sm:p-4 h-full flex justify-center">
               <app-product-card [product]="item" class="w-full max-w-[400px]"></app-product-card>
            </div>
          </ng-template>
        </p-carousel>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Default,
  styles: `
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; scroll-behavior: smooth; }
  `
})
export class DynamicCarouselComponent implements OnInit, OnChanges {
  // Inputs from Custom Element attributes
  filterBy = input<string>('recent', { alias: 'filter-by' });
  filterValue = input<string>('', { alias: 'filter-value' });

  products = signal<Producto[]>([]);
  loading = signal<boolean>(true);

  responsiveOptions = [
    { breakpoint: '1199px', numVisible: 3, numScroll: 1 },
    { breakpoint: '991px', numVisible: 2, numScroll: 1 },
    { breakpoint: '767px', numVisible: 1, numScroll: 1 }
  ];

  private readonly supabaseDbService = inject(SupabaseDbService);

  ngOnInit() {
    this.loadProducts();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['filterBy'] || changes['filterValue']) {
      this.loadProducts();
    }
  }

  async loadProducts() {
    this.loading.set(true);
    try {
      let query = this.supabaseDbService.from(this.supabaseDbService.tableNames.PRODUCTOS).select('*');
      
      const by = this.filterBy();
      const val = this.filterValue();

      if (by === 'recent') {
        query = query.order('created_at', { ascending: false }).limit(10);
      } else if (by === 'sku' && val) {
        const skus = val.split(',').map(s => s.trim()).filter(Boolean);
        if (skus.length > 0) {
          query = query.in('sku', skus);
        } else {
          // If sku filter but no skus provided, return empty
          this.products.set([]);
          this.loading.set(false);
          return;
        }
      } else {
         query = query.order('created_at', { ascending: false }).limit(10);
      }

      const { data, error } = await query;
      if (!error && data) {
        this.products.set(data as Producto[]);
        
        // Hack para forzar que los carruseles anidados (en ProductCard) recalculen su ancho
        [50, 200, 600].forEach(t => {
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, t);
        });
      } else {
        this.products.set([]);
      }
    } catch (e) {
      console.error('Error loading products for carousel', e);
      this.products.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

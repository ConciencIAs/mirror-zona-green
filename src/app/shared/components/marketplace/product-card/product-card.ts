import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Producto, Tag } from '@src/app/shared/models/interfaces/db/db';
import { CartButtonComponent } from '@src/app/shared/components/marketplace/button-card/button-card';
import { CarouselModule } from 'primeng/carousel';
import { ImageModule } from 'primeng/image';
import { getSaleUnitLabel } from '@src/app/shared/utils/helpers';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CartButtonComponent, CarouselModule, ImageModule],
  templateUrl: './product-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host ::ng-deep .p-carousel .p-carousel-item {
      flex: 1 0 100% !important;
      width: 100% !important;
    }
  `,
})
export class ProductCard {
  product = input.required<Producto>();
  tagOrder = input<Tag[]>([]);

  private router = inject(Router);

  readonly stars = [1, 2, 3, 4, 5] as const;
  readonly saleUnitLabel = getSaleUnitLabel;
  readonly displayedTags = computed(() => {
    const tagOrder = new Map(this.tagOrder().map(tag => [tag.nombre, tag.orden]));
    return [...(this.product().tags ?? [])]
      .sort(
        (a, b) =>
          (tagOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (tagOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 3);
  });

  /** Promedio de rating redondeado a 1 decimal */
  readonly ratingAvg = computed(() => this.product().rating_average ?? 0);

  /** Cantidad de reseñas */
  readonly ratingCount = computed(() => this.product().rating_count ?? 0);

  /** Hay al menos una reseña */
  readonly hasRating = computed(() => this.ratingCount() > 0);

  /** Oferta de envío incluido en el valor del producto */
  readonly hasFreeShipping = computed(() =>
    (this.product().ofertas ?? []).some((offer) => offer.name === 'Envío incluido en el valor'),
  );

  /** Devuelve si la estrella de posición `star` debe rellenarse (llena, media, vacía) */
  starFill(star: number): 'full' | 'half' | 'empty' {
    const avg = this.ratingAvg();
    if (avg >= star) return 'full';
    if (avg >= star - 0.5) return 'half';
    return 'empty';
  }

  goToProductDetails(): void {
    void this.router.navigate(['/seleccion/product-details', this.product().id]);
  }
}

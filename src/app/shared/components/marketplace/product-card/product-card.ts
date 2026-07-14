import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Producto } from '@src/app/shared/models/interfaces/db/db';
import { CartButtonComponent } from '@src/app/shared/components/marketplace/button-card/button-card';
import { CarouselModule } from 'primeng/carousel';
import { ImageModule } from 'primeng/image';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CartButtonComponent, CarouselModule, ImageModule],
  templateUrl: './product-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ``,
})
export class ProductCard {
  product = input.required<Producto>();

  private router = inject(Router);

  readonly stars = [1, 2, 3, 4, 5] as const;

  /** Promedio de rating redondeado a 1 decimal */
  readonly ratingAvg = computed(() => this.product().rating_average ?? 0);

  /** Cantidad de reseñas */
  readonly ratingCount = computed(() => this.product().rating_count ?? 0);

  /** Hay al menos una reseña */
  readonly hasRating = computed(() => this.ratingCount() > 0);

  /** Devuelve si la estrella de posición `star` debe rellenarse (llena, media, vacía) */
  starFill(star: number): 'full' | 'half' | 'empty' {
    const avg = this.ratingAvg();
    if (avg >= star) return 'full';
    if (avg >= star - 0.5) return 'half';
    return 'empty';
  }

  goToProductDetails(): void {
    if (this.product().es_por_gramos) {
      void this.router.navigate(['/marketplace/product-details', this.product().id]);
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProductCard {
  product = input.required<Producto>();

  private router = inject(Router);

  goToProductDetails(): void {
    if (this.product().es_por_gramos) {
      void this.router.navigate(['/marketplace/product-details', this.product().id]);
    }
  }
}

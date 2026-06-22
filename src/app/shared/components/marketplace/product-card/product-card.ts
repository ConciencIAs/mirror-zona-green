import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Producto } from '@src/app/shared/models/interfaces/db/db';
import { CartButtonComponent } from '@src/app/shared/components/marketplace/button-card/button-card';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CartButtonComponent],
  templateUrl: './product-card.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProductCard {
  product = input.required<Producto>();

  private router = inject(Router);

  get imageUrl(): string {
    return this.product()?.urls_imagenes?.[0] || '/assets/images/placeholder.svg';
  }

  goToProductDetails(): void {
    if (this.product().has_product_variantes) {
      void this.router.navigate(['/marketplace/product-details', this.product().id]);
    }
  }
}

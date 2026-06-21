import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Producto } from '@src/app/shared/models/interfaces/db/db';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProductCard {
  @Input() product!: Producto;
  @Output() addToCart = new EventEmitter<Producto>();

  get imageUrl(): string {
    return this.product?.urls_imagenes?.[0] || '/assets/images/placeholder.png';
  }

  onAddToCart(): void {
    this.addToCart.emit(this.product);
  }
}

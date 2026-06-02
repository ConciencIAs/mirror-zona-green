import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Producto } from '@src/app/core/models/interfaces/db/db';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.html',
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

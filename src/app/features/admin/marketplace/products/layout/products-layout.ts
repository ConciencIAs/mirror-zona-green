import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-products-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './products-layout.html',
  styles: ``,
})
export class ProductsLayout {}

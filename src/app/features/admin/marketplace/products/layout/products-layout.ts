import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-products-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './products-layout.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProductsLayout { }

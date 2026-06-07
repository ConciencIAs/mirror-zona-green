import { Routes } from "@angular/router";
import { authGuard } from '@src/app/core/guards/auth-guard';

export const marketplaceRoutes: Routes = [
  {
    path: 'marketplace',
    canActivateChild: [authGuard],
    canActivate: [authGuard],
    data: { zone: 'marketplace' },
    children: [
      {
        path: '',
        loadComponent: () => import('./marketplace/marketplace').then(m => m.Marketplace),
        pathMatch: 'full',
        title: 'Marketplace',
        data: { zone: 'marketplace' }
      },
      {
        path: 'carrito',
        loadComponent: () => import('./carrito/carrito').then(m => m.CarritoComponent),
        title: 'Carrito',
        data: { zone: 'marketplace' }
      },
      {
        path: 'ordenes',
        loadComponent: () => import('./ordenes/ordenes').then(m => m.Ordenes),
        title: 'Ordenes',
        data: { zone: 'marketplace' }
      },
      {
        path: 'checkout',
        loadComponent: () => import('./checkout/checkout').then(m => m.Checkout),
        title: 'Checkout',
        data: { zone: 'marketplace' }
      },
      {
        path: 'product-details',
        loadComponent: () => import('./product-details/product-details').then(m => m.ProductDetails),
        title: 'Detalles del producto',
        data: { zone: 'marketplace' }
      },
      {
        path: 'product-details/:id',
        loadComponent: () => import('./product-details/product-details').then(m => m.ProductDetails),
        title: 'Detalles del producto',
        data: { zone: 'marketplace' }
      },
    ]
  },
]
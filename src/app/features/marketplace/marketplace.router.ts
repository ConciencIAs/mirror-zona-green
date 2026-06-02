import { Routes } from "@angular/router";
import { authGuard } from '@src/app/core/guards/auth-guard';

export const marketplaceRoutes: Routes = [
  {
    path: 'marketplace',
    canActivateChild: [authGuard],
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./marketplace/marketplace').then(m => m.Marketplace),
        pathMatch: 'full',
        title: 'Marketplace'
      },
      {
        path: 'carrito',
        loadComponent: () => import('./carrito/carrito').then(m => m.CarritoComponent),
        title: 'Carrito'
      },
      {
        path: 'ordenes',
        loadComponent: () => import('./ordenes/ordenes').then(m => m.Ordenes),
        title: 'Ordenes'
      },
      {
        path: 'checkout',
        loadComponent: () => import('./checkout/checkout').then(m => m.Checkout),
        title: 'Checkout'
      },
      {
        path: 'product-details',
        loadComponent: () => import('./product-details/product-details').then(m => m.ProductDetails),
        title: 'Detalles del producto'
      },
      {
        path: 'product-details/:id',
        loadComponent: () => import('./product-details/product-details').then(m => m.ProductDetails),
        title: 'Detalles del producto'
      },
    ]
  },
]
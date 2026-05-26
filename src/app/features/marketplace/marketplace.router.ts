import { Routes } from "@angular/router";

export const marketplaceRoutes: Routes = [
  {
    path: 'marketplace',
    children: [
      {
        path: '',
        loadComponent: () => import('./marketplace/marketplace').then(m => m.Marketplace),
        pathMatch: 'full',
        title: 'Marketplace'
      },
      {
        path: 'carrito',
        loadComponent: () => import('./carrito/carrito').then(m => m.Carrito),
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
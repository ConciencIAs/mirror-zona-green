import { Routes } from "@angular/router";
import { authGuard } from '@src/app/core/guards/auth-guard';
import { roleGuard } from '@src/app/core/guards/role-guard';

export const adminRoutes: Routes = [
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    canActivateChild: [roleGuard, authGuard],
    data: { zone: 'admin' },
    children: [
      {
        path: '',
        loadComponent: () => import('./customer/customer').then(m => m.Customer),
        pathMatch: 'full',
        data: { zone: 'admin' },
        title: 'Customer'
      },
      {
        path: 'customer',
        loadComponent: () => import('./customer/customer').then(m => m.Customer),
        data: { zone: 'admin' },
        title: 'Customer'
      },
      {
        path: 'marketplace',
        title: 'Marketplace',
        data: { zone: 'admin' },
        children: [
          {
            path: '',
            loadComponent: () => import('./marketplace/history/history').then(m => m.History),
            data: { zone: 'admin' },
            pathMatch: 'full',
            title: 'History'
          },
          {
            path: 'history',
            loadComponent: () => import('./marketplace/history/history').then(m => m.History),
            data: { zone: 'admin' },
            title: 'History'
          },
          {
            path: 'products',
            loadComponent: () => import('./marketplace/products/layout/products-layout').then(m => m.ProductsLayout),
            data: { zone: 'admin' },
            children: [
              {
                path: '',
                pathMatch: 'full',
                loadComponent: () => import('./marketplace/products/product-list/products-list').then(m => m.ProductsList),
                data: { zone: 'admin' },
                title: 'Productos'
              },
              {
                path: 'new',
                loadComponent: () => import('./marketplace/products/product-edit/products-editor').then(m => m.ProductsEditor),
                data: { zone: 'admin' },
                title: 'Nuevo producto'
              },
              {
                path: ':id',
                loadComponent: () => import('./marketplace/products/product-edit/products-editor').then(m => m.ProductsEditor),
                data: { zone: 'admin' },
                title: 'Editar producto'
              }
            ]
          },
          {
            path: 'custom',
            loadComponent: () => import('./marketplace/custom/custom-search/custom-search').then(m => m.CustomSearch),
            data: { zone: 'admin' },
            title: 'Custom Search'
          },
          {
            path: 'orders',
            loadComponent: () => import('./marketplace/ordenes/ordenes').then(m => m.Ordenes),
            data: { zone: 'admin' },
            title: 'Ordenes'
          }
        ]
      },
      {
        path: 'dynamic-content',
        data: { zone: 'admin' },
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./dynamic-content/home/home').then(m => m.Home),
            data: { zone: 'admin' },
            title: 'Dynamic Content'
          },
          {
            path: 'home',
            loadComponent: () => import('./dynamic-content/home/home').then(m => m.Home),
            data: { zone: 'admin' },
            title: 'Dynamic Content'
          },
          {
            path: 'app-config',
            title: 'App Config',
            data: { zone: 'admin' },
            loadComponent: () => import('./dynamic-content/config-app/config-app').then(m => m.ConfigApp)
          }
        ]
      }
    ]
  }
]
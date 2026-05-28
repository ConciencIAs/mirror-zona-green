import { Routes } from "@angular/router";
import { authGuard } from '@src/app/core/guards/auth-guard';
import { roleGuard } from '@src/app/core/guards/role-guard';

export const adminRoutes: Routes = [
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    canActivateChild: [roleGuard, authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./customer/customer').then(m => m.Customer),
        pathMatch: 'full',
        title: 'Customer'
      },
      {
        path: 'customer',
        loadComponent: () => import('./customer/customer').then(m => m.Customer),
        title: 'Customer'
      },
      {
        path: 'marketplace',
        title: 'Marketplace',
        children: [
          {
            path: '',
            loadComponent: () => import('./marketplace/history/history').then(m => m.History),
            pathMatch: 'full',
            title: 'History'
          },
          {
            path: 'history',
            loadComponent: () => import('./marketplace/history/history').then(m => m.History),
            title: 'History'
          },
          {
            path: 'products',
            loadComponent: () => import('./marketplace/products/products').then(m => m.Products),
            title: 'Products'
          },
          {
            path: 'custom',
            loadComponent: () => import('./marketplace/custom/custom-search/custom-search').then(m => m.CustomSearch),
            title: 'Custom Search'
          },
          {
            path: 'orders',
            loadComponent: () => import('./marketplace/ordenes/ordenes').then(m => m.Ordenes),
            title: 'Ordenes'
          }
        ]
      },
      {
        path: 'dynamic-content',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./dynamic-content/home/home').then(m => m.Home),
            title: 'Dynamic Content'
          },
          {
            path: 'home',
            loadComponent: () => import('./dynamic-content/home/home').then(m => m.Home),
            title: 'Dynamic Content'
          },
          {
            path: 'app-config',
            title: 'App Config',
            loadComponent: () => import('./dynamic-content/config-app/config-app').then(m => m.ConfigApp)
          }
        ]
      }
    ]
  }
]
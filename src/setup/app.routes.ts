import { Routes } from '@angular/router';
import { routerAuthCustomer } from '@src/app/features/customer/auth/auth.router';
import { marketplaceRoutes } from '@src/app/features/marketplace/marketplace.router';
import { MainLayout } from '@src/app/shared/layout/main-layout/main-layout';
import { adminRoutes } from '@src/app/features/admin/admin.route';
import { roleGuard } from '@src/app/core/guards/role-guard';
import { authGuard } from '@src/app/core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        title: 'home',
        loadComponent: () => import('@src/app/features/home/home').then((m) => m.CustomerHome),
      },
      {
        path: 'customer/home',
        title: 'Customer Home',
        loadComponent: () => import('@src/app/features/home/home').then((m) => m.CustomerHome),
      },
      {
        path: 'customer/perfil',
        title: 'Perfil',
        loadComponent: () => import('@src/app/features/customer/account/account').then((m) => m.Account),
        canActivate: [authGuard],
        data: { zone: 'customer' }
      },
      {
        path: 'customer/orders',
        title: 'Ordenes',
        loadComponent: () => import('@src/app/features/marketplace/ordenes/ordenes').then((m) => m.Ordenes),
        canActivate: [authGuard],
        data: { zone: 'customer' }
      },
      {
        path: 'content/:slug',
        title: 'Contenido Dinámico',
        loadComponent: () => import('@src/app/features/home/dynamic-page/dynamic-page').then((m) => m.DynamicPage),
      },
      ...routerAuthCustomer,
      ...marketplaceRoutes,
      ...adminRoutes,
    ]
  },
];

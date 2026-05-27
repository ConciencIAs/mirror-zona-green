import { Routes } from '@angular/router';
import { routerAuthCustomer } from '@src/app/features/customer/auth/auth.router';
import { marketplaceRoutes } from '@src/app/features/marketplace/marketplace.router';
import { MainLayout } from '@src/app/shared/layout/main-layout/main-layout';
import { adminRoutes } from '@src/app/features/admin/admin.route';
import { roleGuard } from '@src/app/core/guards/role-guard';

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
        loadComponent: () => import('@src/app/features/home/home').then((m) => m.Home),
        canActivate: [roleGuard],
      },
      ...routerAuthCustomer,
      ...marketplaceRoutes,
      ...adminRoutes,
    ]
  },
];

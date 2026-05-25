import { Routes } from '@angular/router';
import { routerAuthCustomer } from '@src/app/features/customer/auth/auth.router';
import { MainLayout } from '@src/app/shared/layout/main-layout/main-layout';

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
      },
      ...routerAuthCustomer,
    ]
  },
];

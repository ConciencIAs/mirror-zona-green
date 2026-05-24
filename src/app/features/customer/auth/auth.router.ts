import { Routes } from '@angular/router';

export const routerAuthCustomer: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    children: [
      {
        path: '',
        title: 'login',
        pathMatch: 'full',
        loadComponent: () => import('./login/login').then((m) => m.Login),
      },
      {
        path: 'login',
        title: 'login',
        loadComponent: () => import('./login/login').then((m) => m.Login),
      },
      {
        path: 'register',
        title: 'register',
        loadComponent: () => import('./register/register').then((m) => m.Register),
      },
      {
        path: 'magik-link-callback',
        title: 'magik-link-callback',
        loadComponent: () => import('./magik-link-callback/magik-link-callback').then((m) => m.MagikLinkCallback),
      },
    ],
  },
];

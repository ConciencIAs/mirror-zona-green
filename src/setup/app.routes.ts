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
      {
        path: 'customer/home',
        title: 'Customer Home',
        loadComponent: () => import('@src/app/features/customer/home/home').then((m) => m.CustomerHome),
      },
      {
        path: 'cannabismedicinalencolombia',
        title: 'Cannabis medicinal en Colombia',
        loadComponent: () => import('@src/app/features/cannabis-medicinal/cannabis-medicinal').then((m) => m.CannabisMedicinal),
      },
      {
        path: 'medicoscannabiscolombia',
        title: 'Médicos especialistas en cannabis medicinal',
        loadComponent: () => import('@src/app/features/medicos-cannabis/medicos-cannabis').then((m) => m.MedicosCannabis),
      },
      {
        path: 'rrd',
        title: 'Reducción de Riesgos y Daños',
        loadComponent: () => import('@src/app/features/rrd/rrd').then((m) => m.Rrd),
      },
      {
        path: 'faq',
        title: 'Preguntas frecuentes',
        loadComponent: () => import('@src/app/features/faq/faq').then((m) => m.Faq),
      },
      {
        path: 'terminos-y-condiciones',
        title: 'Términos y condiciones',
        loadComponent: () => import('@src/app/features/terminos/terminos').then((m) => m.Terminos),
      },
      ...routerAuthCustomer,
      ...marketplaceRoutes,
      ...adminRoutes,
    ]
  },
];

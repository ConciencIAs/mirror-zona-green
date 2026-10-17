import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { zonasPermitidas } from './zonas-permitidas';

export const roleGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const userStore = inject(UserStore);

  const zone = route.routeConfig?.data?.['zone'] as string || '';
  const perfil = userStore.perfil();
  const zonas = zonasPermitidas(perfil.rol, userStore.isAuthenticated());

  if (perfil.status !== 'activo') {
    return router.parseUrl('/home');
  }

  if ((await zonas).includes(zone)) {
    // Pantallas solo de administrador dentro de la zona admin (Métricas de
    // ventas, Referidos): el colaborador vuelve a Gestión de usuarios.
    if (route.routeConfig?.data?.['soloAdmin'] && perfil.rol !== 'admin') {
      return router.parseUrl('/admin');
    }
    return true;
  }

  return router.parseUrl('/home');
};

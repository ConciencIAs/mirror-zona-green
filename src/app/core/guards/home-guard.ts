import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { zonasPermitidas } from './zonas-permitidas';

export const homeGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const userStore = inject(UserStore);
  const profile = userStore.perfil();
  const zonas = zonasPermitidas(profile.rol, userStore.isAuthenticated());

  // Solo se redirige a /seleccion si el rol puede entrar ahí; si no, roleGuard
  // lo devolvería a /home y se formaría un bucle.
  if (userStore.isAuthenticated() && profile.status === 'activo' && (await zonas).includes('marketplace')) {
    return router.parseUrl('/seleccion');
  }

  return true;
};

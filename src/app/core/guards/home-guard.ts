import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';

export const homeGuard: CanActivateFn = () => {
  const router = inject(Router);
  const userStore = inject(UserStore);
  const profile = userStore.perfil();

  if (userStore.isAuthenticated() && profile.status === 'activo') {
    return router.parseUrl('/seleccion');
  }

  return true;
};
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserStore } from '@src/app/core/state/customer/customer.state';

export const authGuard: CanActivateFn = (route, state) => {

  const router = inject(Router);
  const userStore = inject(UserStore);

  if (!userStore.isAuthenticated()) {
    return router.parseUrl('/auth/login');
  }

  return true;
};

import { CanActivateFn, Router } from '@angular/router';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';
import { inject } from '@angular/core';
import { roleEnum } from '@src/app/shared/models/constans/customer/roleEnum';
import { UserStore } from '@src/app/core/state/customer/customer.state';

export const authGuard: CanActivateFn = (route, state) => {

  const router = inject(Router);
  const userStore = inject(UserStore);

  if (userStore.perfil().rol === roleEnum.ANONYMOUS) {
    return router.parseUrl('/auth/login');
  }

  return true;
};

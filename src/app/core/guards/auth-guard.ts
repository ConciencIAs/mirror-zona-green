import { CanActivateFn, Router } from '@angular/router';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';
import { inject } from '@angular/core';
import { roleEnum } from '@src/app/core/models/constans/customer/roleEnum';


export const authGuard: CanActivateFn = (route, state) => {

  const localStorageStateService = inject(LocalStorageStateService);
  const router = inject(Router);

  const userCustomer = localStorageStateService.getState('zg-customer', { rol: roleEnum.ANONYMOUS })

  if (userCustomer.rol === roleEnum.ANONYMOUS) {
    return router.parseUrl('/auth/login');
  }

  return true;
};

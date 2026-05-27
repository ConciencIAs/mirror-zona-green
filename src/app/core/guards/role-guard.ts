import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';
import { roleEnum } from '@src/app/core/models/constans/customer/roleEnum';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const localStorageStateService = inject(LocalStorageStateService);

  const userRole = localStorageStateService.getState('user_role', [{ nombre: roleEnum.ANONYMOUS, urls_permitidas: ['home'] }])
  const userCustomer = localStorageStateService.getState('zg-customer', { rol: roleEnum.ANONYMOUS })
  const currentPath = route.url[0].path
  const customerRole = userCustomer.rol

  if (!userRole.find((role) => role.nombre === customerRole)?.urls_permitidas.includes(currentPath)) {
    return router.parseUrl('/home');
  }

  return true;
};

import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { roleEnum } from '@src/app/shared/models/constans/customer/roleEnum';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const localStorageStateService = inject(LocalStorageStateService);
  const userStore = inject(UserStore);

  const userRole = localStorageStateService.getState('app_roles', [{ nombre: roleEnum.ANONYMOUS, urls_permitidas: ['home'] }])
  const zone = route.routeConfig?.data?.['zone'] as string || '';
  const customerRole = userStore.perfil().rol

  const findUserRole = userRole.find((role) => role.nombre === customerRole);

  if (userStore.perfil().status !== 'activo') {
    return router.parseUrl('/home');
  }

  if (findUserRole?.urls_permitidas.includes(zone)) {
    return true;
  }

  return router.parseUrl('/home');
};

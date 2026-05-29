import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { roleEnum } from '@src/app/core/models/constans/customer/roleEnum';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const localStorageStateService = inject(LocalStorageStateService);
  const userStore = inject(UserStore);

  const userRole = localStorageStateService.getState('user_role', [{ nombre: roleEnum.ANONYMOUS, urls_permitidas: ['home'] }])
  const currentPath = route.url[0].path
  const customerRole = userStore.perfil().rol

  if (!userRole.find((role) => role.nombre === customerRole)?.urls_permitidas.includes(currentPath)) {
    return router.parseUrl('/home');
  }

  return true;
};

import { inject } from '@angular/core';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { roleEnum } from '@src/app/shared/models/constans/customer/roleEnum';

interface RolApp {
  nombre: string;
  urls_permitidas: string[];
}

const CLAVE_ROLES = 'app_roles';

/**
 * Zonas permitidas para un rol, según la tabla `roles` (copiada en
 * localStorage['app_roles']).
 *
 * La tabla solo la pueden leer usuarios autenticados: si la app arrancó sin
 * sesión, la copia local quedó vacía. Antes, al iniciar sesión, roleGuard no
 * encontraba el rol, mandaba a /home, homeGuard devolvía a /seleccion y el
 * navegador se congelaba en ese bucle. Aquí, si el rol no está en la copia
 * local y hay sesión, se vuelve a leer la tabla.
 *
 * Debe llamarse de forma síncrona desde un guard (usa inject antes del await).
 */
export function zonasPermitidas(rol: string | null | undefined, autenticado: boolean): Promise<string[]> {
  const storage = inject(LocalStorageStateService);
  const db = inject(SupabaseDbService);

  const buscar = (roles: RolApp[]) => roles.find((r) => r.nombre === rol)?.urls_permitidas ?? [];

  const locales = storage.getState<RolApp[]>(CLAVE_ROLES, [
    { nombre: roleEnum.ANONYMOUS, urls_permitidas: ['home'] },
  ]);
  const zonas = buscar(locales);
  if (zonas.length || !rol || !autenticado) return Promise.resolve(zonas);

  return (async () => {
    const { data, error } = await db.select(TableName.ROLES);
    const roles = (data as unknown as RolApp[] | null) ?? [];
    if (error || !roles.length) return [];
    storage.setState(CLAVE_ROLES, roles);
    return buscar(roles);
  })();
}

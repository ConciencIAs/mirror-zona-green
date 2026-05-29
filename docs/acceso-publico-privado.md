# Zona Green — Control de acceso: contenido público vs. privado

**Fecha:** 2026-05-29  
**Destinatario:** Ingeniero backend  
**Contexto:** Este documento describe cómo el frontend diferencia contenido público de contenido privado, qué está operativo hoy y dónde se necesita coordinación con el backend.

---

## 1. Arquitectura general

El control de acceso opera en **dos capas independientes**:

| Capa | Tecnología | Estado |
|---|---|---|
| **UI layer** — mostrar/ocultar elementos | Angular Signals (`isAuthenticated`) | ✅ Funciona |
| **Route layer** — bloquear rutas completas | Angular Guards (`authGuard`, `roleGuard`) | ⚠️ Parcial |

---

## 2. Rutas públicas (sin guard)

Estas rutas son accesibles sin sesión. Cualquier visitante puede entrar:

| Ruta | Componente |
|---|---|
| `/customer/home` | Página de inicio principal |
| `/cannabismedicinalencolombia` | Cannabis medicinal en Colombia |
| `/medicoscannabiscolombia` | Médicos especialistas |
| `/rrd` | Reducción de riesgos y daños |
| `/faq` | Preguntas frecuentes |
| `/terminos-y-condiciones` | Términos y condiciones |
| `/auth/login` | Inicio de sesión |
| `/auth/register` | Registro |
| `/auth/magik-link-callback` | Callback del magic link |

---

## 3. Rutas privadas (con guard)

Solo deben ser accesibles para usuarios autenticados con rol `customer` o superior:

| Ruta | Guards aplicados |
|---|---|
| `/marketplace` | `authGuard` + `roleGuard` |
| `/marketplace/carrito` | `authGuard` + `roleGuard` |
| `/marketplace/ordenes` | `authGuard` + `roleGuard` |
| `/marketplace/checkout` | `authGuard` + `roleGuard` |
| `/marketplace/product-details` | `authGuard` + `roleGuard` |

Las rutas de admin tienen su propio router (`adminRoutes`) — no se documentan aquí.

---

## 4. Flujo de autenticación implementado

El login usa **magic link** (Supabase OTP):

```
Usuario ingresa email
  → Login verifica en tabla USUARIOS_PUBLICOS que el correo exista
  → Supabase envía email con magic link
  → Usuario hace clic → redirigido a /auth/magik-link-callback
  → Supabase resuelve el token y dispara onAuthStateChange (SIGNED_IN)
  → Si hay datos de onboarding pendientes: se guardan en PERFILES y USUARIOS_PUBLICOS
  → Redirige a /home
```

Al mismo tiempo, en `app.ts` hay un listener global:

```typescript
// app.ts — ngOnInit
this.supabaseAuthService.onAuthStateChange();
this.supabaseAuthService.currentUserEvent.subscribe((event) => {
  this.LocalStorageStateService.setState('zg-customer', event.session);
});
```

Esto almacena la **sesión completa de Supabase** en `localStorage['zg-customer']` cada vez que el estado de auth cambia.

---

## 5. Capa UI — cómo funciona `isAuthenticated`

`SupabaseAuthService` expone:

```typescript
session = signal<{ event, session }>(...);
isAuthenticated = computed(() => !!this.session()?.session?.user);
```

Este signal se actualiza en tiempo real. El navbar y el sidebar lo usan para:
- Mostrar botón "Regístrate o Ingresa" → solo si **no** autenticado
- Mostrar el menú de perfil (`app-profile-menu`) → solo si **autenticado**
- Mostrar el enlace a Marketplace en el sidebar → solo si **autenticado**

**Esta capa funciona correctamente.**

---

## 6. Capa de guards — estado actual y gaps

### `authGuard` — ✅ Funciona (con advertencia)

```typescript
// auth-guard.ts
const userCustomer = localStorageStateService.getState('zg-customer', { rol: roleEnum.ANONYMOUS })
if (userCustomer.rol === roleEnum.ANONYMOUS) {
  return router.parseUrl('/auth/login');
}
```

**Cómo pasa en la práctica:**
- Usuario **no autenticado**: `zg-customer` no está en localStorage → el servicio retorna el default `{ rol: 'anonymous' }` → redirige a login. ✓
- Usuario **autenticado**: `zg-customer` contiene el objeto `Session` de Supabase. Ese objeto tiene `access_token`, `user`, etc., **pero no tiene campo `rol`**. Entonces `session.rol === undefined !== 'anonymous'` → el guard pasa. ✓

> ⚠️ **Advertencia:** El guard funciona, pero no porque lee un rol explícito — funciona porque el objeto Session de Supabase no tiene un campo `rol`, haciendo que la condición falle para usuarios autenticados. Si en algún momento se almacena otro objeto en `zg-customer` que tenga `rol: 'anonymous'`, el guard lo bloquearía incorrectamente. Se recomienda refactorizar para verificar `session?.user` directamente.

---

### `roleGuard` — ⚠️ Incompleto / actualmente bloqueando usuarios autenticados

```typescript
// role-guard.ts
const userRole = localStorageStateService.getState('user_role', [
  { nombre: roleEnum.ANONYMOUS, urls_permitidas: ['home'] }
])
const userCustomer = localStorageStateService.getState('zg-customer', { rol: roleEnum.ANONYMOUS })
const customerRole = userCustomer.rol  // → undefined para usuarios autenticados

if (!userRole.find((role) => role.nombre === customerRole)?.urls_permitidas.includes(currentPath)) {
  return router.parseUrl('/home');
}
```

**El problema:** La clave `user_role` **no se escribe en ninguna parte del código actual**. El único lugar donde se cargan roles es `app.ts`:

```typescript
// app.ts — getRoles()
this.supabaseDbService.from('ROLES').select('*')
  .then(data => this.LocalStorageStateService.setState('app_roles', data));
```

Eso escribe `app_roles`, no `user_role`. Por lo tanto:

- `user_role` siempre llega al guard como `[{ nombre: 'anonymous', urls_permitidas: ['home'] }]`
- `customerRole` para usuarios autenticados es `undefined` (el Session de Supabase no tiene `rol`)
- `find()` no encuentra ninguna entrada con `nombre === undefined`
- El guard redirige a `/home` **para todos los usuarios**, incluyendo los autenticados

**Resultado actual:** El marketplace está bloqueado para todos. Los usuarios no autenticados son enviados a `/auth/login` (por `authGuard`). Los usuarios autenticados son enviados a `/home` (por `roleGuard`).

---

## 7. Lo que el backend debe proveer (o coordinar)

Para que el control de acceso basado en roles funcione correctamente en el frontend, se necesita uno de estos dos enfoques:

### Opción A — Endpoint/función que retorna el rol del usuario autenticado

Después de `SIGNED_IN`, el frontend necesita consultar el rol del usuario actual y almacenarlo en `user_role` con el formato que espera el guard:

```typescript
// Formato esperado por roleGuard
[
  {
    nombre: 'customer',           // debe coincidir con roleEnum
    urls_permitidas: ['marketplace', 'carrito', 'ordenes', 'checkout', 'product-details']
  }
]
```

Ya existe una función RPC en los tipos de Supabase:
```typescript
// supabase-types.ts
Functions: {
  auth_user_role: {
    Args: never
    Returns: Database["public"]["Enums"]["rol_usuario"]
  }
}
```

El frontend puede llamar a `supabase.rpc('auth_user_role')` en el flujo post-login y escribir el resultado en `localStorage['user_role']`.

### Opción B — Refactorizar el `roleGuard` para usar el signal de sesión

Simplificar el guard para que use directamente `SupabaseAuthService.isAuthenticated` en vez de localStorage. Esto elimina la dependencia de `user_role` y hace el sistema más coherente. El control de acceso fino por rol quedaría en el backend vía Row Level Security (RLS) de Supabase.

---

## 8. Roles definidos en el frontend

```typescript
// roleEnum.ts
export enum roleEnum {
  ANONYMOUS = 'anonymous',
  CUSTOMER  = 'customer',
  ADMIN     = 'admin',
  SUPERADMIN = 'agente',
}
```

El backend debe asegurarse de que el enum `rol_usuario` en Supabase use los mismos valores string.

---

## 9. Claves de localStorage en uso

| Clave | Quién escribe | Contenido | Quién lee |
|---|---|---|---|
| `zg-customer` | `app.ts` (onAuthStateChange) | Objeto `Session` de Supabase (o null) | `authGuard`, `roleGuard` |
| `user_role` | ⚠️ Nadie actualmente | Arreglo de roles con URLs | `roleGuard` |
| `app_roles` | `app.ts` (getRoles) | Todos los roles de la tabla ROLES | Sin consumidor conocido |
| `zg_current_session` | `magik-link-callback` | Objeto `Session` de Supabase | Sin consumidor conocido |
| `zg_pending_onboarding` | Flujo de registro | `CustomerData` parcial | `magik-link-callback` |
| `zg-dark` | Navbar (dark toggle) | `'true'` / `'false'` | Navbar |

---

## 10. Resumen ejecutivo

| Qué | Estado |
|---|---|
| Navbar reacciona a login/logout | ✅ Funciona |
| Rutas públicas accesibles sin sesión | ✅ Funciona |
| `authGuard` bloquea marketplace a anónimos | ✅ Funciona |
| `roleGuard` permite marketplace a autenticados | ❌ No funciona — `user_role` nunca se escribe |
| Row Level Security en Supabase | ✓ Responsabilidad del backend (no verificado desde frontend) |
| Roles de usuario disponibles en frontend post-login | ❌ Pendiente — `auth_user_role` RPC existe en tipos pero no se invoca |

# Pruebas contra Supabase LOCAL

Todo lo de esta carpeta corre contra el Supabase local (Docker). Los scripts
se niegan a correr si la API no es `127.0.0.1`/`localhost`. Nunca contra producción.

## Preparar

```bash
npx supabase start
# esquema público de producción (sin datos) + auth/storage + datos sintéticos
docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < supabase/pruebas/00_esquema_publico_produccion_2026-10-15.sql
docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < supabase/pruebas/01_local_auth_storage_datos_sinteticos.sql
# migraciones a probar
docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/<archivo>.sql
docker exec supabase_db_Cheyn_Verde psql -U postgres -c "NOTIFY pgrst, 'reload schema'"
```

## Edge Functions con correo local (Mailpit, http://127.0.0.1:54324)

Archivo de entorno fuera del repo, por ejemplo `functions.local.env`:

```
GMAIL_USER=pruebas@cheyn.test
GMAIL_APP_PASSWORD=local-no-usado
SMTP_HOST=<IP del contenedor supabase_inbucket_Cheyn_Verde>
SMTP_PORT=1025
SMTP_SECURE=false
APP_URLS=http://localhost:4202
```

La IP se obtiene con
`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' supabase_inbucket_Cheyn_Verde`
(el runtime de Deno no resuelve el nombre del contenedor desde nodemailer).

```bash
npx supabase functions serve --env-file functions.local.env
```

## App apuntando al Supabase local

```bash
node supabase/pruebas/generar-environment-local.mjs   # crea src/environments/environment.local.ts (ignorado por git)
npx ng serve --configuration local --port 4202
```

## Scripts

| Script | Qué prueba |
|---|---|
| `flujo-registro-login.mjs` | registro → correo de confirmación → login, por API |
| `funciones-correo.mjs` | `send-registration-email` y `send-account-activation`: permisos, envío único, ruta decidida en la base, enlaces permitidos |
| `e2e-login.mjs [carpeta]` | login en el navegador (Playwright): correo sin cuenta, sin confirmar, clave equivocada, cuenta sin fila en `usuarios_publicos`, activación reflejada al recargar, cuenta bloqueada. Con `carpeta` guarda capturas claro/oscuro, desktop/móvil. Puerto con `PUERTO=` |
| `e2e-bucle-roles.mjs [puerto]` | usuario activo que entra desde un navegador sin sesión (antes se congelaba la pestaña) y recarga de páginas protegidas con sesión abierta |
| `e2e-fase2.mjs [carpeta]` | ver/ocultar contraseña, errores de validación, primer correo → login, reenviar confirmación, cambiar contraseña en Mi perfil, orden de usuarios, métricas sin canceladas, enlace de métricas en el menú. Requiere la migración `20261016120000_fase2_menu_metricas.sql` aplicada en la base local |

| `e2e-fase2c.mjs [carpeta]` | un celular por persona: registro con celular inválido, repetido (en otro formato), extranjero y con guiones; Mi perfil (aviso, cambio a un celular ajeno o libre); fecha de nacimiento sin desfase (Bogotá y Tokio); etiquetas del panel admin. Requiere las tres migraciones de la 2c aplicadas en la base local |

| `referidos.mjs` | trazabilidad de referidos por API: resolución del código (mayúsculas/espacios), árbol de 3 niveles, código inexistente o de perfil inactivo, historial de códigos, permisos (usuario normal vs. admin), asignación manual, ciclos, alerta de más de 20 en 24 h |
| `e2e-fase2b.mjs [carpeta]` | panel de usuarios (referente por relación, "No resuelto"), página Árbol de referidos (árbol, ranking, no resueltos con asignación), conteo en Mi cuenta, enlace del menú. Requiere las migraciones `20261016140000` y `20261016140100` |

Aplicar las migraciones locales siempre con bash (`docker exec -i … psql … < archivo.sql`). Desde
PowerShell, `Get-Content | docker exec` cambia la codificación y las tildes (nombres de políticas,
mensajes, "Administración") quedan dañadas.

Desde la Fase 2c la base no admite dos perfiles con el mismo celular: las
pruebas usan `celularUnico()` de `_comun.mjs` para cada cuenta nueva.

En la base local, la plantilla `supabase/templates/confirmacion.html` se usa como correo "Confirm signup" (ver `config.toml`); hay que reiniciar con `npx supabase stop && npx supabase start` después de cambiarla.

Las cuentas que crean usan el dominio `@cheyn.test` y solo existen en la base local.

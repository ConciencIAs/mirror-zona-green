# 🤖 AI Assistant Guidelines & Architecture Rules

Este documento contiene las reglas arquitectónicas y convenciones de código para este proyecto Angular.
**Instrucción para la IA:** Lee y aplica estrictamente estas reglas antes de sugerir, refactorizar o generar nuevo código.

## 🛠️ Stack Tecnológico
*   **Framework:** Angular (Standalone Components por defecto).
*   **Estilos:** Tailwind CSS (Exclusivamente).
*   **Gestión de Estado:** Angular Signals (Prioridad sobre RxJS cuando sea posible).
*   **Detección de Cambios:** `ChangeDetectionStrategy.OnPush`.

## 📐 Arquitectura de Carpetas (Feature-Driven)
El proyecto utiliza una arquitectura modular basada en dominios bajo el directorio `src/app/`. Debes respetar esta jerarquía:

*   📂 **`core/`**:
    *   **Propósito:** Singleton global de la aplicación.
    *   **Contiene:** Interceptores HTTP, Guards, Servicios globales (AuthService, ThemeService), Modelos base y el Layout principal.
    *   **Regla:** Solo debe importarse en el punto de entrada de la app (`app.config.ts` o `app.component.ts`). NUNCA lo importes dentro de `shared/` o `features/`.
*   📂 **`shared/`**:
    *   **Propósito:** Componentes UI reutilizables y "tontos" (Dumb Components).
    *   **Contiene:** Botones, Modales, Tarjetas, Pipes, Directivas, Funciones de utilidad pura.
    *   **Regla:** No debe contener lógica de negocio ni inyectar servicios de `core/` o `features/`. Todo se maneja vía `@Input()` y `@Output()`.
*   📂 **`features/`**:
    *   **Propósito:** Lógica de negocio y vistas específicas por dominio (ej. `auth/`, `dashboard/`).
    *   **Contiene:** Páginas (Smart Components), componentes locales, servicios específicos del dominio.
    *   **Regla:** Un Feature A no debe importar cosas de un Feature B directamente.

## 🎨 Convenciones de Estilo (No-CSS)
1.  **Cero Archivos CSS Locales:** El proyecto utiliza Tailwind CSS para todo el diseño.
2.  **Comandos CLI:** Cuando la IA deba sugerir comandos de generación, DEBE incluir la bandera `--inline-style` para evitar la creación de archivos `.css`/`.scss`.
    *   *Ejemplo correcto:* `ng generate component shared/components/button --inline-style`
3.  **Encapsulamiento:** No utilices `ViewEncapsulation.None` a menos que sea estrictamente necesario.

## ⚡ Rendimiento y Reactividad
1.  **Control de Flujo:** Utiliza siempre la nueva sintaxis de control de flujo de Angular (`@if`, `@for`, `@defer`). No uses `*ngIf` ni `*ngFor`.
2.  **Lazy Loading:** Utiliza el bloque `@defer` en el HTML para cargar componentes pesados.
3.  **Señales (Signals):** Utiliza `signal()`, `computed()`, y `effect()` para manejar el estado local del componente en lugar de variables tradicionales.
4.  **RxJS:** Limita RxJS principalmente a las llamadas HTTP (HttpClient) o flujos de eventos asíncronos complejos. Usa `toSignal()` para conectar observables con la vista.
5.  **Memory Leaks:** Si usas Observables, utiliza el `AsyncPipe` en la vista o `takeUntilDestroyed()` en el controlador.

## 🔒 Variables de Entorno
1.  **Uso:** Importa SIEMPRE desde `src/environments/environment` (nunca desde `environment.development`).
2.  **Seguridad:** No expongas tokens, contraseñas o claves privadas en el código fuente.

## 📝 Reglas de Generación de Código para la IA
*   **Directo al grano:** Proporciona el código limpio, sin explicaciones redundantes a menos que se te pida.
*   **Tipado Estricto:** Usa TypeScript estricto. Evita usar `any`. Crea interfaces en los directorios `models/` correspondientes.
*   **Idioma:** Comenta el código en español y mantén el nombrado de variables descriptivo (en español o inglés, según el estándar del archivo actual).
*


ErrorHandler para manejar los errores de manera goblar mandar un mensaje toast al cliente


/zg
├── .angular/
├── .editorconfig
├── .git/
├── .gitignore
├── .postcssrc.json
├── .prettierrc
├── .vscode/
├── README.md
├── RCHITECTURE_AND_FEATURES.md
├── angular.json
├── package.json
├── package-lock.json
├── public/
│   └── vercel.json
├── rules.md
├── schema.db.md
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
└── src/
    ├── assets/
    │   ├── fonts/
    │   ├── i18n/
    │   ├── icons/
    │   └── images/
    ├── core/
    │   ├── guards/
    │   ├── interceptors/
    │   ├── models/
    │   └── services/
    │       ├── .gitkeep
    │       ├── confirmation.service.ts
    │       ├── local-storage-state.service.ts
    │       ├── toast.service.ts
    │       └── supabase/
    │           ├── supabase-auth.service.ts
    │           ├── supabase-client.service.ts
    │           ├── supabase-db.service.ts
    │           └── supabase-storage.service.ts
    ├── environments/
    │   ├── environment.ts
    │   └── environment.development.ts
    ├── features/
    │   └── auth/
    │       ├── components/
    │       ├── models/
    │       ├── pages/
    │       └── services/
    ├── setup/
    │   ├── app.config.ts
    │   ├── app.html
    │   ├── app.routes.ts
    │   └── app.ts
    ├── shared/
    │   ├── components/
    │   │   └── layout/
    │   ├── directives/
    │   ├── models/
    │   ├── pipes/
    │   └── utils/
    ├── index.html
    ├── main.ts
    └── styles.css
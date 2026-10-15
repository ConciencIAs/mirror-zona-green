# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cheyn Verde (package name `zg`, formerly "Zona Green"): Angular 22 + Supabase platform — public educational content about cannabis/intercultural health, a private marketplace ("Selección informada") with WhatsApp checkout, and an admin panel. UI copy and code comments are in Spanish.

## Commands

- `npm start` / `npx ng serve --port <port>` — dev server (default 4200).
- `npm run build` — production build to `dist/zg/browser`. Use it to confirm CSS survives minification when touching `src/styles.css`.
- There are no tests: no `*.spec.ts` files and no `test` target configured in `angular.json`.
- Prettier is configured (`.prettierrc`); there is no lint setup.
- Supabase CLI is not a dependency; run it with `npx supabase …`. The repo is linked to project ref `rvxxszdtocnhmdsrfkoi` (`supabase/config.toml`). Edge function source code is not in this repo. A schema dump and migrations live in `docs/supabse/`.

## Architecture

- **Entry point is `src/setup/`** (`app.ts`, `app.config.ts`, `app.routes.ts`, `theme.config.ts`), not `src/app/`. Path alias `@src/*` → `src/*`.
- **Zoneless** change detection (`provideZonelessChangeDetection`), standalone components, signals; `@ngrx/signals` stores in `src/app/core/state/` (`UserStore`, `CartStore`, `AppConfigStore`, `DarkModeState`).
- **Routing**: every route except `/lab` is a child of `MainLayout` (navbar + footer). Feature routers (`features/customer/auth/auth.router.ts`, `features/marketplace/marketplace.router.ts`, `features/admin/admin.route.ts`) are spread into it.
- **Auth/guards gotcha**: guards read `UserStore` (hydrated synchronously from `localStorage['user-profile']`), not the Supabase session directly. `app.ts` ignores the `INITIAL_SESSION` auth event, so a reload with a valid Supabase token does not refetch the profile — the profile must already be in localStorage. `roleGuard` also needs `localStorage['app_roles']` (the `roles` table, loaded in `app.ts`). All data access goes through `SupabaseDbService` with table names from `shared/models/constans/db/tableName.enum.ts`; server-side operations (order creation, transactional emails) go through `EdgeFunctionsService`.
- **Dynamic content (GrapesJS CMS)**: pages are built in the admin editor (`/admin/dynamic-content/editor/:id`) and stored in the `dynamic_components` table (`html_content`, `css_content`, `js_content`, `project_data`). They are rendered with `[innerHTML]` by `features/home/home.ts` (slug `home`) and `features/home/dynamic-page/` (`/content/:slug`). The stored CSS is wrapped in `@scope ([data-home-content])` / `@scope ([data-dynamic-page-content])`, the stored JS is injected after a 2s delay, and elements with `data-access="logged-in" | "anonymous"` are stripped per auth state. Edit content through the editor (or its GrapesJS API) so `project_data` stays in sync with `html_content`. `app.ts` registers Angular Elements (`el-product-card`, `el-dynamic-carousel`) that can be used inside that HTML. Page HTML carries a `data-cheyn-page="<slug>"` attribute that `styles.css` targets.
- **Two Tailwind engines**: build-time Tailwind v4 (`@import 'tailwindcss'` in `src/styles.css`, wrapped in `@layer`) for Angular templates, plus the runtime `@tailwindcss/browser` CDN script in `src/index.html` so classes inside dynamic content work. The runtime script scans the whole document and emits unlayered rules, which beat the layered build-time utilities. Variant/arbitrary utilities on static components (`dark:*`, `sm:/lg:` visibility or grid, `h-[..]`, `translate-*`, `scale-*`, `hidden`) can silently stop applying. Established fixes: literal CSS in the component's `styles` or `[style.*]` bindings for static components; scoped `!important` overrides in `src/styles.css` (keyed on `[data-cheyn-page]` or the compiled class name) for dynamic content. Do not add `<style type="text/tailwindcss">` to `index.html` — Angular's Vite pipeline tries to compile it and the dev server returns 500.
- **Dark mode**: `DarkModeState` toggles `.dark` and `.p-dark` on `<html>` and persists to `localStorage['zg-dark']`; PrimeNG uses `darkModeSelector: '.dark'`. PrimeNG tables/dialogs switch to their own dark theme, so text inside them needs explicit `dark:` colors.
- **Layout**: the navbar is `position: fixed` and its height varies (advertising banner, extra profile row under 400px). `MainLayout` measures the `<header>` with a `ResizeObserver` and applies it as `padding-top`; don't reintroduce fixed padding values.
- `features/lab` is a temporary visual playground route; `shared/components/ecosystem-diagram` is currently unused (the live ecosystem diagram is GrapesJS content).

## Conventions (from `docs/rules.md`)

- Tailwind for styling; no component CSS files (generate with `--inline-style`).
- New control flow only (`@if`, `@for` with `track`, `@defer`); signals over RxJS except for async streams.
- Import environment config from `src/environments/environment` (the dev file is swapped in via `fileReplacements`).
- Features should not import from other features; `shared/` holds reusable UI.

## Deployment / git

- `origin` is `ConcienciasPlayground/zona-green`. Pushes to `main` are force-mirrored by `.github/workflows/mirror.yml` to `ConciencIAs/mirror-zona-green` (the deployed site), so changes reach `main` through pull requests.
- Supabase Auth's Site URL points to the production mirror, so magic links redirect there even from localhost; password login works locally.

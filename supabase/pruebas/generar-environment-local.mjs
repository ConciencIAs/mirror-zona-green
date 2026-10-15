// Genera src/environments/environment.local.ts apuntando al Supabase LOCAL.
// Uso:  npx supabase start  &&  node supabase/pruebas/generar-environment-local.mjs
//       npx ng serve --configuration local --port 4202
// El archivo generado está en .gitignore. Nunca apunta a producción.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }));
const url = new URL(status.API_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
  throw new Error(`La API no es local (${url.hostname}). Se cancela.`);
}

writeFileSync(
  'src/environments/environment.local.ts',
  `// Generado para pruebas contra el Supabase LOCAL (npx supabase start).
// No se versiona. Se regenera con: node supabase/pruebas/generar-environment-local.mjs
export const environment = {
  production: false,
  urlHost: 'http://localhost:4202',
  supabase: {
    url: '${status.API_URL}',
    key: '${status.PUBLISHABLE_KEY}',
  },
};
`,
);
console.log('src/environments/environment.local.ts generado (Supabase local).');

/**
 * Генерує src/environments/environment.prod.ts з env vars Vercel.
 * Запускається автоматично перед ng build (через vercel.json installCommand або buildCommand).
 *
 * Потрібні Vercel Environment Variables:
 *   SUPABASE_URL       — Project URL (Settings → API)
 *   SUPABASE_ANON_KEY  — anon public key (Settings → API)
 */
import { writeFileSync, mkdirSync } from 'fs';

const url     = process.env.SUPABASE_URL      ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';

if (!url || !anonKey) {
  console.warn(
    '[generate-env] УВАГА: SUPABASE_URL або SUPABASE_ANON_KEY не задані. ' +
    'Supabase не буде працювати.'
  );
}

mkdirSync('src/environments', { recursive: true });

writeFileSync(
  'src/environments/environment.prod.ts',
  `// Авто-згенеровано з Vercel env vars. Не редагувати вручну.
export const environment = {
  production: true,
  supabase: {
    url: '${url}',
    anonKey: '${anonKey}',
  },
};
`
);

console.log('[generate-env] ✓ src/environments/environment.prod.ts згенеровано');

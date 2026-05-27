// Скопіюйте цей файл у environment.ts (для dev) та environment.prod.ts (для prod)
// і вставте ваші ключі зі Supabase → Settings → API
export const environment = {
  production: false, // true для environment.prod.ts
  supabase: {
    url: 'https://YOUR_PROJECT.supabase.co',
    anonKey: 'YOUR_ANON_PUBLIC_KEY',
  },
};

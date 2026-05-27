/**
 * Генерує favicon.png та всі PWA-іконки з SVG-шаблону камери.
 * Запуск: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';

// ── SVG-іконка: фотоапарат на фіолетово-рожевому градієнті ──────────────────
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6d28d9"/>
      <stop offset="1" stop-color="#db2777"/>
    </linearGradient>
    <linearGradient id="lens" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#4c1d95"/>
      <stop offset="1" stop-color="#831843"/>
    </linearGradient>
  </defs>

  <!-- Фон (повний квадрат, підходить для maskable) -->
  <rect width="512" height="512" fill="url(#bg)"/>

  <!-- Тіло камери -->
  <rect x="72" y="192" width="368" height="240" rx="36" fill="white" fill-opacity="0.95"/>

  <!-- Горб видошукача -->
  <path d="M164 192 L164 154 Q164 132 186 132 L232 132 L248 112 L264 112 L280 132 L326 132 Q348 132 348 154 L348 192 Z"
        fill="white" fill-opacity="0.95"/>

  <!-- Об'єктив — зовнішнє кільце -->
  <circle cx="256" cy="312" r="84" fill="url(#bg)"/>

  <!-- Об'єктив — середнє кільце (скло) -->
  <circle cx="256" cy="312" r="60" fill="url(#lens)"/>

  <!-- Об'єктив — відблиск -->
  <circle cx="234" cy="290" r="18" fill="white" fill-opacity="0.25"/>

  <!-- Об'єктив — центр (зіниця) -->
  <circle cx="256" cy="312" r="30" fill="white" fill-opacity="0.08"/>

  <!-- Спалах -->
  <rect x="348" y="220" width="40" height="40" rx="12" fill="url(#bg)"/>
  <rect x="354" y="226" width="28" height="28" rx="8" fill="white" fill-opacity="0.9"/>

  <!-- Кнопка затвора — маленька деталь -->
  <circle cx="136" cy="236" r="16" fill="url(#bg)" fill-opacity="0.6"/>
</svg>
`.trim();

const buf = Buffer.from(SVG);

// ── PWA іконки ───────────────────────────────────────────────────────────────
const PWA_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = 'public/icons';

mkdirSync(ICONS_DIR, { recursive: true });

for (const size of PWA_SIZES) {
  await sharp(buf)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`${ICONS_DIR}/icon-${size}x${size}.png`);
  console.log(`✓  ${ICONS_DIR}/icon-${size}x${size}.png`);
}

// ── favicon (32×32 і також великий 180×180 для apple-touch-icon) ─────────────
await sharp(buf).resize(32, 32).png().toFile('public/favicon-32.png');
console.log('✓  public/favicon-32.png');

await sharp(buf).resize(180, 180).png().toFile('public/favicon.png');
console.log('✓  public/favicon.png  (180×180, використовується як apple-touch-icon)');

await sharp(buf).resize(512, 512).png().toFile('public/icon.png');
console.log('✓  public/icon.png  (512×512, запасний)');

console.log('\n🎉 Усі іконки згенеровано!');
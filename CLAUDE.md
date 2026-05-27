# DragShot

Веб-застосунок на Angular для зйомки фото через веб-камеру з canvas-редактором: накладання емодзі, вільне виділення олівцем, перетягування та зміна розміру фрагментів, збереження в localStorage. PWA — встановлюється на телефон.

## Вимоги до інтерфейсу

- **Мова інтерфейсу — виключно українська.** Увесь текст у шаблонах (кнопки, підказки, повідомлення, заголовки, placeholder-и) має бути написаний українською мовою. Англійські рядки в UI неприпустимі.

## Технологічний стек

- **Angular 21** — standalone-компоненти, Signals API (`signal`, `computed`)
- **TypeScript 5.9**
- **HTML5 Canvas API** — рендеринг редактора, захоплення фрагментів, clip-path
- **MediaDevices API** — доступ до веб-камери (`getUserMedia`)
- **localStorage** — збереження фото між сесіями
- **@angular/service-worker** — PWA/офлайн-підтримка
- **Vitest** — тести
- **Vercel** — хостинг (https://dragshot.vercel.app)
- **GitHub** — репозиторій (https://github.com/fugix/dragShot)

## Команди

```bash
npm start          # dev-сервер на http://localhost:4200
npm run build      # production-збірка → dist/DragShot/browser
npm run watch      # збірка з watch-режимом (development)
npm test           # запуск тестів через Vitest
ng generate component src/app/<назва>/<назва>  # новий компонент
```

## Структура проєкту

```
src/
├── main.ts                          # точка входу
├── styles.css                       # глобальні стилі (CSS reset + Inter font)
├── index.html                       # favicon.png, manifest.webmanifest
└── app/
    ├── app.ts                       # кореневий компонент (машина станів: camera | editor | gallery)
    ├── app.html                     # шаблон оболонки з @switch по view()
    ├── app.css                      # стилі шапки та навігації; мобільне приховання .nav-icon
    ├── app.config.ts                # Angular DI-конфіг (provideServiceWorker)
    ├── app.routes.ts                # маршрути (порожні — навігація через Signals)
    ├── camera/
    │   └── camera.component.ts     # захоплення фото з веб-камери
    ├── editor/
    │   └── editor.component.ts     # canvas-редактор (емодзі + олівець + фрагменти)
    ├── gallery/
    │   └── gallery.component.ts    # галерея збережених фото
    └── services/
        └── storage.service.ts      # CRUD для localStorage (SavedPhoto[])

public/
├── favicon.png                      # іконка (dragshot-camera.png)
├── manifest.webmanifest             # PWA-маніфест (назва укр., тема #7c3aed)
├── icons/                           # PWA іконки 72..512px
└── ngsw-worker.js / ngsw-config.json  # Angular Service Worker

vercel.json                          # Vercel: outputDirectory, rewrites SPA, заголовки SW
```

## Архітектура

### Навігація між екранами

`App` управляє переходами через `view = signal<'camera' | 'editor' | 'gallery'>()`. Роутер не використовується.

```
camera  ──(photoCaptured)──►  editor  ──(back)──►  camera
                                │
                            (saved)──►  (залишається в editor, toast "збережено")
gallery  ──(back)──►  camera
```

> `onPhotoSaved` в App зберігає фото, але не переходить до галереї — користувач залишається в редакторі.

### CameraComponent (`camera/camera.component.ts`)

- Запускає `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ... } })` в `ngAfterViewInit`
- Стани: `cameraStarted`, `photoTaken`, `error` — усі `signal<>`
- Захоплює кадр через `drawImage(video, canvas)`
- Емітить `photoCaptured: EventEmitter<string>` (dataURL jpeg, якість 0.92)
- Зупиняє стрім у `ngOnDestroy` (`stream.getTracks().forEach(t => t.stop())`)

### EditorComponent (`editor/editor.component.ts`)

Увесь рендеринг — на одному `<canvas>`. Шари (`Layer[]`) зберігаються у `signal<Layer[]>`.

**Типи шарів:**
```typescript
type Tool = 'move' | 'pencil'

interface EmojiLayer    { type: 'emoji';    id: string; emoji: string; x: number; y: number; size: number }
interface FragmentLayer { type: 'fragment'; id: string; offscreen: HTMLCanvasElement; x: number; y: number; width: number; height: number }
type Layer = EmojiLayer | FragmentLayer
```

**Сигнали стану:**
```typescript
activeTool      = signal<Tool>('move')
selectedEmoji   = signal('')
emojiSearch     = signal('')
emojiPanelOpen  = signal(true)
filteredEmojis  = computed(() => q ? EMOJIS.filter(e => e.includes(q)) : EMOJIS)
layers          = signal<Layer[]>([])
selectedLayerId = signal<string | null>(null)   // виділений фрагмент (resize)
savedFlash      = signal(false)                  // toast "збережено"
canvasCursor    = signal('default')
```

**Інструменти:**
| Інструмент | Поведінка |
|---|---|
| `move` | drag&drop будь-якого шару; клік по порожньому місцю розміщує вибране емодзі |
| `pencil` | вільне малювання контуру → після `mouseup`/`touchend` → `captureFreehandFragment()` |

**Уніфікований pointer-API (миша + дотик):**
```
onMouseDown/Move/Up  →  handlePointerDown/Move/Up(clientX, clientY)
onTouchStart/Move/End →  handlePointerDown/Move/Up(touch.clientX, touch.clientY)
onMouseLeave  →  зупиняє drag/resize, але НЕ завершує pencil-малювання
```

**Порядок пріоритетів у `handlePointerDown`:**
1. Перевірка resize-маркерів виділеного фрагмента → `resizingLayerId`
2. Hit-test шарів → drag (`dragLayerId`)
3. Зняття виділення (`selectedLayerId.set(null)`)
4. Розміщення емодзі (якщо `selectedEmoji && tool === 'move'`)
5. Старт олівця (`isDrawing = true`)

**Resize-маркери (8 точок):**
- `getHandles(layer: FragmentLayer)` → 8 `{name, cx, cy, cursor}` для nw/n/ne/e/se/s/sw/w
- `hitHandle(x, y, layer)` → маркер у радіусі `handleSize()/2`
- `handleSize()` → `Math.max(10, 10 * scale)` — ~10px на екрані незалежно від resolution
- Мінімальний розмір при resize: 20px

**Захоплення фрагмента олівцем (`captureFreehandFragment`):**
```
1. Bounding box з pencilPoints
2. render() → плоске фото+шари (без контуру)
3. offscreen canvas (розмір bounding box)
4. offCtx.clip() за Path2D з pencilPoints (зсунутих до 0,0)
5. offCtx.drawImage(mainCanvas, -minX, -minY)
6. Додати FragmentLayer, переключитись на 'move'
```

**Розміщення емодзі (`placeEmoji`):**
- Розмір: `window.innerWidth <= 640 ? 96 : 48` (мобільний — вдвічі більший)
- Центрується відносно кліку: `x - size/2, y - size/2`

**Збереження:** `selectedLayerId.set(null)` → `render()` (без маркерів) → `canvas.toDataURL('image/jpeg', 0.92)` → `saved.emit()`

**Рендеринг (`render`):**
- Фонове фото, потім усі шари знизу вгору
- Fragment: `drawImage(offscreen)` + пунктирна рамка (фіолетова, яскравіша якщо виділено) + 8 білих квадратних маркерів
- Emoji: `ctx.font = '${size}px serif'`, `textBaseline = 'top'`

**Emoji: 150 штук у 6 категоріях** (Обличчя, Жести та люди, Серця та символи, Природа, Їжа, Активності та предмети). Пошук по символу.

**CSS touch-action: none** на `<canvas>` — забороняє браузеру перехоплювати скрол під час малювання.

### StorageService (`services/storage.service.ts`)

```typescript
interface SavedPhoto { id: string; dataUrl: string; savedAt: number }
// ключ localStorage: 'dragshot_photos'
// методи: getPhotos(): SavedPhoto[], savePhoto(dataUrl: string), deletePhoto(id: string)
```

### GalleryComponent (`gallery/gallery.component.ts`)

- Відображає `SavedPhoto[]` у CSS Grid (`auto-fill, minmax(200px, 1fr)`)
- Hover-оверлей: дата (`uk-UA` локаль), кнопки завантажити/видалити
- Завантаження через динамічний `<a download href=...>.click()`
- Порожній стан: "Немає збережених фото"

## Стилі

**Глобальна тема** (scoped-стилі в кожному компоненті):
- Фон: `#0a0a10` / `#0f0f1a` / `#13131d`
- Акцент: `#7c3aed` (фіолетовий) → `#ec4899` (рожевий) — градієнт
- Текст: `#e2e8f0` / `#94a3b8` / `#64748b` / `#475569`

**Мобільний breakpoint `@media (max-width: 640px)`:**
| Елемент | Поведінка |
|---|---|
| `.nav-icon` (app.css) | `display: none` — навігація Камера/Галерея без емодзі |
| `.workspace` (editor) | `flex-direction: column-reverse` — emoji-панель знизу |
| `.emoji-panel` | горизонтальна смуга, 2 рядки з `grid-auto-flow: column` |
| `.emoji-search` | `display: none` |
| `.back-btn` | `display: none` |
| `.btn-icon` | `display: none` — кнопки без іконок |
| `.tool-sep` | `display: none` |
| `.panel-hint` | `display: none` |
| `placeEmoji` | розмір 96px замість 48px |

## PWA

- `@angular/service-worker` зареєстрований через `provideServiceWorker('ngsw-worker.js', { ... })` в `app.config.ts`
- `public/manifest.webmanifest` — назва: "DragShot — Фото з емодзі", тема: `#7c3aed`
- `public/favicon.png` — копія `dragshot-camera.png`
- `vercel.json` → заголовки `Service-Worker-Allowed: /` та `Cache-Control: no-cache` для ngsw-worker.js і manifest

## Важливі нюанси

- **Масштабування canvas**: CSS-розмір ≠ внутрішній розмір. Завжди через `toCanvasCoords(clientX, clientY)`: `(clientX - rect.left) * (canvas.width / rect.width)`.
- **Збереження фрагментів**: `ImageBitmap` не серіалізується. Offscreen `HTMLCanvasElement` живе тільки в пам'яті сесії.
- **Фінальне збереження**: `selectedLayerId.set(null)` → `render()` → `toDataURL`. Маркери не потрапляють на збережене фото.
- **mouseleave vs pencil**: `onMouseLeave` зупиняє drag/resize, але не завершує pencil — малювання продовжується, коли миша повертається на canvas.
- **Камера в HTTPS**: `getUserMedia` потребує безпечного контексту (localhost або HTTPS).
- **touch-action: none**: обов'язково на `<canvas>`, інакше браузер перехоплює touchmove для скролу сторінки.
- **Emoji rendering**: `ctx.font = '${size}px serif'`, `textBaseline = 'top'` — x,y = лівий верхній кут гліфа.
- **Resize мінімум**: 20px по будь-якій осі.
- **GitHub PAT**: після використання — відкликати на github.com/settings/tokens.
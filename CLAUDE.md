# DragShot

Веб-застосунок на Angular для зйомки фото через веб-камеру з редактором: накладання емодзі, копіювання та перетягування фрагментів зображення, збереження в localStorage.

## Технологічний стек

- **Angular 21** — standalone-компоненти, Signals API
- **TypeScript 5.9**
- **HTML5 Canvas API** — рендеринг редактора, захоплення фрагментів
- **MediaDevices API** — доступ до веб-камери
- **localStorage** — збереження фото між сесіями
- **Vitest** — тести

## Команди

```bash
npm start          # dev-сервер на http://localhost:4200
npm run build      # production-збірка → dist/DragShot
npm run watch      # збірка з watch-режимом (development)
npm test           # запуск тестів через Vitest
ng generate component src/app/<назва>/<назва>  # новий компонент
```

## Структура проєкту

```
src/
├── main.ts                          # точка входу
├── styles.css                       # глобальні стилі
├── index.html
└── app/
    ├── app.ts                       # кореневий компонент (машина станів: camera | editor | gallery)
    ├── app.html                     # шаблон оболонки з @switch по view()
    ├── app.css                      # стилі шапки та навігації
    ├── app.config.ts                # Angular DI-конфіг
    ├── app.routes.ts                # маршрути (порожні — навігація через Signals)
    ├── camera/
    │   └── camera.component.ts     # захоплення фото з веб-камери
    ├── editor/
    │   └── editor.component.ts     # canvas-редактор (емодзі + фрагменти)
    ├── gallery/
    │   └── gallery.component.ts    # галерея збережених фото
    └── services/
        └── storage.service.ts      # CRUD для localStorage (SavedPhoto[])
```

## Архітектура

### Навігація між екранами

`App` (кореневий компонент) управляє переходами через `view = signal<'camera' | 'editor' | 'gallery'>()`. Роутер не використовується — стан зберігається в пам'яті.

```
camera  ──(photoCaptured)──►  editor  ──(back)──►  camera
                                │
                            (saved)──►  gallery
gallery  ──(back)──►  camera
```

### CameraComponent

- Запускає `navigator.mediaDevices.getUserMedia` в `ngAfterViewInit`
- Захоплює кадр через `drawImage(video, canvas)`
- Емітить `photoCaptured: EventEmitter<string>` (dataURL jpeg)
- Зупиняє стрім у `ngOnDestroy`

### EditorComponent (Canvas-редактор)

Увесь рендеринг — на одному `<canvas>`. Шари (`Layer[]`) зберігаються у `signal<Layer[]>`.

**Типи шарів:**
```typescript
interface EmojiLayer   { type: 'emoji';    emoji: string; x, y, size: number }
interface FragmentLayer { type: 'fragment'; offscreen: HTMLCanvasElement; x, y, width, height: number }
```

**Інструменти:**
| Інструмент | Поведінка |
|---|---|
| `move` | drag&drop будь-якого шару; клік по порожньому місцю розміщує вибране емодзі |
| `select` | drag по полотну → штриховий прямокутник → `captureFragment()` |

**Взаємодія з мишею:**
1. `onMouseDown` — перевіряє hit-test шарів (від верхнього до нижнього); якщо є попадання → drag; якщо `select`-режим → старт виділення
2. `onMouseMove` — оновлює позицію шару або кінцеву точку виділення; перерендерить
3. `onMouseUp` — завершує drag або копіює фрагмент

**Захоплення фрагмента:**
```typescript
// Малює поточний стан canvas в offscreen-canvas вибраного регіону
offscreen.getContext('2d').drawImage(mainCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
```

**Збереження:** `canvas.toDataURL('image/jpeg', 0.92)` → `saved` EventEmitter → `StorageService`.

**Координати:** усі позиції — у координатах canvas (не CSS-пікселях). Перетворення: `(e.clientX - rect.left) * (canvas.width / rect.width)`.

### StorageService

```typescript
interface SavedPhoto { id: string; dataUrl: string; savedAt: number }
// ключ localStorage: 'dragshot_photos'
// методи: getPhotos(), savePhoto(dataUrl), deletePhoto(id)
```

### GalleryComponent

- Відображає `SavedPhoto[]` у CSS Grid (auto-fill, мінімум 200px)
- Hover-оверлей: дата збереження, скачати / видалити
- Скачування через `<a download href=...>`

## Стилі

Усі компоненти використовують scoped-стилі (`styles: [...]`). Глобальна тема:
- Фон: `#0a0a10` / `#0f0f1a`
- Акцент: `#7c3aed` (фіолетовий) → `#ec4899` (рожевий) — градієнт
- Текст: `#e2e8f0` / `#94a3b8` / `#64748b`

## Важливі нюанси

- **Масштабування canvas**: CSS-розмір canvas ≠ внутрішній розмір. Завжди рахувати координати через `getBoundingClientRect()` + коефіцієнт масштабу.
- **Збереження фрагментів**: `ImageBitmap` не серіалізується в localStorage. Фрагменти зберігаються як `HTMLCanvasElement` (offscreen) — вони живуть тільки в пам'яті поточної сесії редагування.
- **Фінальне збереження**: перед `toDataURL` викликається `render()` щоб flatten усі шари без selection-rect.
- **Камера в HTTPS**: `getUserMedia` потребує безпечного контексту (localhost або HTTPS).
- **Emoji rendering**: `ctx.font = '48px serif'`, `textBaseline = 'top'` — позиція x,y відповідає лівому верхньому куту гліфа.
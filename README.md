# 📸 DragShot

> Створений щоб зацікавити доньку програмуванням — бо найкращий спосіб навчити дитину коду це зробити щось, чим вона захоче користуватись 👩‍💻✨

**DragShot** — PWA-застосунок для зйомки фото через веб-камеру з інтерактивним canvas-редактором: накладання емодзі, зміна їх розміру, вільне виділення фрагментів олівцем, перетягування шарів та **спільна хмарна галерея** — всі користувачі бачать фото одне одного в реальному часі.

🌐 **Live:** [dragshot.vercel.app](https://dragshot.vercel.app)

---

## 💡 Ідея

Хотів зацікавити доньку програмуванням через щось, що їй буде справді цікаво використовувати. Фотографуватись, клеїти емодзі та ділитися знімками з подругами — те, що подобається дітям. Коли вона побачила застосунок у дії, першим питанням було: «А як ти це зробив?» — саме цього я й хотів 😊

---

## ✨ Можливості

### 📷 Камера
- Захоплення фото з веб-камери одним кліком
- Підтримка всіх підключених відеопристроїв
- Миттєвий перехід до редактора після зйомки

### 🎨 Редактор
- **Емодзі-стікери** — 150+ емодзі у 6 категоріях (включно з 🕶️ 👓 🥽 😎 🤓 🥸), пошук по символу
- **Зміна розміру емодзі** — виділити емодзі → потягнути за один з 8 маркерів → пропорційне масштабування від центру
- **Перетягування** — переміщуй будь-який шар по полотну
- **Олівець (вільне виділення)** — намалюй довільний контур → фрагмент зображення всередині вирізається як окремий шар
- **Бібліотека фрагментів** — кожен намальований фрагмент автоматично зберігається в localStorage; вкладка «Фрагменти» показує мініатюри всіх збережених фрагментів — обери будь-який і клацни на фото, щоб розмістити повторно; видалення по hover
- **Resize фрагментів** — незалежне масштабування по кожній осі через 8 маркерів
- **Збереження** — фіналізація фото з усіма накладками, завантаження в хмару

### 🌐 Спільна галерея (Supabase Realtime)
- Всі користувачі бачать фото одне одного без перезавантаження
- Анонімна ідентичність: при першому відкритті генерується UUID та випадковий псевдонім українською мовою ("Веселий Орел")
- Видаляти можна лише **власні** фото
- Значок «Моє» на власних знімках
- Spinner під час завантаження, порожній стан із підказкою

### 📱 PWA
- Встановлюється на телефон як нативний застосунок
- Офлайн-підтримка через Angular Service Worker
- **Сплеш-екран** при кожному запуску — логотип і версія з плавною анімацією зникнення
- Адаптивний інтерфейс: мобільна розкладка, тактильні елементи керування

---

## 🛠 Технологічний стек

| Технологія | Призначення |
|---|---|
| **Angular 21** | Фреймворк, standalone-компоненти, Signals API |
| **TypeScript 5.9** | Типізація |
| **HTML5 Canvas API** | Рендеринг редактора, захоплення фрагментів олівцем, resize |
| **MediaDevices API** | Доступ до веб-камери (`getUserMedia`) |
| **Supabase Storage** | Хмарне сховище зображень (bucket `photos`) |
| **Supabase PostgreSQL** | Метадані фото (таблиця `photos` з RLS) |
| **Supabase Realtime** | Підписка на `postgres_changes` → миттєве оновлення галереї |
| **@angular/service-worker** | PWA / офлайн-підтримка |
| **Vercel** | Хостинг |
| **Vitest** | Юніт-тести |

---

## 🚀 Запуск локально

```bash
# Встановити залежності
npm install

# Скопіювати шаблон середовища та заповнити ключі Supabase
cp src/environments/environment.example.ts src/environments/environment.ts

# Запустити dev-сервер
npm start
# → http://localhost:4200

# Зібрати production-збірку
npm run build

# Запустити тести
npm test
```

> ⚠️ Для роботи камери потрібен браузер із підтримкою `getUserMedia` та дозвіл на використання камери (тільки `localhost` або `HTTPS`).

### Налаштування Supabase

1. Створити проєкт на [supabase.com](https://supabase.com)
2. У **SQL Editor** виконати:
```sql
CREATE TABLE photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  username     TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all"   ON photos FOR SELECT USING (true);
CREATE POLICY "insert_all" ON photos FOR INSERT WITH CHECK (true);
CREATE POLICY "delete_own" ON photos FOR DELETE USING (true);
GRANT SELECT, INSERT, DELETE ON TABLE public.photos TO anon;
```
3. У **Storage** → New bucket → назва `photos`, **Public** ✓
4. Заповнити `src/environments/environment.ts` своїми `url` та `anonKey`

---

## 📁 Структура проєкту

```
src/app/
├── app.ts                        # Кореневий компонент, навігація (camera | editor | gallery)
├── camera/                       # Захоплення фото з веб-камери
├── editor/                       # Canvas-редактор (емодзі + resize + олівець + фрагменти)
├── gallery/                      # Хмарна галерея з Realtime-оновленнями
└── services/
    ├── supabase.service.ts       # Singleton-клієнт Supabase
    ├── user.service.ts           # Анонімна ідентичність (UUID + псевдонім)
    ├── cloud-gallery.service.ts  # Завантаження, видалення, Realtime-підписка
    └── storage.service.ts        # CRUD для localStorage: збережені фото + бібліотека фрагментів

public/
├── manifest.webmanifest          # PWA-маніфест
├── icons/                        # Іконки 72–512px
└── ngsw-worker.js                # Angular Service Worker

src/environments/
├── environment.example.ts        # Шаблон (безпечно комітити)
├── environment.ts                # Локальні ключі (у .gitignore)
└── environment.prod.ts           # Production-ключі (у .gitignore, деплоїться через .vercelignore)
```

---

## 🔐 Безпека середовища

Файли `environment.ts` та `environment.prod.ts` містять ключі Supabase і **не комітяться до git** (вказані у `.gitignore`). Для деплою на Vercel використовується `.vercelignore` — він не виключає ці файли, тому Vercel CLI завантажує їх з локального диску під час `vercel --prod`.

---

## 📜 Ліцензія

MIT — робіть що хочете 🙂

---

<p align="center">Зроблено з ❤️ щоб показати доньці — програмування це круто, і ти теж так можеш 🚀</p>

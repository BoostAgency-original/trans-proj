# 🏗️ Архитектура проекта

## Общий обзор

Проект построен по модульной монорепо архитектуре с использованием Bun workspaces.

```
┌─────────────────────────────────────────────────────────┐
│                    Пользователь                          │
└─────────────────┬────────────────────┬──────────────────┘
                  │                    │
        ┌─────────▼─────────┐  ┌──────▼──────────┐
        │  Telegram Client  │  │   Web Browser   │
        └─────────┬─────────┘  └──────┬──────────┘
                  │                    │
        ┌─────────▼─────────┐  ┌──────▼──────────┐
        │   Telegram Bot    │  │  React Admin    │
        │  (Node.js/Bun)    │  │     (Vite)      │
        └─────────┬─────────┘  └──────┬──────────┘
                  │                    │
                  │    ┌───────────────┘
                  │    │
        ┌─────────▼────▼─────────┐
        │    Express API         │
        │   (Node.js/Bun)        │
        └─────────┬──────────────┘
                  │
        ┌─────────▼──────────────┐
        │   Prisma ORM           │
        └─────────┬──────────────┘
                  │
        ┌─────────▼──────────────┐
        │   PostgreSQL           │
        └────────────────────────┘
```

## Компоненты системы

### 1. Telegram Bot (`bot/`)

**Назначение:** Обработка сообщений пользователей в Telegram

**Технологии:**
- Runtime: Bun
- Язык: TypeScript
- Framework: grammY
- Сессии: In-memory (grammY sessions)

**Структура:**
```
bot/
├── src/
│   ├── index.ts           # Точка входа, инициализация бота
│   ├── types.ts           # TypeScript типы и интерфейсы
│   ├── keyboards.ts       # Клавиатуры (Keyboard & InlineKeyboard)
│   ├── commands.ts        # Обработчики команд (/start, /menu, /help)
│   └── handlers/          # Модульные обработчики
│       ├── menu.ts        # Обработка кнопок меню
│       ├── settings.ts    # Изменение настроек пользователя
│       ├── subscription.ts # Управление подписками
│       └── diary.ts       # Дневник наблюдений
└── .env                   # Переменные окружения

```

**Поток обработки сообщений:**
```
Telegram → Bot API → grammY middleware → Session → Handler → Prisma → PostgreSQL
```

**Middleware цепочка:**
1. `session()` - управление сессиями
2. User initialization - создание/обновление пользователя в БД
3. Command handlers - обработка команд
4. Message handlers - обработка текстовых сообщений
5. Callback handlers - обработка inline кнопок

### 2. Admin Panel (`admin/`)

**Назначение:** Web интерфейс для управления ботом и пользователями

**Технологии:**
- Framework: React 18
- Язык: TypeScript
- Bundler: Vite
- Router: React Router v6
- HTTP: Axios
- Styling: CSS

**Структура:**
```
admin/
├── src/
│   ├── main.tsx           # Точка входа
│   ├── App.tsx            # Роутинг приложения
│   ├── api/
│   │   └── api.ts         # API клиент (axios)
│   ├── components/
│   │   └── Layout.tsx     # Общий layout с sidebar
│   └── pages/             # Страницы
│       ├── Dashboard.tsx  # Статистика
│       ├── Users.tsx      # Список пользователей
│       ├── UserDetail.tsx # Детали пользователя
│       ├── Subscriptions.tsx # Подписки
│       ├── Messages.tsx   # Управление сообщениями бота
│       └── Settings.tsx   # Настройки системы
└── vite.config.ts         # Vite конфигурация (proxy к API)
```

**Архитектура компонентов:**
```
Layout (Sidebar + Content)
  ├── Dashboard
  ├── Users
  │   └── UserDetail
  ├── Subscriptions
  ├── Messages
  └── Settings
```

**Взаимодействие с API:**
```typescript
// Централизованный API клиент
axios.create({ baseURL: '/api' })
  ↓
Vite Proxy (localhost:3000 → localhost:3001)
  ↓
Express API
```

### 3. API Server (`shared/api/`)

**Назначение:** RESTful API для админ-панели

**Технологии:**
- Framework: Express.js
- Язык: TypeScript
- Runtime: Bun
- ORM: Prisma

**Структура:**
```
shared/api/
├── src/
│   ├── index.ts           # Express сервер, middleware
│   └── routes/            # Модульные маршруты
│       ├── users.ts       # CRUD пользователей
│       ├── subscriptions.ts # Управление подписками
│       ├── messages.ts    # CRUD сообщений бота
│       ├── settings.ts    # CRUD настроек
│       └── diary.ts       # Запросы к дневнику
└── .env
```

**API Endpoints:**

#### Users (`/api/users`)
- `GET /` - Список всех пользователей + статистика
- `GET /:id` - Детали пользователя + дневник + подписка
- `PUT /:id` - Обновить пользователя
- `DELETE /:id` - Удалить пользователя (cascade)

#### Subscriptions (`/api/subscriptions`)
- `GET /` - Список подписок + инфо о пользователях
- `PUT /:userId` - Создать/обновить подписку

#### Messages (`/api/messages`)
- `GET /` - Список сообщений (фильтр по category)
- `GET /:key` - Получить сообщение по ключу
- `POST /` - Создать/обновить сообщение (upsert)
- `PUT /:key` - Обновить сообщение
- `DELETE /:key` - Удалить сообщение

#### Settings (`/api/settings`)
- `GET /` - Список настроек
- `GET /:key` - Получить настройку по ключу
- `POST /` - Создать/обновить настройку (upsert)
- `PUT /:key` - Обновить настройку
- `DELETE /:key` - Удалить настройку

#### Diary (`/api/diary`)
- `GET /` - Записи дневника (фильтр: userId, principle)
- `GET /stats` - Статистика дневника

**Middleware:**
```
Request
  ↓
CORS (origin: localhost:3000)
  ↓
express.json() (body parser)
  ↓
Router
  ↓
Prisma Query
  ↓
Response
```

### 4. Database Layer (`shared/`)

**Назначение:** Схема БД и ORM

**Технологии:**
- ORM: Prisma
- СУБД: PostgreSQL

**Структура:**
```
shared/
├── prisma/
│   ├── schema.prisma      # Схема БД
│   ├── migrations/        # История миграций
│   └── seed.ts            # Тестовые данные
├── db.ts                  # Prisma Client singleton
└── .env
```

**Модели данных:**

```prisma
User (пользователи Telegram)
  ↓ 1:1
Subscription (подписки)

User
  ↓ 1:N
DiaryEntry (записи дневника)

User
  ↓ 1:1
IntroductionData (данные вводного сценария)

BotMessage (реплики бота) - standalone

Settings (глобальные настройки) - standalone
```

**Типы связей:**
- `User → Subscription`: 1:1, cascade delete
- `User → DiaryEntry`: 1:N, cascade delete
- `User → IntroductionData`: 1:1, cascade delete

## Потоки данных

### 1. Регистрация нового пользователя

```
Пользователь → /start
  ↓
Bot получает message
  ↓
Middleware: User initialization
  ↓
Prisma.user.upsert() (telegramId)
  ↓
Создаётся User в БД
  ↓
Отправка приветственного сообщения
```

### 2. Добавление заметки в дневник

```
Пользователь → /add_note 5 Текст
  ↓
Bot парсит команду
  ↓
Prisma.diaryEntry.create()
  ↓
Запись сохраняется в БД
  ↓
Подтверждение пользователю
```

### 3. Просмотр статистики в админке

```
Админ открывает Dashboard
  ↓
React компонент монтируется
  ↓
useEffect → API.getUsers(), API.getSubscriptions(), API.getDiaryStats()
  ↓
3 параллельных запроса к Express API
  ↓
Prisma.user.findMany(), Prisma.subscription.findMany(), etc.
  ↓
PostgreSQL queries
  ↓
Response JSON → setState
  ↓
Рендер компонента с данными
```

### 4. Редактирование сообщения бота

```
Админ → Messages → Кнопка Edit
  ↓
Открывается форма с данными
  ↓
Админ изменяет текст → Submit
  ↓
POST /api/messages
  ↓
Prisma.botMessage.update()
  ↓
БД обновляется
  ↓
Компонент обновляет список
```

## Безопасность

### Текущие меры:

1. **SQL инъекции**: Защита через Prisma (параметризованные запросы)
2. **CORS**: Ограничен localhost (для dev)
3. **.env файлы**: Исключены из git (.gitignore)
4. **Validation**: Базовая валидация на уровне Prisma схемы

### Рекомендации для продакшена:

1. **Аутентификация админки**: JWT + bcrypt
2. **Rate limiting**: Express middleware (express-rate-limit)
3. **Input validation**: Zod schemas
4. **HTTPS**: Nginx reverse proxy + Let's Encrypt
5. **Environment variables**: Использовать секреты (Vault, AWS Secrets Manager)
6. **Logging**: Winston + Sentry для отслеживания ошибок
7. **CORS**: Ограничить до конкретного домена

## Масштабирование

### Текущие ограничения:

- **Сессии бота**: In-memory (пропадут при перезапуске)
- **Single instance**: Один экземпляр каждого сервиса
- **No caching**: Каждый запрос идёт в БД

### Решения для роста:

1. **Redis** для:
   - Кэширование часто запрашиваемых данных
   - Сессии бота (persistent)
   - Rate limiting

2. **Message Queue** (Bull/BullMQ):
   - Фоновые задачи (отправка уведомлений)
   - Обработка больших объёмов данных
   - Retry механизмы

3. **Load Balancing**:
   - Nginx для распределения нагрузки
   - Несколько инстансов API и бота
   - PM2 cluster mode

4. **Database**:
   - Connection pooling (Prisma)
   - Read replicas для аналитики
   - Индексы на часто используемых полях

5. **CDN**:
   - Статика админки на CDN (Cloudflare, Vercel)
   - Кэширование API responses

## Мониторинг

### Метрики для отслеживания:

1. **Bot**:
   - Количество обработанных сообщений/мин
   - Время ответа
   - Ошибки обработчиков

2. **API**:
   - RPS (requests per second)
   - Latency (p50, p95, p99)
   - Error rate

3. **Database**:
   - Количество соединений
   - Время выполнения запросов
   - Размер таблиц

4. **System**:
   - CPU usage
   - Memory usage
   - Disk I/O

### Инструменты:

- **Prometheus + Grafana** - метрики
- **Winston + Elasticsearch + Kibana** - логи
- **Sentry** - ошибки и трассировка
- **UptimeRobot** - доступность

## Деплой

### Development (локально):
```bash
./start-all.sh
```

### Production (рекомендации):

1. **Docker Compose**:
   - Контейнер для бота
   - Контейнер для API
   - Контейнер для PostgreSQL
   - Volume для данных

2. **Админка**:
   - Статичная сборка (`bun run build`)
   - Деплой на Vercel/Netlify
   - Environment variables для API URL

3. **CI/CD**:
   - GitHub Actions
   - Автоматические тесты
   - Автодеплой при push в main

4. **Мониторинг**:
   - Health checks
   - Alerts при ошибках
   - Логирование в централизованную систему

## Развитие архитектуры

### Phase 1 (MVP - текущая):
- ✅ Базовый функционал бота
- ✅ Админ-панель для управления
- ✅ PostgreSQL БД

### Phase 2 (Enhancement):
- [ ] Redis для кэширования и сессий
- [ ] JWT аутентификация админки
- [ ] Scheduled tasks (cron jobs) для уведомлений
- [ ] WebSockets для реалтайм обновлений админки

### Phase 3 (Scale):
- [ ] Микросервисная архитектура
- [ ] Message Queue для асинхронных задач
- [ ] Kubernetes для оркестрации
- [ ] Multi-region deployment

## Заключение

Текущая архитектура оптимальна для:
- Быстрой разработки и итераций
- Малых и средних нагрузок (до 10k пользователей)
- Простоты деплоя и поддержки

Для роста архитектура легко масштабируется добавлением:
- Redis
- Message Queue
- Load Balancer
- Микросервисов


# Шпаргалка по командам

## Быстрый запуск

### Запустить всё одной командой (macOS/Linux)
```bash
./start-all.sh
```

### Запустить вручную (в разных терминалах)

```bash
# Терминал 1: API
cd shared/api && bun run dev

# Терминал 2: Бот
cd bot && bun run dev

# Терминал 3: Админка
cd admin && bun run dev
```

## Установка

```bash
# Установить все зависимости
bun install

# Установить для конкретного проекта
cd bot && bun install
cd admin && bun install
cd shared && bun install
cd shared/api && bun install
```

## База данных

```bash
cd shared

# Применить миграции
bunx prisma migrate dev

# Создать новую миграцию
bunx prisma migrate dev --name название

# Сгенерировать Prisma Client
bunx prisma generate

# Открыть Prisma Studio (GUI)
bunx prisma studio

# Сбросить БД
bunx prisma migrate reset
```

## Разработка

### Бот
```bash
cd bot

# Запуск в dev режиме (с hot reload)
bun run dev

# Запуск в prod режиме
bun run start

# Сборка
bun run build
```

### API
```bash
cd shared/api

# Запуск в dev режиме
bun run dev

# Запуск в prod режиме
bun run start

# Сборка
bun run build
```

### Админка
```bash
cd admin

# Запуск dev сервера
bun run dev

# Сборка для продакшена
bun run build

# Предпросмотр prod сборки
bun run preview
```

## Корневые команды (из /trans-proj)

```bash
# Бот
bun run bot:dev      # Запуск бота в dev режиме
bun run bot:start    # Запуск бота в prod режиме

# Админка
bun run admin:dev    # Запуск админки в dev режиме
bun run admin:build  # Сборка админки

# API
bun run api:dev      # Запуск API в dev режиме

# Prisma
bun run prisma:migrate   # Применить миграции
bun run prisma:generate  # Сгенерировать клиент
bun run prisma:studio    # Открыть Prisma Studio
```

## Полезные команды

### Очистка
```bash
# Удалить node_modules
rm -rf node_modules bot/node_modules admin/node_modules shared/node_modules shared/api/node_modules

# Переустановить зависимости
bun install

# Очистить кэш Bun
rm -rf ~/.bun/install/cache
```

### Git
```bash
# Первый коммит
git init
git add .
git commit -m "Initial commit"

# Игнорировать .env файлы (уже в .gitignore)
```

### Проверка портов
```bash
# Проверить, что порты свободны
lsof -i :3000  # Админка
lsof -i :3001  # API
lsof -i :5432  # PostgreSQL
lsof -i :5555  # Prisma Studio
```

### Логи
```bash
# Посмотреть логи PostgreSQL (macOS Homebrew)
tail -f /opt/homebrew/var/log/postgresql@15.log

# Посмотреть процессы Node/Bun
ps aux | grep bun
```

## Переменные окружения

### bot/.env
```env
BOT_TOKEN=ваш_токен_от_BotFather
DATABASE_URL="postgresql://postgres:3141@localhost:5432/trans?schema=public"
TELEGRAM_CHANNEL_URL=https://t.me/ваш_канал
TECH_SUPPORT_BOT=@ваш_support_bot
```

### shared/.env и shared/api/.env
```env
DATABASE_URL="postgresql://postgres:3141@localhost:5432/trans?schema=public"
```

### shared/api/.env (дополнительно)
```env
PORT=3001
```

## Troubleshooting

### Бот не запускается
```bash
# Проверить токен
cat bot/.env | grep BOT_TOKEN

# Проверить подключение к БД
cd shared && bunx prisma studio
```

### API не работает
```bash
# Проверить порт
lsof -i :3001

# Перезапустить
cd shared/api && bun run dev
```

### Админка не подключается
```bash
# Проверить, что API запущено
curl http://localhost:3001/api/health

# Очистить и пересобрать
cd admin
rm -rf node_modules dist
bun install
bun run dev
```

### Ошибки БД
```bash
# Проверить PostgreSQL
psql -U postgres -d trans -c "SELECT 1"

# Пересоздать БД
cd shared
bunx prisma migrate reset
bunx prisma migrate dev
```

## URLs

- **Админ-панель**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health
- **Prisma Studio**: http://localhost:5555
- **PostgreSQL**: localhost:5432

## Shortcuts для разработки

```bash
# Alias для быстрого доступа (добавьте в ~/.zshrc или ~/.bashrc)
alias tp='cd /Users/plancode/Documents/BoostGit/trans-proj'
alias tpbot='cd /Users/plancode/Documents/BoostGit/trans-proj/bot'
alias tpadmin='cd /Users/plancode/Documents/BoostGit/trans-proj/admin'
alias tpapi='cd /Users/plancode/Documents/BoostGit/trans-proj/shared/api'
alias tpstart='cd /Users/plancode/Documents/BoostGit/trans-proj && ./start-all.sh'
```


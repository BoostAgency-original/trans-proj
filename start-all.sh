#!/bin/bash

# Скрипт для запуска всех компонентов проекта

echo "🚀 Запуск Telegram бота для Трансерфинга..."
echo ""

# Проверка установки зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    bun install
fi

# Проверка Prisma Client
if [ ! -d "node_modules/@prisma/client" ]; then
    echo "🔧 Генерация Prisma Client..."
    cd shared && bunx prisma generate && cd ..
fi

# Функция для запуска процесса в новом окне терминала
start_process() {
    local name=$1
    local command=$2
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell app \"Terminal\" to do script \"cd '$PWD' && $command\""
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        gnome-terminal -- bash -c "cd '$PWD' && $command; exec bash"
    else
        echo "⚠️  Автоматический запуск не поддерживается на этой ОС"
        echo "Запустите вручную:"
        echo "  $command"
    fi
}

echo "1️⃣  Запуск API сервера..."
start_process "API" "cd shared/api && bun run dev"
sleep 2

echo "2️⃣  Запуск Telegram бота..."
start_process "Bot" "cd bot && bun run dev"
sleep 2

echo "3️⃣  Запуск админ-панели..."
start_process "Admin" "cd admin && bun run dev"
sleep 2

echo ""
echo "✅ Все компоненты запущены!"
echo ""
echo "📍 API сервер: http://localhost:3001"
echo "📍 Админ-панель: http://localhost:3000"
echo "📍 Telegram бот: работает в фоне"
echo ""
echo "Для остановки закройте окна терминалов или нажмите Ctrl+C в каждом"


#!/bin/bash
# Скрипт восстановления базы данных из бэкапа
# Использование: ./restore.sh backups/transurfing_db_20240120_030000.sql.gz

set -e

if [ -z "$1" ]; then
    echo "Использование: ./restore.sh <путь_к_бэкапу>"
    echo "Пример: ./restore.sh backups/transurfing_db_20240120_030000.sql.gz"
    echo ""
    echo "Доступные бэкапы:"
    ls -la backups/*.sql.gz 2>/dev/null || echo "  Бэкапов не найдено"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ОШИБКА: Файл бэкапа не найден: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  ВНИМАНИЕ: Это полностью перезапишет текущую базу данных!"
echo "Файл бэкапа: $BACKUP_FILE"
read -p "Вы уверены? (введите 'yes' для подтверждения): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Отменено."
    exit 0
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo "[$TIMESTAMP] Начинаем восстановление..."

# Останавливаем бота и API чтобы не было конфликтов
echo "[$TIMESTAMP] Останавливаем сервисы..."
docker-compose stop bot api || true

# Восстанавливаем
echo "[$TIMESTAMP] Восстанавливаем базу из $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker-compose exec -T db psql -U postgres -d transurfing_db

# Запускаем сервисы обратно
echo "[$TIMESTAMP] Запускаем сервисы..."
docker-compose start api bot

echo "[$TIMESTAMP] Восстановление завершено!"

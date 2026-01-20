#!/bin/bash
# Скрипт бэкапа базы данных
# Использование: ./backup.sh
# Для автоматического запуска добавьте в cron:
# 0 3 * * * /path/to/backup.sh >> /var/log/db-backup.log 2>&1

set -e

# Настройки
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/transurfing_db_$TIMESTAMP.sql.gz"

# Создаём папку для бэкапов
mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Начинаем бэкап базы данных..."

# Делаем дамп базы и сжимаем
docker-compose exec -T db pg_dump -U postgres transurfing_db | gzip > "$BACKUP_FILE"

# Проверяем что файл создан и не пустой
if [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$TIMESTAMP] Бэкап создан: $BACKUP_FILE ($SIZE)"
else
    echo "[$TIMESTAMP] ОШИБКА: Бэкап пустой или не создан!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Удаляем старые бэкапы (старше RETENTION_DAYS дней)
find "$BACKUP_DIR" -name "transurfing_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$TIMESTAMP] Удалены бэкапы старше $RETENTION_DAYS дней"

echo "[$TIMESTAMP] Бэкап завершён успешно!"

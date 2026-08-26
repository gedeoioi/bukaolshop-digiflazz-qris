#!/bin/bash

BACKUP_DIR="/var/backups/bukaolshop"
DATE=$(date +%Y-%m-%d)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

mysqldump -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" bukaolshop_db | gzip > "$BACKUP_DIR/backup-$DATE.sql.gz"

if [ $? -eq 0 ]; then
    echo "Backup successful: backup-$DATE.sql.gz"
else
    echo "Backup failed!"
    exit 1
fi

find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Old backups cleaned (retention: $RETENTION_DAYS days)"

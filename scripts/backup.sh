#!/bin/bash
# =============================================
# NurseSpace 数据库备份脚本
# 用法:
#   bash scripts/backup.sh              # 备份到默认目录 ./backups/
#   bash scripts/backup.sh /path/dir    # 备份到指定目录
#   bash scripts/backup.sh --restore backups/backup_xxx.sql.gz  # 恢复备份
# =============================================
set -e

cd "$(dirname "$0")/.."

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

# ---- 恢复模式 ----
if [ "$1" = "--restore" ]; then
    RESTORE_FILE="$2"
    if [ ! -f "$RESTORE_FILE" ]; then
        echo "[ERROR] 备份文件不存在: $RESTORE_FILE"
        exit 1
    fi
    echo "=============================================="
    echo "  WARNING: 即将恢复数据库，当前数据将被覆盖！"
    echo "  备份文件: $RESTORE_FILE"
    echo "=============================================="
    read -rp "确认恢复？输入 yes 继续: " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "已取消"
        exit 0
    fi
    echo ">>> 恢复数据库..."
    if [[ "$RESTORE_FILE" == *.gz ]]; then
        gunzip -c "$RESTORE_FILE" | docker compose exec -T db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE:-nurse_training_system}"
    else
        docker compose exec -T db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE:-nurse_training_system}" < "$RESTORE_FILE"
    fi
    echo "Done: 恢复完成"
    exit 0
fi

# ---- 备份模式 ----
mkdir -p "$BACKUP_DIR"

echo ">>> 备份数据库到: $BACKUP_FILE"

# 从 .env 读取环境变量
if [ -f .env ]; then
    set -a; source .env; set +a
fi

docker compose exec -T db mysqldump \
    -u root \
    -p"${MYSQL_ROOT_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --set-gtid-purged=OFF \
    "${MYSQL_DATABASE:-nurse_training_system}" \
    | gzip > "$BACKUP_FILE"

echo "Done: 备份完成 $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# 清理 30 天前的旧备份
echo ">>> 清理 30 天前的旧备份..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete 2>/dev/null || true
echo "Done"

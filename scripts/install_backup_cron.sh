#!/bin/bash
# =============================================
# 安装每日数据库备份定时任务（幂等，重复执行只保留一条）
# 用法: bash scripts/install_backup_cron.sh
#
# 备份策略：每日 02:00 备份到 ./backups/，backup.sh 自带 30 天滚动清理。
# 异地容灾：本机磁盘故障时备份同损，建议另行将 backups/ 同步到对象存储或异机。
# =============================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CRON_LINE="0 2 * * * cd ${PROJECT_DIR} && bash scripts/backup.sh >> logs/backup.log 2>&1"

mkdir -p "${PROJECT_DIR}/logs"

( crontab -l 2>/dev/null | grep -vF "bash scripts/backup.sh" || true; echo "${CRON_LINE}" ) | crontab -

echo ">>> 已安装定时备份任务（每日 02:00）:"
crontab -l | grep "backup.sh"

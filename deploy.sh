#!/bin/bash
# ============================================================
# NurseSpace 生产部署脚本（唯一部署入口）
#
# 用法:
#   bash deploy.sh                 # 拉代码 → 构建(git 短哈希 tag) → 启动 → 健康验证
#   bash deploy.sh --no-pull       # 跳过 git pull（本地验证未推送的改动时）
#   bash deploy.sh rollback <tag>  # 回滚到历史镜像（tag 为 git 短哈希）
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE_CMD="docker compose"
$COMPOSE_CMD version >/dev/null 2>&1 || COMPOSE_CMD="docker-compose"

REQUIRED_ENV_KEYS=(SECRET_KEY JWT_SECRET_KEY ENCRYPTION_KEY MYSQL_PASSWORD REDIS_PASSWORD ADMIN_PASSWORD)

check_env() {
    local key=$1
    # 未设置 / 空值 / 仍是模板默认值（change-me 开头）都视为未配置
    if ! grep -qE "^${key}=." .env 2>/dev/null || grep -qE "^${key}=change-me" .env 2>/dev/null; then
        echo "[ERROR] .env 中 ${key} 未设置或仍为默认值，请先编辑 .env"
        exit 1
    fi
}

if [ ! -f .env ]; then
    echo "未找到 .env 文件，从模板创建..."
    cp .env.example .env
    chmod 600 .env
    echo "[ERROR] 请编辑 .env 填入以下必填项后重新执行：${REQUIRED_ENV_KEYS[*]}"
    exit 1
fi

for key in "${REQUIRED_ENV_KEYS[@]}"; do
    check_env "$key"
done

# ---- 回滚模式 ----
if [ "${1:-}" = "rollback" ]; then
    if [ -z "${2:-}" ]; then
        echo "用法: bash deploy.sh rollback <镜像tag>"
        echo "查看历史版本: docker images nursespace-app --format '{{.Tag}}'"
        exit 1
    fi
    echo ">>> 回滚到镜像 nursespace-app:$2 ..."
    APP_VERSION="$2" $COMPOSE_CMD up -d --wait app
    $COMPOSE_CMD ps
    echo ">>> 回滚完成"
    exit 0
fi

# ---- 拉代码 ----
if [ "${1:-}" != "--no-pull" ]; then
    echo ">>> 拉取最新代码..."
    git pull origin main
fi

TAG=$(git rev-parse --short HEAD)
export APP_VERSION="$TAG"

# ---- 构建（带缓存 + 拉取最新基础镜像）----
echo ">>> 构建镜像 nursespace-app:$TAG ..."
$COMPOSE_CMD build --pull app

# ---- 启动并等待健康检查 ----
echo ">>> 启动服务（--wait 阻塞等待健康检查通过）..."
if ! $COMPOSE_CMD up -d --wait; then
    echo ""
    echo "[ERROR] 服务未通过健康检查，部署失败。最近日志："
    $COMPOSE_CMD logs app --tail=50 || true
    exit 1
fi

$COMPOSE_CMD ps
echo ""
echo "=== 部署完成: nursespace-app:$TAG ==="
echo "回滚: bash deploy.sh rollback <旧tag>（历史版本: docker images nursespace-app）"
echo "日志: $COMPOSE_CMD logs -f app"

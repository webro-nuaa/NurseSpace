#!/bin/bash
set -e

echo "=== 护士培训系统 —— 生产部署脚本 ==="
echo ""

# ---- Docker 检查 ----
if ! command -v docker &> /dev/null; then
    echo "[ERROR] 未检测到 Docker，请先安装 Docker Engine 20.10+"
    echo "  参考: https://docs.docker.com/engine/install/"
    exit 1
fi

COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "[ERROR] 未检测到 Docker Compose"
    exit 1
fi

# ---- 环境配置检查 ----
if [ ! -f ".env" ]; then
    echo "未找到 .env 文件，从模板创建..."
    cp .env.example .env
    chmod 600 .env
    echo ""
    echo "=============================================="
    echo "  ⚠️  请编辑 .env 文件，设置以下必填项："
    echo ""
    echo "  SECRET_KEY       — Flask session 密钥"
    echo "  JWT_SECRET_KEY   — JWT Token 密钥"
    echo "  MYSQL_PASSWORD   — 数据库密码"
    echo "  ADMIN_PASSWORD   — 初始管理员密码"
    echo ""
    echo "  生成随机密钥:"
    echo "    python3 -c \"import secrets; print(secrets.token_hex(32))\""
    echo "=============================================="
    echo ""
    exit 0
fi

# 检查必填环境变量
check_env() {
    local key=$1
    if ! grep -qE "^${key}=[^c]" .env 2>/dev/null || grep -qE "^${key}=change-me" .env 2>/dev/null; then
        echo "[ERROR] .env 中 ${key} 未设置或仍为默认值，请先编辑 .env"
        exit 1
    fi
}

check_env "SECRET_KEY"
check_env "JWT_SECRET_KEY"
check_env "MYSQL_PASSWORD"
check_env "ADMIN_PASSWORD"

# ---- 构建与启动 ----
echo ""
echo "构建镜像并启动服务..."
$COMPOSE_CMD build --pull
$COMPOSE_CMD up -d

echo ""
echo "=== 部署完成 ==="
echo ""
echo "检查服务状态:  $COMPOSE_CMD ps"
echo "查看应用日志:  $COMPOSE_CMD logs -f app"
echo "查看全部日志:  $COMPOSE_CMD logs -f"
echo ""
echo "如需初始化数据库迁移（首次部署后）:"
echo "  $COMPOSE_CMD exec app flask db migrate -m 'initial'"
echo "  $COMPOSE_CMD exec app flask db upgrade"

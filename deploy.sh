#!/bin/bash
# NurseSpace 部署脚本
# 用法: bash deploy.sh
set -e

cd "$(dirname "$0")"

echo ">>> 拉取最新代码..."
git pull origin main

echo ">>> 重新构建镜像（不使用缓存）..."
docker compose build --no-cache app

echo ">>> 启动服务..."
docker compose up -d

echo ">>> 等待健康检查..."
sleep 5
docker compose ps

echo ""
echo "部署完成。查看日志: docker compose logs app --tail 20"

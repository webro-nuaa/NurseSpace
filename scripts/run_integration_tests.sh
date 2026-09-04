#!/usr/bin/env bash
# MySQL 集成测试运行器：以 TEST_DB_BACKEND=mysql 在容器内跑 pytest，
# 与生产一致的 FK/ENUM/字符集行为。SQLite 快速档仍是默认（pytest 直接跑）。
#
# 用法：bash scripts/run_integration_tests.sh [pytest 附加参数]
#   例：bash scripts/run_integration_tests.sh tests/test_db_design.py -v
set -euo pipefail

cd "$(dirname "$0")/.."

NETWORK="${NETWORK:-nursespace_back-net}"
IMAGE="${IMAGE:-nursespace-app:latest}"

# 前置（一次性，已在生产库执行）：测试库与授权
#   CREATE DATABASE nurse_training_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
#   GRANT ALL ON nurse_training_test.* TO 'nursespace_app'@'%';
#   FLUSH PRIVILEGES;
# root 仅允许容器内登录，因此测试进程统一使用 nursespace_app 账号。

APP_PW=$(grep -m1 '^MYSQL_PASSWORD' .env | cut -d= -f2)
if [ -z "${APP_PW}" ]; then
  echo "错误：.env 中未找到 MYSQL_PASSWORD" >&2
  exit 1
fi

docker run --rm -t \
  -v "$PWD":/app -w /app \
  --network "$NETWORK" \
  --entrypoint python3 \
  -e TEST_MYSQL_HOST="${TEST_MYSQL_HOST:-db}" \
  -e TEST_MYSQL_USER=nursespace_app \
  -e TEST_MYSQL_PASSWORD="$APP_PW" \
  -e SECRET_KEY=test-secret-key-for-testing-only \
  -e JWT_SECRET_KEY=test-jwt-secret-for-testing-only-32-bytes-min \
  -e ENCRYPTION_KEY=d0EMMLL-wOGkN5Az6IQvXd16BSbE6Fx8EDZT4xcifg4= \
  -e MYSQL_PASSWORD="$APP_PW" \
  -e MYSQL_HOST=db \
  -e REDIS_ENABLED=0 \
  -e RATELIMIT_ENABLED=0 \
  -e CORS_ORIGINS='*' \
  "$IMAGE" -m pytest -q "$@"

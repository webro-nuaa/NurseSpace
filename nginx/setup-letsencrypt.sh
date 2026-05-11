#!/bin/bash
# ============================================================
# Let's Encrypt 正式证书申请（有域名后使用）
#
# 前提条件：
#   1. 域名已解析到本服务器 IP
#   2. nginx 已启动（docker compose up -d）
#   3. 服务器已安装 certbot
#
# 用法：sudo bash nginx/setup-letsencrypt.sh your-domain.com
# ============================================================

set -e

DOMAIN="${1:?请提供域名，例如: bash nginx/setup-letsencrypt.sh example.com}"

echo ">>> 为 ${DOMAIN} 申请 Let's Encrypt 证书..."

# 停止 nginx（certbot standalone 需要 80 端口）
docker compose stop nginx

# 使用 standalone 模式申请证书（无需运行 nginx）
certbot certonly --standalone \
    -d "$DOMAIN" \
    --agree-tos \
    --non-interactive \
    --email "admin@${DOMAIN}"

CERT_DIR="./nginx/certs"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"

# 复制证书到 nginx 使用的路径
sudo cp "${LIVE_DIR}/fullchain.pem" "${CERT_DIR}/server.crt"
sudo cp "${LIVE_DIR}/privkey.pem"   "${CERT_DIR}/server.key"
sudo chmod 644 "${CERT_DIR}/server.crt"
sudo chmod 600 "${CERT_DIR}/server.key"

echo ""
echo ">>> 证书已安装。更新 nginx 配置中的 server_name..."
echo ""

# 更新 nginx conf 中的 server_name
sed -i "s/server_name _;/server_name ${DOMAIN};/g" ./nginx/nginx.conf

echo ">>> 重启服务..."
docker compose up -d

echo ""
echo "============================================"
echo "  HTTPS 证书配置完成"
echo "============================================"
echo ""
echo "域名: https://${DOMAIN}"
echo ""
echo "设置自动续期 (以 root 执行):"
echo "  echo '0 3 * * * certbot renew --quiet --post-hook \"cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ./nginx/certs/server.crt && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ./nginx/certs/server.key && docker compose restart nginx\"' | crontab -"
echo "============================================"

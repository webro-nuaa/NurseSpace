#!/bin/bash
# ============================================================
# 生成自签名 SSL 证书（无域名临时方案）
# 用法：bash nginx/generate-self-signed-cert.sh
#
# 浏览器会显示「不安全」警告，点击「高级 → 继续访问」即可。
# 语音输入功能可用。
# 拿到域名后，用 certbot 申请正式证书替换。
# ============================================================

set -e

CERT_DIR="./nginx/certs"
mkdir -p "$CERT_DIR"

# 如果已存在，先备份
if [ -f "$CERT_DIR/server.crt" ] || [ -f "$CERT_DIR/server.key" ]; then
    BACKUP_DIR="${CERT_DIR}.bak.$(date +%s)"
    mkdir -p "$BACKUP_DIR"
    cp -a "$CERT_DIR/." "$BACKUP_DIR/" 2>/dev/null || true
    echo "已备份旧证书到: $BACKUP_DIR"
fi

# 生成自签名证书（有效期 365 天）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/C=CN/ST=Beijing/L=Beijing/O=NurseSpace/CN=NurseSpace"

# 设置合理权限
chmod 644 "$CERT_DIR/server.crt"
chmod 600 "$CERT_DIR/server.key"

echo ""
echo "============================================"
echo "  自签名证书生成完成"
echo "============================================"
echo ""
echo "证书文件:"
echo "  $CERT_DIR/server.crt"
echo "  $CERT_DIR/server.key"
echo ""
echo "接下来: docker compose up -d --build"
echo ""
echo "浏览器首次访问时会提示不安全，点击"
echo "「高级 → 继续访问」即可进入。"
echo "============================================"

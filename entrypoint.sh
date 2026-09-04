#!/bin/bash
# ============================================================
# NurseSpace 容器启动脚本
#
# 职责（按顺序）:
#   1. 等待 MySQL 就绪（业务账号，应用不持有 root 凭据）
#   2. 数据库 schema 迁移：统一走 alembic upgrade head
#      —— 空库由完整 baseline 迁移建表；已有库增量升级。
#      禁止 create_all：它绕过迁移链，会让表结构与迁移历史分叉。
#   3. 创建初始管理员（仅账号不存在时；失败立即退出，禁止带病启动）
#   4. 初始化默认 AI 配置（同样 fail-fast）
#   5. 预热 ChromaDB 模型（可跳过）
#
# 任何一步失败都直接非零退出，由 Docker restart 策略兜底重试。
# ============================================================
set -e

MYSQL_HOST=${MYSQL_HOST:-db}
MYSQL_PORT=${MYSQL_PORT:-3306}

# ---- 1. 等待 MySQL 就绪（业务账号）----
echo "[entrypoint] 等待 MySQL 就绪 (${MYSQL_HOST}:${MYSQL_PORT})..."
MAX_RETRIES=60
RETRY_COUNT=0
until python3 -c "
import os, pymysql
try:
    conn = pymysql.connect(
        host=os.environ['MYSQL_HOST'],
        port=int(os.environ.get('MYSQL_PORT', 3306)),
        user=os.environ['MYSQL_USER'],
        password=os.environ['MYSQL_PASSWORD'],
        connect_timeout=3,
    )
    conn.close()
except Exception:
    exit(1)
" 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "[entrypoint] MySQL 等待超时，退出"
        exit 1
    fi
    echo "[entrypoint] MySQL 未就绪 (${RETRY_COUNT}/${MAX_RETRIES})，2秒后重试..."
    sleep 2
done
echo "[entrypoint] MySQL 已就绪"

# ---- 2. schema 迁移（统一 alembic，无 create_all 分支）----
echo "[entrypoint] 执行数据库迁移 (alembic upgrade head)..."
python3 -c "
from sqlalchemy import inspect, text
from app import create_app
from flask_migrate import upgrade

app = create_app()
with app.app_context():
    from models import db
    tables = inspect(db.engine).get_table_names()
    # 自愈：迁移标记残留但业务表为零（如误删后 drop_all 不动 alembic_version），
    # upgrade() 会因版本已到 head 而空转。仅此损坏状态才重置标记，正常库不受影响。
    if 'alembic_version' in tables and len(tables) == 1:
        db.session.execute(text('DELETE FROM alembic_version'))
        db.session.commit()
        print('[entrypoint] 检测到孤立迁移标记，已重置，将重建全部表')
    upgrade()
print('[entrypoint] 数据库迁移完成')
"

# ---- 3. 初始管理员（fail-fast）----
echo "[entrypoint] 初始化管理员账号..."
python3 -c "
import os
from app import create_app
from models import db, User

app = create_app()
with app.app_context():
    admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
    admin_password = os.environ.get('ADMIN_PASSWORD')
    if not admin_password:
        print('[entrypoint] ADMIN_PASSWORD 未设置')
        raise SystemExit(1)
    existing = User.query.filter_by(username=admin_username).first()
    if existing is None:
        admin = User(
            username=admin_username,
            real_name='系统管理员',
            role='admin',
            status='active',
            email=os.environ.get('ADMIN_EMAIL', 'admin@hospital.com')
        )
        admin.set_password(admin_password)
        db.session.add(admin)
        db.session.commit()
        print(f'[entrypoint] 管理员账号已创建: {admin_username}')
    else:
        print(f'[entrypoint] 管理员账号已存在: {admin_username}')
"

# ---- 4. 默认 AI 配置（fail-fast）----
echo "[entrypoint] 初始化默认配置..."
python3 -c "
from app import create_app
from models import db, AiSetting

app = create_app()
with app.app_context():
    if db.session.get(AiSetting, 1) is None:
        db.session.add(AiSetting(id=1, provider='local'))
        db.session.commit()
        print('[entrypoint] 默认 AI 设置已创建')
    else:
        print('[entrypoint] AI 设置已存在')
"

# ---- 5. ChromaDB 模型缓存 ----
MODEL_DIR="$HOME/.cache/chroma/onnx_models/all-MiniLM-L6-v2"
if [ "${SKIP_CHROMA_MODEL_DOWNLOAD:-1}" = "1" ]; then
    echo "[entrypoint] 跳过 ChromaDB 模型启动下载（SKIP_CHROMA_MODEL_DOWNLOAD=1）"
elif [ ! -f "$MODEL_DIR/onnx.tar.gz" ]; then
    echo "[entrypoint] 未找到模型缓存，开始下载（约90MB，来自 huggingface 镜像）..."
    MIRROR="https://hf-mirror.com/sentence-transformers/all-MiniLM-L6-v2/resolve/main"
    mkdir -p "$MODEL_DIR"
    cd "$MODEL_DIR"

    # 小文件先下
    for f in config.json tokenizer.json vocab.txt special_tokens_map.json; do
        if [ ! -f "$f" ]; then
            curl -fsSL -o "$f" "$MIRROR/$f" && echo "  OK: $f" || echo "  FAIL: $f"
        fi
    done

    # 大文件 model.onnx (~90MB)
    if [ ! -f "model.onnx" ]; then
        echo "  正在下载 model.onnx (约90MB)..."
        curl -fSL --progress-bar -o model.onnx "$MIRROR/onnx/model.onnx" && echo "  OK: model.onnx" || echo "  FAIL: model.onnx"
    fi

    # 打包 onnx.tar.gz
    echo "  打包 onnx.tar.gz..."
    tar czf onnx.tar.gz config.json tokenizer.json vocab.txt special_tokens_map.json model.onnx 2>/dev/null && \
        echo "  OK: onnx.tar.gz ($(du -sh onnx.tar.gz | cut -f1))" || echo "  FAIL: tar"
else
    echo "[entrypoint] 模型缓存已就绪 ($(du -sh $MODEL_DIR/onnx.tar.gz | cut -f1))"
fi

echo "[entrypoint] 启动应用..."
exec "$@"

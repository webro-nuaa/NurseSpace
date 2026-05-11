#!/bin/bash
set -e

MYSQL_HOST=${MYSQL_HOST:-db}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_ROOT_PASSWORD=${MYSQL_PASSWORD:-}

echo "[entrypoint] 等待 MySQL 就绪 (${MYSQL_HOST}:${MYSQL_PORT})..."
MAX_RETRIES=60
RETRY_COUNT=0
until python3 -c "
import pymysql, os
try:
    conn = pymysql.connect(
        host=os.environ.get('MYSQL_HOST', 'db'),
        port=int(os.environ.get('MYSQL_PORT', 3306)),
        user='root',
        password=os.environ.get('MYSQL_PASSWORD', ''),
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

echo "[entrypoint] 初始化数据库..."
python3 -c "
from app import create_app
from models import db
from flask_migrate import upgrade, stamp
from sqlalchemy import inspect

app = create_app()
with app.app_context():
    inspector = inspect(db.engine)
    existing_tables = inspector.get_table_names()
    if not existing_tables:
        db.create_all()
        try:
            stamp()
        except Exception:
            pass
        print('[entrypoint] 数据库表已创建（全新安装）')
    else:
        try:
            upgrade()
            print('[entrypoint] 数据库迁移完成')
        except Exception as e:
            print(f'[entrypoint] 迁移失败: {e}，回退到 create_all')
            db.create_all()
            try:
                stamp()
            except Exception:
                pass
"

echo "[entrypoint] 创建初始管理员账号..."
python3 -c "
import os
from app import create_app
from models import db, User

app = create_app()
with app.app_context():
    admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
    admin_password = os.environ.get('ADMIN_PASSWORD')
    if not admin_password:
        print('[entrypoint] 警告: ADMIN_PASSWORD 未设置，跳过管理员创建')
        exit(0)
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

echo "[entrypoint] 启动应用..."
exec "$@"

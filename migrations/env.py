import os
from logging.config import fileConfig
from alembic import context

config = context.config

# 兼容不同路径下的 alembic.ini
ini_path = config.config_file_name
if ini_path and not os.path.exists(ini_path):
    alt = os.path.join(os.path.dirname(__file__), '..', os.path.basename(ini_path))
    if os.path.exists(alt):
        ini_path = alt
if ini_path:
    fileConfig(ini_path)

# 从 Flask 应用获取元数据
from app import create_app
from models import db

app = create_app()
target_metadata = db.metadata

with app.app_context():
    config.set_main_option('sqlalchemy.url', app.config['SQLALCHEMY_DATABASE_URI'])


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    from models import db as _db
    connectable = _db.engine
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

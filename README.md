# NurseSpace — 智能护士培训系统

基于 Flask + MySQL + Redis 的智能护士培训系统，支持案例学习、AI 评分、错题管理、考试功能和薄弱点分析。

## 目录

- [功能特性](#功能特性)
- [生产部署](#生产部署)
- [配置参考](#配置参考)
- [案例文档格式](#案例文档格式)
- [日常运维](#日常运维)
- [性能调优](#性能调优)
- [常见问题](#常见问题)
- [技术栈](#技术栈)

---

## 功能特性

### 护士端
- 登录认证（Flask-Login Session + JWT Token 双通道）
- 案例浏览与学习进度追踪
- AI 智能评分（支持 OpenAI / 智谱 GLM / 本地匹配三级降级）
- 错题本管理与重做
- AI 薄弱点分析（基于内容诊断，非简单统计）
- 在线考试
- 积分系统
- 评论讨论（答案下交流）

### 管理员端
- 用户管理：注册、启禁、Excel 批量导入
- 案例管理：Word 文档自动解析上传，ZIP/RAR 批量导入，Excel 批量导入
- 考试管理：组卷、发布、成绩查看
- 数据看板：学习进度、错题热力图、科室活跃度
- 群体薄弱点分析
- AI 设置：运行时切换评分 Provider

---

## 生产部署

### 架构

```
                         ┌──────────────┐
                         │   用户浏览器   │
                         └──────┬───────┘
                                │ HTTP :80
                         ┌──────▼───────┐
                         │    Nginx     │  反向代理 + 静态资源
                         │  (1.25-alpine)│  登录限流 5次/分钟
                         └──────┬───────┘
                                │ proxy_pass
                         ┌──────▼───────┐
                         │    Flask     │  :8000
                         │   Gunicorn   │  4 workers × 10 threads
                         │  (gthread)   │  = 40 并发处理能力
                         └──┬─────┬─────┘
                            │     │
                   ┌────────▼─┐ ┌─▼────────┐
                   │  MySQL 8 │ │  Redis 7 │
                   │  :3306   │ │  :6379   │
                   └──────────┘ └──────────┘
```

### 第一步：环境准备

**操作系统要求**：Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / 统信 UOS / openEuler

**硬件要求**（200 并发）：

| 组件 | 最低 | 推荐 |
|------|------|------|
| CPU | 4 核 | 8 核 |
| 内存 | 8 GB | 16 GB |
| 系统盘 | 40 GB SSD | 50 GB SSD |
| 数据盘 | 100 GB SSD | 200 GB SSD |
| 带宽 | 5 Mbps | 10 Mbps |

**安装 Docker**：

```bash
# 方法一：官方脚本（推荐）
curl -fsSL https://get.docker.com | sh

# 方法二：国内镜像加速
curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun

# 启动 Docker
sudo systemctl enable docker
sudo systemctl start docker

# 验证安装
docker --version
# 应输出: Docker version 24.0.x 或更高
```

**配置 Docker 镜像加速**（国内服务器必做）：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

**安装 Docker Compose**：

```bash
# Docker 24+ 已内置 compose 插件，验证：
docker compose version

# 如果没有，安装插件：
sudo apt update && sudo apt install -y docker-compose-plugin

# 或下载独立二进制（适用于非 apt 系统）：
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 第二步：获取代码

```bash
# 上传项目到服务器
# 方式一：git clone
git clone <your-repo-url> /opt/nursespace

# 方式二：scp 上传
scp -r NurseSpace/ user@server:/opt/nursespace

# 方式三：直接用文件管理器上传 NurseSpace 目录到 /opt/nursespace

cd /opt/nursespace
```

### 第三步：配置环境变量

这是最关键的步骤。`.env` 文件包含所有敏感配置，必须先编辑。

```bash
# 从模板创建 .env
cp .env.example .env

# 设置严格权限（只有 owner 可读写）
chmod 600 .env

# 编辑 .env 文件
vim .env
# 或
nano .env
```

**必须修改的项**（`.env` 文件中搜索 `change-me` 即可定位）：

```bash
# 1. 生成 Flask SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(32))"
# 把输出填入 SECRET_KEY=

# 2. 生成 JWT 密钥
python3 -c "import secrets; print(secrets.token_hex(32))"
# 把输出填入 JWT_SECRET_KEY=

# 3. 设置强密码
# MYSQL_PASSWORD=   ← 设置一个复杂密码（至少12位，含大小写字母+数字+符号）
# ADMIN_PASSWORD=   ← 设置管理员初始密码，首次登录后请在后台修改
```

**.env 各配置项说明**：

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `SECRET_KEY` | ✅ | — | Flask session 签名密钥 |
| `JWT_SECRET_KEY` | ✅ | — | JWT Token 签名密钥 |
| `MYSQL_HOST` | — | `db` | MySQL 主机（容器内用服务名） |
| `MYSQL_PORT` | — | `3306` | MySQL 端口 |
| `MYSQL_USER` | — | `nursespace_app` | MySQL 用户名 |
| `MYSQL_PASSWORD` | ✅ | — | MySQL 密码 |
| `MYSQL_DATABASE` | — | `nurse_training_system` | 数据库名 |
| `ADMIN_USERNAME` | — | `admin` | 管理员用户名（仅首次启动创建） |
| `ADMIN_PASSWORD` | ✅ | — | 管理员初始密码 |
| `OPENAI_API_KEY` | — | — | OpenAI API Key（不配则用本地评分） |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | OpenAI 模型名 |
| `ZHIPU_API_KEY` | — | — | 智谱 GLM API Key |
| `ZHIPU_MODEL` | — | `glm-4-air` | 智谱模型名 |
| `DB_POOL_SIZE` | — | `20` | 每个 worker 的连接池大小 |
| `DB_POOL_RECYCLE` | — | `1800` | 连接回收时间（秒） |
| `DB_MAX_OVERFLOW` | — | `10` | 连接池溢出上限 |
| `GUNICORN_WORKERS` | — | `4` | Gunicorn worker 数量 |
| `GUNICORN_THREADS` | — | `10` | 每个 worker 的线程数 |
| `GUNICORN_TIMEOUT` | — | `120` | 请求超时（秒） |
| `REDIS_URL` | — | `redis://redis:6379/0` | 缓存 Redis 地址 |
| `REDIS_ENABLED` | — | `1` | 是否启用 Redis 缓存 |
| `RATELIMIT_ENABLED` | — | `1` | 是否启用速率限制 |
| `JWT_ACCESS_TOKEN_EXPIRES` | — | `3600` | JWT Token 有效期（秒） |

### 第四步：启动服务

```bash
# 确保在 /opt/nursespace 目录下
cd /opt/nursespace

# 构建镜像并启动所有服务
# 首次构建约 3-5 分钟（拉取基础镜像 + 安装依赖）
docker compose build --pull
docker compose up -d

# 查看启动状态（所有服务 STATUS 应为 healthy）
docker compose ps

# 预期输出：
# NAME                STATUS
# nursespace-db-1           healthy
# nursespace-redis-1        healthy
# nursespace-app-1          healthy
# nursespace-nginx-1        healthy
```

**验证部署**：

```bash
# 健康检查
curl http://localhost/api/health

# 预期输出：
# {"database":"connected","service":"nurse_training_system","status":"healthy","version":"1.0.0"}

# 访问登录页
curl -I http://localhost/auth/login
# 应返回 HTTP 200
```

如果服务没有全部 healthy，查看日志：

```bash
# 查看应用日志
docker compose logs app

# 查看数据库日志
docker compose logs db

# 持续监控
docker compose logs -f
```

### 第五步：首次登录

1. 浏览器打开 `http://服务器IP`
2. 使用 `.env` 中设置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录
3. 登录后立即修改密码：右上角用户菜单 → 修改密码

### 第六步：初始化数据库迁移（可选）

```bash
# 如果之前没有 migrations/versions/ 下的迁移文件，生成初始迁移：
docker compose exec app flask db migrate -m "initial"

# 应用迁移：
docker compose exec app flask db upgrade

# 注意：如果跳过此步，entrypoint.sh 会自动使用 db.create_all() 建表
```

### 第七步：上传案例

案例文档需要包含培训内容。四种上传方式：

**方式一：管理员后台 Web 上传**（推荐单文件）
- 登录管理员账号 → 案例管理 → 上传案例 → 选择 .docx 文件

**方式二：批量上传压缩包**（推荐批量导入）
- 管理员后台 → 案例管理 → 批量上传 → 选择 .zip 或 .rar 文件
- 压缩包内直接包含多个 .docx 文件（不支持子目录嵌套）
- 跳过 `__MACOSX` 目录和 `._` 开头的 macOS 影子文件

**方式三：Excel 批量导入**
- 管理员后台 → 案例管理 → 下载 Excel 模板 → 填写后上传
- 适合结构规整的案例数据

**方式四：直接复制到 Docker 卷**
```bash
# 查看案例卷的实际路径
docker volume inspect nursespace_app_cases | grep Mountpoint
# 输出类似: "/var/lib/docker/volumes/nursespace_app_cases/_data"

# 复制案例文件
sudo cp /path/to/your/cases/*.docx /var/lib/docker/volumes/nursespace_app_cases/_data/
```

### 第八步：创建护士账号

**单个创建**：
- 管理员后台 → 用户管理 → 注册新用户

**批量导入**：
- 管理员后台 → 用户管理 → 下载 Excel 模板 → 填写后上传
- Excel 列：用户名、初始密码、真实姓名、科室、邮箱、手机号、角色、状态

### 第九步：配置防火墙和安全组

```bash
# 仅开放必要端口
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS（如已配置证书）
sudo ufw allow 22/tcp     # SSH
sudo ufw enable

# 云服务器还需要在控制台配置安全组规则
# 禁止直接暴露 3306（MySQL）和 6379（Redis）端口
```

---

## 配置参考

### Nginx 限流说明

`nginx/nginx.conf` 中配置了：

| 区域 | 限制 | 说明 |
|------|------|------|
| `/auth/login` | 5次/分钟 | 防暴力破解 |
| 全站 API | 30次/分钟 | 由应用层 Flask-Limiter 处理 |
| 静态资源 | 无限制 | 直接 Nginx 返回，不经过 Flask |

### AI 评分模式

| 模式 | 延迟 | 准确度 | 成本 |
|------|------|--------|------|
| `local` | <100ms | 低（关键词匹配） | 免费 |
| `glm` | 2-5s | 中高 | 按 Token 计费 |
| `openai` | 3-8s | 高 | 按 Token 计费 |

降级链：GLM → OpenAI → 本地匹配（自动切换，确保可用性）

在管理员后台 → AI 设置中可运行时切换 Provider。

---

## 案例文档格式

Word 文档 (.docx) 需要遵循以下标记格式，系统自动解析入库：

### 文件名规范

```
【类别名】案例标题.docx
```

示例：`【儿科模块】新生儿黄疸（东22区新生儿科）.docx`

### 内容结构

```
【案例指引】
这里是案例背景介绍和教学指引...
可以有多行内容。
【案例指引结尾】

【站点】
东22区新生儿科
【站点结尾】

【考核任务】
1. 有条理地采集病史
2. 选择性进行体格评估
3. 制定护理计划
【考核任务结尾】

【问题】
请写出新生儿黄疸的护理评估要点。
【问题结尾】

【回答】
【项】
评估胎龄、日龄与喂养方式
【项结尾】
【项】
评估皮肤黄染范围与程度（经皮胆红素）
【项结尾】
【项】
评估家长对黄疸的认知水平
【项结尾】
【回答结尾】

【知识拓展】
【问题】
病理性黄疸的特点是什么？
【问题结尾】
【回答】
1. 出生24小时内出现
2. 黄疸程度重，进展快
3. 持续时间长（足月儿>2周，早产儿>4周）
4. 直接胆红素升高
【回答结尾】
【知识拓展结尾】
```

### 标记说明

| 标记 | 含义 | 必须 |
|------|------|------|
| `【案例指引】...【案例指引结尾】` | 案例背景介绍 | 否 |
| `【站点】...【站点结尾】` | 站点名称（一个站点一个站点地写） | 是 |
| `【考核任务】...【考核任务结尾】` | 该站点的考核任务描述 | 否 |
| `【问题】...【问题结尾】` | 题目内容（第一个问题作为站点题目） | 是 |
| `【项】...【项结尾】` | 评分项（标准答案的一个采分点） | 是 |
| `【知识拓展】...【知识拓展结尾】` | 扩展知识区（可多个 Q&A） | 否 |

---

## 日常运维

### 服务管理

```bash
# 查看状态
cd /opt/nursespace && docker compose ps

# 重启单个服务
docker compose restart app

# 重启全部
docker compose restart

# 停止
docker compose down

# 停止并清理数据卷（⚠️ 危险，会删除数据库和上传文件）
docker compose down -v
```

### 日志查看

```bash
# 应用日志（实时）
docker compose logs -f --tail=100 app

# 数据库日志
docker compose logs -f --tail=100 db

# Nginx 访问日志
docker compose logs -f --tail=100 nginx

# Gunicorn 错误日志（文件）
docker compose exec app cat /app/logs/error.log
```

### 数据库备份

**手动备份**：

```bash
# 创建备份目录
mkdir -p /opt/nursespace/backups

# 导出数据库
docker compose exec db mysqldump \
  -u root -p"${MYSQL_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  nurse_training_system \
  | gzip > /opt/nursespace/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz

# 备份上传文件
sudo tar czf /opt/nursespace/backups/uploads_$(date +%Y%m%d).tar.gz \
  -C /var/lib/docker/volumes/nursespace_app_uploads/_data .
```

**自动备份（crontab）**：

```bash
# 编辑定时任务
crontab -e

# 添加以下行：
# 每天凌晨 2 点备份数据库
0 2 * * * cd /opt/nursespace && docker compose exec -T db mysqldump -u root -p"YOUR_PASSWORD" --single-transaction nurse_training_system | gzip > /opt/nursespace/backups/db_$(date +\%Y\%m\%d).sql.gz

# 每天凌晨 3 点清理 30 天前的备份
0 3 * * * find /opt/nursespace/backups -name "db_*.sql.gz" -mtime +30 -delete
```

**恢复数据库**：

```bash
# 解压并恢复
gunzip -c /opt/nursespace/backups/db_20260507_020000.sql.gz | \
  docker compose exec -T db mysql -u root -p"${MYSQL_PASSWORD}" nurse_training_system
```

### 更新部署

```bash
cd /opt/nursespace

# 拉取新代码
git pull origin main

# 重新构建并启动
docker compose up -d --build app

# 执行数据库迁移（如有新增）
docker compose exec app flask db upgrade

# 查看是否正常运行
docker compose ps
docker compose logs --tail=20 app
```

### 数据库迁移

```bash
# 生成新迁移（修改模型后）
docker compose exec app flask db migrate -m "描述你的改动"

# 应用迁移
docker compose exec app flask db upgrade

# 回滚一个版本
docker compose exec app flask db downgrade -1

# 查看迁移历史
docker compose exec app flask db history
```

---

## 性能调优

### 200 人并发配置基准

| 配置项 | 值 | 位置 |
|--------|-----|------|
| GUNICORN_WORKERS | 4 | `.env` |
| GUNICORN_THREADS | 10 | `.env` |
| DB_POOL_SIZE | 20 | `.env` |
| DB_MAX_OVERFLOW | 10 | `.env` |
| MySQL max_connections | 300 | `docker-compose.yml` |
| MySQL innodb_buffer_pool_size | 512M | `docker-compose.yml` |
| Nginx proxy_buffers | 16×32k | `nginx/nginx.conf` |

**并发公式**：`workers × threads = 4 × 10 = 40 个并发请求处理能力`

200 用户在线时，通常只有 15-25% 在同时发送请求（阅读题目、打字作答占大部分时间），40 并发绰绰有余。

### 扩容建议

**CPU 升级**：增加 `GUNICORN_WORKERS`（建议不超过 CPU 核数）
**内存升级**：增大 `innodb_buffer_pool_size`（建议设为可用内存的 50-70%）
**AI 频繁调用**：增加 `GUNICORN_THREADS`（AI 是 I/O 等待，线程越多越不阻塞）
**静态资源多**：在前端套 CDN

---

## 常见问题

### 1. 启动后 app 容器反复重启

```bash
# 查看日志定位原因
docker compose logs app

# 常见原因一：.env 中的密码未修改（仍是 change-me）
# 解决：编辑 .env，填入真实值

# 常见原因二：MySQL 连接失败
# 解决：确认 MYSQL_HOST=db，MYSQL_PASSWORD 正确

# 常见原因三：SECRET_KEY 或 JWT_SECRET_KEY 未设置
# 解决：用 python3 -c "import secrets; print(secrets.token_hex(32))" 生成
```

### 2. 数据库连接失败

- 确认 `MYSQL_HOST=db`（Docker 内用服务名，不是 localhost）
- 确认 `.env` 中的 `MYSQL_PASSWORD` 与 docker-compose 一致
- 首次启动 MySQL 需要约 30 秒初始化，app 等待 healthcheck 通过后才启动

### 3. AI 评分不工作

- 确认已配置 `OPENAI_API_KEY` 或 `ZHIPU_API_KEY`
- 确认服务器能访问外网 API（openai.com / open.bigmodel.cn）
- 系统会自动降级到本地文本匹配模式，不会报错

### 4. 文件上传失败

- 检查文件大小 < 128MB（`MAX_CONTENT_LENGTH`）
- Nginx 同步限制为 `client_max_body_size 128m`
- 如需更大，同时修改 `config.py` 和 `nginx/nginx.conf`

### 5. 静态资源 404

- 静态资源由 Nginx 直接返回，通过共享 volume `static_volume` 访问
- 如果图标/CSS 加载失败，检查 `static/` 目录是否完整
- 重启可修复：`docker compose restart app nginx`

### 6. 端口冲突

- 检查 80/443 端口是否被占用：`ss -tlnp | grep -E ':80|:443'`
- 修改 `docker-compose.yml` 中 nginx 的 ports 映射到其他端口

---

## 目录结构

```
NurseSpace/
├── app.py                    # Flask 应用入口（工厂模式）
├── config.py                 # 配置（全部从环境变量读取）
├── models.py                 # 数据模型（14 张表）
├── gunicorn.conf.py          # Gunicorn 生产配置
├── alembic.ini               # Alembic 迁移配置
├── entrypoint.sh             # 容器启动脚本（等待 MySQL + 迁移 + 建管理员）
├── Dockerfile                # 多阶段 Docker 构建
├── docker-compose.yml        # Docker Compose 编排（db + redis + app + nginx）
├── requirements.txt          # Python 依赖
├── run.sh                    # 一键部署脚本
├── .env.example              # 环境变量模板
├── .gitignore                # Git 忽略规则
├── .dockerignore             # Docker 忽略规则
├── database/
│   └── init.sql              # 数据库初始化（建表 + 索引 + 种子数据）
├── nginx/
│   └── nginx.conf            # Nginx 反向代理 + 限流 + 静态资源
├── migrations/               # Alembic 数据库迁移
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── routes/
│   ├── __init__.py
│   ├── auth.py               # 认证（登录/注册/个人信息/密码）
│   ├── nurse.py              # 护士端（案例/答题/错题/薄弱点/考试/积分）
│   ├── admin.py              # 管理员端（用户/案例/考试/统计）
│   ├── api.py                # 公共 API（类别/站点/评论/健康检查）
│   └── main.py               # 页面路由
├── utils/
│   ├── __init__.py
│   ├── ai_evaluator.py       # AI 评分器（OpenAI / GLM / 本地匹配）
│   ├── docx_parser.py        # Word 文档解析器
│   ├── auth.py               # 混合认证装饰器
│   └── decorators.py         # 权限装饰器
├── static/                   # 静态资源（CSS/JS/图片）
│   ├── css/
│   ├── js/
│   └── favicon.ico
└── templates/                # Jinja2 模板
    ├── base.html
    ├── auth/
    ├── admin/
    └── nurse/
```

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 反向代理 | Nginx | 1.25-alpine |
| WSGI 服务器 | Gunicorn (gthread) | 22+ |
| Web 框架 | Flask | 2.3+ |
| ORM | Flask-SQLAlchemy | 3.0+ |
| 数据库迁移 | Flask-Migrate / Alembic | 4.0+ |
| 数据库 | MySQL | 8.0 |
| 缓存 | Redis | 7-alpine |
| 认证 | Flask-Login + Flask-JWT-Extended | — |
| 安全 | Flask-WTF CSRF + Flask-Limiter | — |
| AI 评分 | OpenAI / 智谱 GLM / 本地匹配 | — |
| 文档解析 | python-docx | — |
| 容器化 | Docker + Docker Compose | — |

## 许可证

MIT

# NurseSpace — 智能护士培训系统

基于 Flask + MySQL + Redis 的智能护士培训系统，支持案例学习、AI 评分、语音答题、错题管理、考试功能、二维码分享和薄弱点分析。

> **最新版本：v3.0.8** | 全页面 SPA 架构

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
- 语音答题（Web Speech API，Chrome/Edge 支持）
- 考试二维码分享（移动端扫码答题）

### 管理员端
- 用户管理：注册、启禁、Excel 批量导入
- 案例管理：Word 文档自动解析上传，ZIP/RAR 批量导入，Excel 批量导入
- 考试管理：组卷、发布、成绩查看
- 数据看板：学习进度、错题热力图、科室活跃度
- 群体薄弱点分析
- AI 设置：运行时切换评分 Provider，支持自定义 API Base URL

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
                         │   Gunicorn   │  3 workers × 5 threads
                         │  (gthread)   │  = 15 并发处理能力
                         └──┬─────┬─────┘
                            │     │
                   ┌────────▼─┐ ┌─▼────────┐
                   │  MySQL 8 │ │  Redis 7 │
                   │  :3306   │ │  :6379   │
                   └──────────┘ └──────────┘
```

### 第一步：环境准备

**操作系统要求**：Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / 统信 UOS / openEuler

**硬件要求**（文字型应用，资源需求不高）：

| 规模 | CPU | 内存 | 系统盘 | 带宽 | 月费参考 |
|------|-----|------|--------|------|----------|
| 起步（50人） | 2 核 | 4 GB | 30 GB SSD | 3 Mbps | ~30元 |
| 标准（200人） | 4 核 | 8 GB | 50 GB SSD | 5 Mbps | ~60元 |
| 宽裕（500人+） | 8 核 | 16 GB | 100 GB SSD | 10 Mbps | ~150元 |

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

**必须修改的项**（`.env` 文件中搜索 `change-me` 即可定位，共 6 处）：

```bash
# 1. 生成 Flask SECRET_KEY（用于 session 签名）
python3 -c "import secrets; print(secrets.token_hex(32))"
# 把输出填入 SECRET_KEY=

# 2. 生成 JWT 密钥（用于 Token 签名）
python3 -c "import secrets; print(secrets.token_hex(32))"
# 把输出填入 JWT_SECRET_KEY=

# 3. 生成 ENCRYPTION_KEY（用于加密 DB 中存储的 AI API Key）
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# 把输出填入 ENCRYPTION_KEY=

# 4. 设置强密码（至少 16 位，含大小写字母+数字+特殊字符）
# MYSQL_PASSWORD=   ← 设置数据库密码
# ADMIN_PASSWORD=   ← 设置管理员初始密码，首次登录后请在后台修改
# REDIS_PASSWORD=   ← 设置 Redis 密码

# 5. 设置站点外部 URL（必须！用于生成考试二维码等）
# SITE_URL=https://nurse.hospital.com   ← 替换为实际域名

# 6. 限制 CORS 来源（必须！安全要求）
# CORS_ORIGINS=https://nurse.hospital.com   ← 替换为实际域名，切勿使用 *
```

建议同时确认：

```bash
# 生产环境保持 HTTPS Cookie 安全
SESSION_COOKIE_SECURE=1

# 默认跳过 ChromaDB 模型启动下载，避免外部网络波动阻塞容器启动
SKIP_CHROMA_MODEL_DOWNLOAD=1

# 只有前端和后端跨域且必须携带 Cookie 时才开启；开启时 CORS_ORIGINS 不能为 *
CORS_SUPPORTS_CREDENTIALS=0
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
| `DB_POOL_SIZE` | — | `10` | 每个 worker 的连接池大小 |
| `DB_POOL_RECYCLE` | — | `1800` | 连接回收时间（秒） |
| `DB_MAX_OVERFLOW` | — | `10` | 连接池溢出上限 |
| `GUNICORN_WORKERS` | — | `3` | Gunicorn worker 数量 |
| `GUNICORN_THREADS` | — | `5` | 每个 worker 的线程数 |
| `GUNICORN_TIMEOUT` | — | `120` | 请求超时（秒） |
| `REDIS_URL` | — | `redis://redis:6379/0` | 缓存 Redis 地址 |
| `REDIS_ENABLED` | — | `1` | 是否启用 Redis 缓存 |
| `RATELIMIT_ENABLED` | — | `1` | 是否启用速率限制 |
| `JWT_ACCESS_TOKEN_EXPIRES` | — | `3600` | JWT Token 有效期（秒） |
| `CORS_ORIGINS` | ✅ | — | CORS 允许的来源，生产环境必须设为实际域名 |
| `CORS_SUPPORTS_CREDENTIALS` | — | `0` | 跨域请求是否允许携带 Cookie；开启时 `CORS_ORIGINS` 不能为 `*` |
| `SITE_URL` | ✅ | — | 站点外部 URL（生成考试二维码），生产环境必须设置 |
| `ENCRYPTION_KEY` | ✅ | — | Fernet 密钥（加密 AI API Key），生成方法见上文 |
| `REDIS_PASSWORD` | ✅ | — | Redis 密码（需与 docker-compose.yml 一致） |
| `SKIP_CHROMA_MODEL_DOWNLOAD` | — | `1` | 是否跳过 ChromaDB ONNX 模型启动下载，避免启动依赖外网 |

### 第四步：启动服务

```bash
# 确保在 /opt/nursespace 目录下
cd /opt/nursespace

# 国内服务器：启用国内镜像加速（编辑 .env 设置 USE_CHINA_MIRROR=true）
# 海外服务器 / CICD：保持默认 false
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
# 健康检查（未配置证书前可用本机 HTTP；正式域名建议用 HTTPS）
curl http://localhost/health
# 或：
curl -k https://localhost/health

# 预期输出：
# {"database":"connected","service":"nurse_training_system","status":"healthy","version":"3.0.8"}

# 访问登录页
curl -I http://localhost/auth/login
# 或：
curl -k -I https://localhost/auth/login
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

1. 浏览器打开 `http://服务器IP`；配置正式证书后使用 `https://你的域名`
2. 使用 `.env` 中设置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录
3. 登录后立即修改密码：右上角用户菜单 → 修改密码

### 第六步：确认数据库迁移状态

```bash
# 容器启动时会自动执行迁移。启动后确认当前版本已到 head：
docker compose exec app flask db current

# 确认模型和迁移文件没有漂移：
docker compose exec app flask db check
```

当前仓库已包含 Alembic 迁移文件，生产部署不需要手工生成 `initial` 迁移。若迁移失败，app 容器会启动失败，避免数据库结构不一致时继续对外服务。

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
- 支持自动生成工号和初始密码（按规则随机生成，导入成功后列出账号清单）
- Excel 列：真实姓名、科室、学校、学号、邮箱、手机号、角色、状态

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

## 生产部署前安全检查清单

在对外提供服务前，逐项确认以下内容：

### 密钥与密码

- [ ] `SECRET_KEY` — 已用 `secrets.token_hex(32)` 生成随机值，无 `change-me` 字样
- [ ] `JWT_SECRET_KEY` — 已用 `secrets.token_hex(32)` 生成随机值，与 SECRET_KEY 不同
- [ ] `ENCRYPTION_KEY` — 已用 `Fernet.generate_key()` 生成，与 CI 测试密钥不同
- [ ] `MYSQL_PASSWORD` — 强密码（≥16 位，含大小写字母+数字+特殊字符）
- [ ] `REDIS_PASSWORD` — 强密码，与 MYSQL_PASSWORD 不同
- [ ] `ADMIN_PASSWORD` — 强密码，首次登录后立即在后台修改
- [ ] `.env` 文件权限为 `600`（`chmod 600 .env`）

### 网络安全

- [ ] `SITE_URL` — 已设置为实际域名（如 `https://nurse.hospital.com`），末尾无 `/`
- [ ] `CORS_ORIGINS` — 已设置为实际域名，未使用 `*`
- [ ] `SESSION_COOKIE_SECURE` — 已设置为 `1`（HTTPS 环境下）
- [ ] 防火墙已开启，仅暴露 80/443/22 端口
- [ ] 云服务器安全组已配置，禁止直接暴露 3306/6379/8000 端口
- [ ] 如使用 HTTPS，证书已配置到 Nginx

### 数据库

- [ ] MySQL 数据卷已配置持久化（docker-compose.yml 中 `mysql_data` 卷）
- [ ] 数据库备份脚本已配置（crontab 定时备份）
- [ ] 慢查询日志已开启（默认 >2 秒记录）

### 验证

- [ ] `docker compose ps` 所有服务状态为 `healthy`
- [ ] `curl http://localhost/health` 返回 `{"status":"healthy","database":"connected","redis":"connected","version":"3.0.9"}`
- [ ] `docker compose exec app flask db current` 显示 `92dc4402a201 (head)`
- [ ] `docker compose exec app flask db check` 显示 `No new upgrade operations detected.`
- [ ] 浏览器访问登录页正常加载
- [ ] 管理员账号可以登录
- [ ] AI 设置页面可以正常访问（不再出现 302 重定向）
- [ ] 考试二维码链接正确（包含正确的域名）

### 预发布自动验收

在正式开放访问前，建议在服务器或 CI 上执行以下检查：

```bash
# 单元/接口测试
pytest -q

# 真实浏览器 smoke test（需要 Python playwright 包和 Chrome/Chromium）
python scripts/e2e_smoke.py

# Docker 配置检查
docker compose config --quiet

# 全新数据库启动/迁移演练（隔离 project，不污染默认数据卷）
docker compose -p nursespace_migration_check \
  -f docker-compose.yml -f docker-compose.e2e.yml up -d db redis app

curl -fsS http://localhost:5001/api/health
docker compose -p nursespace_migration_check \
  -f docker-compose.yml -f docker-compose.e2e.yml exec -T app flask db current
docker compose -p nursespace_migration_check \
  -f docker-compose.yml -f docker-compose.e2e.yml exec -T app flask db check

# 清理隔离演练栈
docker compose -p nursespace_migration_check \
  -f docker-compose.yml -f docker-compose.e2e.yml down -v
```

HTTPS / 安全头检查：

```bash
curl -k -I https://localhost/auth/login
```

应能看到 `Strict-Transport-Security`、`Content-Security-Policy`、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`。

### 可选优化

- [ ] 上传案例文档，验证 AI 评分功能正常
- [ ] 创建护士账号，验证学习流程
- [ ] 配置 HTTPS 证书（Let's Encrypt / 购买证书）
- [ ] Nginx 域名已通过 `NGINX_SERVER_NAME` 环境变量配置（`.env` 或 `docker-compose.yml`）

---

## 配置参考

### Nginx 与应用限流说明

`nginx/nginx.conf` 中配置了：

| 区域 | 限制 | 说明 |
|------|------|------|
| `/auth/login` | 5次/分钟 | 防暴力破解 |
| `/admin/`、`/nurse/` | 60次/分钟，burst 20 | Nginx 边界限流 |
| `/admin/cases/upload` | 10次/分钟，burst 3 | 上传入口限流 |
| 应用层登录接口 | 5次/分钟 | Flask-Limiter，生产环境使用 Redis 存储 |
| 静态资源 | 无限制 | 直接 Nginx 返回，不经过 Flask |

### AI 评分模式

| 模式 | 延迟 | 准确度 | 成本 |
|------|------|--------|------|
| `local` | <100ms | 低（关键词匹配） | 免费 |
| `glm` | 2-5s | 中高 | 按 Token 计费 |
| `openai` | 3-8s | 高 | 按 Token 计费 |

降级链：GLM → OpenAI → 本地匹配（自动切换，确保可用性）

在管理员后台 → AI 设置中可运行时切换 Provider，支持自定义 Base URL（兼容第三方 API 代理）。

### 语音答题

答题文本框旁有麦克风按钮，使用浏览器 Web Speech API 将语音转为文字。无需后端支持，零额外成本。

- 需要 Chrome 或 Edge 浏览器
- 需要 HTTPS 或 localhost 环境（浏览器的安全策略）

### 二维码考试

考试发布后可生成二维码，护士用手机扫码即可进入答题页面。

- 二维码指向站点的考试入口地址
- 生产环境必须在 `.env` 中设置 `SITE_URL` 为实际域名，否则二维码链接可能不正确
- 移动端页面已做触屏适配（44px 最小触摸目标，卡片全宽堆叠）

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
# 使用备份脚本（推荐）
bash scripts/backup.sh

# 或备份到指定目录
bash scripts/backup.sh /mnt/backups/nursespace
```

**自动备份（crontab）**：

```bash
# 编辑定时任务
crontab -e

# 每天凌晨 2 点执行备份脚本
0 2 * * * cd /opt/nursespace && bash scripts/backup.sh /opt/nursespace/backups
```

**恢复数据库**：

```bash
# 使用备份脚本恢复
bash scripts/backup.sh --restore /opt/nursespace/backups/backup_20260507_020000.sql.gz

# 或手动恢复
gunzip -c /opt/nursespace/backups/backup_20260507_020000.sql.gz | \
  docker compose exec -T db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" nurse_training_system
```

### 迁移回滚

```bash
# 查看迁移历史
docker compose exec app flask db history

# 回滚最近一个迁移版本
docker compose exec app flask db downgrade -1

# 回滚到指定版本
docker compose exec app flask db downgrade 91dc4402a200

# 回滚后确认状态
docker compose exec app flask db current
```

### 更新部署

```bash
cd /opt/nursespace

# 拉取新代码
git pull origin main

# 重新构建并启动应用
docker compose build app
docker compose up -d app

# app 启动时会自动执行数据库迁移；启动后确认迁移状态
docker compose exec app flask db current
docker compose exec app flask db check

# 查看是否正常运行
docker compose ps
docker compose logs --tail=20 app
curl -fsS http://localhost/health
```

### 数据库迁移

```bash
# 生成新迁移（修改模型后）
docker compose exec app flask db migrate -m "描述你的改动"

# 手动应用迁移（通常由 app 容器启动脚本自动执行）
docker compose exec app flask db upgrade

# 回滚一个版本
docker compose exec app flask db downgrade -1

# 查看迁移历史
docker compose exec app flask db history
```

---

## 性能调优

### 并发配置基准

文字型应用，大部分时间用户在阅读和打字，实际并发请求比例很低（15-25%）。

| 配置项 | 起步（50人） | 标准（200人） | 位置 |
|--------|------------|-------------|------|
| GUNICORN_WORKERS | 2 | 3 | `.env` |
| GUNICORN_THREADS | 3 | 5 | `.env` |
| DB_POOL_SIZE | 5 | 10 | `.env` |
| DB_MAX_OVERFLOW | 5 | 10 | `.env` |
| MySQL max_connections | 100 | 150 | `docker-compose.yml` |
| MySQL innodb_buffer_pool_size | 128M | 256M | `docker-compose.yml` |

**并发公式**：`workers × threads` = 同时处理的请求数。标准配置 3×5=15 并发，200 人在线约 30-50 个同时请求，足够。

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

- `/static/` 由 Nginx 直接从文件系统 serve（`/usr/share/nginx/html/static/`），不经过 Flask
- 如果图标/CSS 加载失败，检查 static 卷挂载：`docker compose exec nginx ls -la /usr/share/nginx/html/static/`
- 确认 `docker-compose.yml` 中 nginx 的 static 卷挂载未注释
- 重启可修复：`docker compose restart nginx`

### 6. 语音输入不工作

- 语音输入使用浏览器的 Web Speech API，需 Chrome 或 Edge
- 如果是生产环境，需要 HTTPS（浏览器安全策略限制）
- 本地开发环境（localhost）不受此限制

### 7. 二维码链接不正确

- 生产环境必须在 `.env` 中设置 `SITE_URL` 为实际域名，如 `https://nurse.hospital.com`
- 未设置时会从请求头自动探测，可能不准确
- 设置后需重启：`docker compose restart app`

### 8. 端口冲突

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
├── docker-compose.e2e.yml    # 隔离部署验收栈（本地 5001 端口）
├── requirements.txt          # Python 依赖
├── run.sh                    # 一键部署脚本
├── .env.example              # 环境变量模板
├── .gitignore                # Git 忽略规则
├── .dockerignore             # Docker 忽略规则
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
├── tests/                    # pytest 测试套件
│   ├── conftest.py
│   ├── test_models.py
│   ├── test_auth.py
│   ├── test_admin_routes.py
│   ├── test_nurse_routes.py
│   ├── test_docx_parser.py
│   ├── test_ai_evaluator.py
│   └── test_security.py
├── utils/
│   ├── __init__.py
│   ├── ai_evaluator.py       # AI 评分器（OpenAI / GLM / 本地匹配）
│   ├── crypto.py             # Fernet 加解密（API Key 安全存储）
│   ├── docx_parser.py        # Word 文档解析器
│   ├── auth.py               # 混合认证装饰器
│   └── decorators.py         # 权限装饰器
├── static/                   # 静态资源（CSS/JS/图片）
│   ├── css/
│   ├── js/
│   └── favicon.svg
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
| 语音识别 | Web Speech API（浏览器端） | — |
| 容器化 | Docker + Docker Compose | — |
| 测试 | pytest + pytest-flask + pytest-cov | — |

---

## 运行测试

```bash
# 安装测试依赖
pip install pytest pytest-flask pytest-cov

# 运行全部测试
pytest -q

# 带覆盖率报告
pytest tests/ --cov=. --cov-report=html

# 运行特定模块
pytest tests/test_models.py -v
pytest tests/test_auth.py -v
```

测试覆盖范围：
- 数据模型创建与关系
- 用户认证（登录/注册/JWT/权限）
- 管理员 CRUD 端点
- 护士端学习流程
- Word 文档解析
- AI 评分与降级
- CSRF/CORS/限流安全
- 真实浏览器 smoke test：`python scripts/e2e_smoke.py`

---

## 许可证

MIT

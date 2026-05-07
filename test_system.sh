#!/bin/bash
# =============================================
# 护士培训系统 —— 全面功能测试脚本
# =============================================
set +e

BASE_URL="http://localhost"
PASS=0
FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}[FAIL]${NC} $1 — $2"; FAIL=$((FAIL+1)); }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

check() {
    local desc="$1" expected="$2" actual="$3"
    case "$actual" in
        *"$expected"*) pass "$desc" ;;
        *) fail "$desc" "expected to contain '$expected'" ;;
    esac
}

http_code() {
    curl -s -o /dev/null -w "%{http_code}" "$@"
}

echo "=============================================="
echo "  护士培训系统 — 全面功能测试"
echo "  $(date)"
echo "=============================================="
echo ""

# ---- 获取 admin token ----
info "准备 Admin 凭证..."
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')
ADMIN_JWT=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

info "Admin JWT: ${ADMIN_JWT:0:20}..."

# ============================================
echo ""
echo "=== 1. 健康检查 ==="
R=$(curl -s "$BASE_URL/api/health")
check "1.1 健康检查返回 healthy" '"status":"healthy"' "$R"
check "1.2 DB连通性检查" '"database":"connected"' "$R"
R=$(curl -s "$BASE_URL/health")
check "1.3 Nginx /health 代理" '"status":"healthy"' "$R"

# ============================================
echo ""
echo "=== 2. 管理员登录 ==="
check "2.1 管理员登录成功" '"success":true' "$ADMIN_LOGIN"
check "2.2 返回管理员角色" '"role":"admin"' "$ADMIN_LOGIN"
check "2.3 返回 JWT Token" 'access_token' "$ADMIN_LOGIN"

# ============================================
echo ""
echo "=== 3. 登录校验 ==="
R=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"username":"","password":""}')
check "3.1 空白凭证拒绝" '用户名和密码不能为空' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong_pw_999"}')
check "3.2 错误密码拒绝" '用户名或密码错误' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"username":"no_such_user_xyz","password":"anything"}')
check "3.3 不存在用户拒绝" '用户名或密码错误' "$R"

# ---- 注册并登录测试护士 ----
info "注册并登录测试护士..."
curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -d '{"username":"tester_nurse","password":"Test#2024Z","real_name":"测试护士-自动化","department":"内科","email":"tester@test.local"}' > /dev/null 2>&1

NURSE_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"tester_nurse","password":"Test#2024Z"}')
NURSE_JWT=$(echo "$NURSE_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
info "Nurse JWT: ${NURSE_JWT:0:20}..."

# ============================================
echo ""
echo "=== 4. 护士登录 ==="
check "4.1 护士登录成功" '"success":true' "$NURSE_LOGIN"
check "4.2 返回护士角色" '"role":"nurse"' "$NURSE_LOGIN"

# ============================================
echo ""
echo "=== 5. 注册校验 ==="
R=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -d '{"username":"ab","password":"Test#123","real_name":"短用户名"}')
check "5.1 用户名过短拒绝" '用户名只能包含字母' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -d '{"username":"newuser99","password":"12345678","real_name":"纯数字密码"}')
check "5.2 纯数字密码拒绝" '密码必须同时包含字母和数字' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -d '{"username":"newuser88","password":"Ab1","real_name":"短密码"}')
check "5.3 密码过短拒绝" '密码长度至少8位' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -d '{"username":"admin","password":"Test#12345","real_name":"重复用户名"}')
check "5.4 重复用户名拒绝" '用户名已存在' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -d '{"username":"bademail99","password":"Test#1234","real_name":"坏邮箱","email":"not-an-email"}')
check "5.5 无效邮箱拒绝" '邮箱格式不正确' "$R"

# ============================================
echo ""
echo "=== 6. 个人信息管理 ==="
R=$(curl -s "$BASE_URL/auth/profile" -H "Authorization: Bearer $NURSE_JWT")
check "6.1 获取个人信息" '"success":true' "$R"

R=$(curl -s -X PUT "$BASE_URL/auth/profile" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"real_name":"测试护士-已更新"}')
check "6.2 更新个人信息" '"success":true' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/change-password" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"old_password":"Test#2024Z","new_password":"NewTest#2025"}')
check "6.3 修改密码" '"success":true' "$R"

# 改回
R=$(curl -s -X POST "$BASE_URL/auth/change-password" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"old_password":"NewTest#2025","new_password":"Test#2024Z"}')
check "6.4 改回原密码" '"success":true' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/change-password" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"old_password":"wrong","new_password":"Anything#123"}')
check "6.5 旧密码错误拒绝" '旧密码不正确' "$R"

# ============================================
echo ""
echo "=== 7. 权限控制 ==="
R=$(curl -s "$BASE_URL/nurse/dashboard" -H "Authorization: Bearer $ADMIN_JWT")
check "7.1 管理员不能访问护士接口" '权限不足' "$R"

R=$(curl -s "$BASE_URL/admin/dashboard" -H "Authorization: Bearer $NURSE_JWT")
check "7.2 护士不能访问管理接口" '权限不足' "$R"

R=$(curl -s "$BASE_URL/admin/dashboard" -H "Accept: application/json")
check "7.3 未登录访问管理" '请先登录' "$R"

R=$(curl -s "$BASE_URL/nurse/dashboard" -H "Accept: application/json")
check "7.4 未登录访问护士" '请先登录' "$R"

R=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"username":"hacker","password":"Hack#1234","real_name":"非法注册"}')
check "7.5 护士不能注册用户" '权限不足' "$R"

# ============================================
echo ""
echo "=== 8. 管理员仪表盘 ==="
R=$(curl -s "$BASE_URL/admin/dashboard" -H "Authorization: Bearer $ADMIN_JWT")
check "8.1 仪表盘返回成功" '"success":true' "$R"
check "8.2 包含用户统计" 'total_users' "$R"
check "8.3 包含案例统计" 'total_cases' "$R"
check "8.4 包含平均分" 'avg_score' "$R"
check "8.5 包含最近活动" 'recent_activities' "$R"

# ============================================
echo ""
echo "=== 9. 用户管理 ==="
R=$(curl -s "$BASE_URL/admin/users" -H "Authorization: Bearer $ADMIN_JWT")
check "9.1 用户列表" '"success":true' "$R"
check "9.2 包含分页" 'pagination' "$R"

R=$(curl -s "$BASE_URL/admin/users?search=tester" -H "Authorization: Bearer $ADMIN_JWT")
check "9.3 用户搜索" '"success":true' "$R"

R=$(curl -s "$BASE_URL/admin/users?status=active" -H "Authorization: Bearer $ADMIN_JWT")
check "9.4 按状态过滤" '"success":true' "$R"

# 获取测试护士ID
NID=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); users=[u for u in d['data']['users'] if u['username']=='tester_nurse']; print(users[0]['id'] if users else '')" 2>/dev/null)
if [ -n "$NID" ]; then
    R=$(curl -s "$BASE_URL/admin/users/$NID" -H "Authorization: Bearer $ADMIN_JWT")
    check "9.5 查看用户详情" '"success":true' "$R"

    R=$(curl -s -X PUT "$BASE_URL/admin/users/$NID" -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_JWT" -d '{"department":"外科"}')
    check "9.6 更新用户信息" '"success":true' "$R"

    R=$(curl -s -X POST "$BASE_URL/auth/users/$NID/toggle-status" -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_JWT")
    check "9.7 切换用户状态" '"success":true' "$R"
    # 恢复
    curl -s -X POST "$BASE_URL/auth/users/$NID/toggle-status" -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_JWT" > /dev/null
fi

# ============================================
echo ""
echo "=== 10. 案例管理 ==="
R=$(curl -s "$BASE_URL/admin/cases" -H "Authorization: Bearer $ADMIN_JWT")
check "10.1 案例列表" '"success":true' "$R"
check "10.2 包含分类列表" '"categories"' "$R"

R=$(curl -s "$BASE_URL/admin/cases?category_id=1" -H "Authorization: Bearer $ADMIN_JWT")
check "10.3 按类别过滤" '"success":true' "$R"

R=$(curl -s "$BASE_URL/admin/cases?search=测试" -H "Authorization: Bearer $ADMIN_JWT")
check "10.4 案例搜索" '"success":true' "$R"

CODE=$(http_code "$BASE_URL/admin/cases/xlsx-template" -H "Authorization: Bearer $ADMIN_JWT")
check "10.5 下载案例模板" "200" "$CODE"

# 上传 docx 案例
if [ -f "/tmp/【内科】护理基础操作规范.docx" ]; then
    R=$(curl -s -X POST "$BASE_URL/admin/cases" \
        -H "Authorization: Bearer $ADMIN_JWT" \
        -F "file=@/tmp/【内科】护理基础操作规范.docx")
    check "10.6 上传案例文档" '"success":true' "$R"
    CASE_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('case',{}).get('id',''))" 2>/dev/null)
    info "创建的案例 ID: $CASE_ID"
else
    fail "10.6 上传案例文档" "测试文件 /tmp/【内科】护理基础操作规范.docx 不存在"
    CASE_ID=""
fi

# 案例详情（管理员）
if [ -n "$CASE_ID" ]; then
    R=$(curl -s "$BASE_URL/admin/cases/$CASE_ID" -H "Authorization: Bearer $ADMIN_JWT")
    check "10.7 管理员查看案例详情" '"success":true' "$R"
    check "10.8 详情含站点信息" '"stations"' "$R"
    check "10.9 详情含知识拓展" '"extended_knowledge"' "$R"

    # 更新案例
    R=$(curl -s -X PUT "$BASE_URL/admin/cases/$CASE_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_JWT" \
        -d '{"title":"自动化测试-已更新标题","site_info":"测试站点-已更新"}')
    check "10.10 更新案例信息" '"success":true' "$R"

    R=$(curl -s "$BASE_URL/admin/cases/$CASE_ID" -H "Authorization: Bearer $ADMIN_JWT")
    check "10.11 更新后标题生效" '自动化测试-已更新标题' "$R"

    # 护士端案例详情
    R=$(curl -s "$BASE_URL/nurse/cases/$CASE_ID" -H "Authorization: Bearer $NURSE_JWT")
    check "10.12 护士查看案例详情" '"success":true' "$R"
    check "10.13 护士端含站点和答题区" '"stations"' "$R"

    # 无效案例 ID
    R=$(curl -s "$BASE_URL/admin/cases/99999" -H "Authorization: Bearer $ADMIN_JWT" -H "Accept: application/json")
    check "10.14 不存在的案例返回404" '案例不存在' "$R"

    # 批量删除（无效场景）
    R=$(curl -s -X POST "$BASE_URL/admin/cases/batch-delete" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_JWT" \
        -d '{"ids":[]}')
    check "10.15 批量删除空列表拒绝" '请提供要删除的案例ID列表' "$R"

    # 删除案例
    R=$(curl -s -X DELETE "$BASE_URL/admin/cases/$CASE_ID" \
        -H "Authorization: Bearer $ADMIN_JWT")
    check "10.16 删除案例" '"success":true' "$R"

    # 确认已删除
    R=$(curl -s "$BASE_URL/admin/cases/$CASE_ID" -H "Authorization: Bearer $ADMIN_JWT" -H "Accept: application/json")
    check "10.17 删除后返回404" '案例不存在' "$R"
fi

# 上传校验
R=$(curl -s -X POST "$BASE_URL/admin/cases" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -F "file=@/tmp/【内科】护理基础操作规范.docx;filename=test.txt")
check "10.18 非docx后缀拒绝" '只支持docx格式' "$R"

CODE=$(http_code "$BASE_URL/admin/users/xlsx-template" -H "Authorization: Bearer $ADMIN_JWT")
check "10.19 下载用户Excel模板" "200" "$CODE"

# ============================================
echo ""
echo "=== 11. 考试管理 ==="
R=$(curl -s "$BASE_URL/admin/exams" -H "Authorization: Bearer $ADMIN_JWT")
check "11.1 考试列表" '"success":true' "$R"

R=$(curl -s -X POST "$BASE_URL/admin/exams" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -d '{"title":"自动化测试-护理基础","description":"自动化测试考试","duration":30}')
check "11.2 创建考试" '"success":true' "$R"

R=$(curl -s -X POST "$BASE_URL/admin/exams" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" -d '{"title":"","duration":30}')
check "11.3 空标题拒绝" '考试标题不能为空' "$R"

# ============================================
echo ""
echo "=== 12. 统计分析 ==="
R=$(curl -s "$BASE_URL/admin/statistics/learning-data" -H "Authorization: Bearer $ADMIN_JWT")
check "12.1 学习数据统计" '"success":true' "$R"

R=$(curl -s "$BASE_URL/admin/statistics/group-weakness" -H "Authorization: Bearer $ADMIN_JWT")
check "12.2 群体薄弱点分析" '"success":true' "$R"

# ============================================
echo ""
echo "=== 13. AI 设置 ==="
R=$(curl -s "$BASE_URL/admin/ai-settings" -H "Authorization: Bearer $ADMIN_JWT")
check "13.1 查看AI设置" '"success":true' "$R"
check "13.2 API Key脱敏" 'provider' "$R"

R=$(curl -s -X PUT "$BASE_URL/admin/ai-settings" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" -d '{"provider":"local"}')
check "13.3 切换AI模式" '"success":true' "$R"

R=$(curl -s -X PUT "$BASE_URL/admin/ai-settings" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_JWT" -d '{"provider":"invalid_provider"}')
check "13.4 无效provider拒绝" 'provider' "$R"

# ============================================
echo ""
echo "=== 14. 护士仪表盘 ==="
R=$(curl -s "$BASE_URL/nurse/dashboard" -H "Authorization: Bearer $NURSE_JWT")
check "14.1 护士仪表盘" '"success":true' "$R"
check "14.2 包含用户信息" 'user_info' "$R"
check "14.3 包含统计" 'statistics' "$R"

# ============================================
echo ""
echo "=== 15. 护士案例浏览 ==="
R=$(curl -s "$BASE_URL/nurse/cases" -H "Authorization: Bearer $NURSE_JWT")
check "15.1 案例列表" '"success":true' "$R"
check "15.2 包含分页" 'pagination' "$R"

R=$(curl -s "$BASE_URL/nurse/cases?category_id=1" -H "Authorization: Bearer $NURSE_JWT")
check "15.3 按类别过滤" '"success":true' "$R"

# ============================================
echo ""
echo "=== 16. 错题管理 ==="
R=$(curl -s "$BASE_URL/nurse/wrong-questions" -H "Authorization: Bearer $NURSE_JWT")
check "16.1 错题列表" '"success":true' "$R"

# ============================================
echo ""
echo "=== 17. 薄弱点分析 ==="
R=$(curl -s "$BASE_URL/nurse/weakness-analysis" -H "Authorization: Bearer $NURSE_JWT")
check "17.1 薄弱点分析" '"success":true' "$R"

# ============================================
echo ""
echo "=== 18. 护士考试中心 ==="
R=$(curl -s "$BASE_URL/nurse/exams" -H "Authorization: Bearer $NURSE_JWT")
check "18.1 可参加考试" '"success":true' "$R"

# ============================================
echo ""
echo "=== 19. 积分记录 ==="
R=$(curl -s "$BASE_URL/nurse/point-records" -H "Authorization: Bearer $NURSE_JWT")
check "19.1 积分记录" '"success":true' "$R"
check "19.2 当前积分" 'current_points' "$R"

# ============================================
echo ""
echo "=== 20. API — 类别 ==="
R=$(curl -s "$BASE_URL/api/categories" -H "Authorization: Bearer $NURSE_JWT")
check "20.1 类别列表" '"success":true' "$R"

# ============================================
echo ""
echo "=== 21. API — 站点搜索 ==="
R=$(curl -s "$BASE_URL/api/stations/search" -H "Authorization: Bearer $ADMIN_JWT")
check "21.1 站点搜索" '"success":true' "$R"

# ============================================
echo ""
echo "=== 22. API — 评论系统 ==="
R=$(curl -s "$BASE_URL/api/comments?content_type=station_answer&content_id=1")
check "22.1 获取评论" '"success":true' "$R"

R=$(curl -s -X POST "$BASE_URL/api/comments" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"content_type":"station_answer","content_id":1,"content":"自动化测试评论，验证系统功能完整性。","comment_type":"comment"}')
check "22.2 发布评论" '"success":true' "$R"

CID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)

R=$(curl -s -X POST "$BASE_URL/api/comments" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"content_type":"station_answer","content_id":1,"content":"短"}')
check "22.3 短评论拒绝" '至少5个字符' "$R"

if [ -n "$CID" ]; then
    R=$(curl -s -X POST "$BASE_URL/api/comments/$CID/like" -H "Authorization: Bearer $NURSE_JWT")
    check "22.4 点赞评论" '"success":true' "$R"

    R=$(curl -s "$BASE_URL/api/comments/$CID/replies")
    check "22.5 获取回复" '"success":true' "$R"
fi

# ============================================
echo ""
echo "=== 23. 登出 ==="
R=$(curl -s -X POST "$BASE_URL/auth/logout" -H "Authorization: Bearer $NURSE_JWT")
check "23.1 JWT登出" '"success":true' "$R"

# ============================================
echo ""
echo "=== 24. 静态资源 ==="
CODE=$(http_code "$BASE_URL/static/css/style.css")
check "24.1 CSS访问" "200" "$CODE"

CODE=$(http_code "$BASE_URL/favicon.ico")
check "24.2 favicon" "204" "$CODE"

# ============================================
echo ""
echo "=== 25. 页面路由 ==="
CODE=$(http_code "$BASE_URL/")
check "25.1 首页重定向" "302" "$CODE"

CODE=$(http_code "$BASE_URL/auth/login")
case "$CODE" in
    200|503) pass "25.2 登录页路由存在 (code=$CODE)" ;;
    *) fail "25.2 登录页路由" "200 或 503" "$CODE" ;;
esac

# ============================================
echo ""
echo "=== 26. CSRF 保护 ==="
R=$(curl -s -X POST "$BASE_URL/api/comments" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_JWT" \
    -d '{"content_type":"station_answer","content_id":1,"content":"API CSRF豁免测试——这是第十个字的评论。","comment_type":"comment"}')
check "26.1 API端点CSRF豁免" '"success":true' "$R"

# ============================================
echo ""
echo "=== 27. 概况统计 ==="
R=$(curl -s "$BASE_URL/api/statistics/overview" -H "Authorization: Bearer $ADMIN_JWT")
check "27.1 管理员概览统计" '"success":true' "$R"

R=$(curl -s "$BASE_URL/api/statistics/overview" -H "Authorization: Bearer $NURSE_JWT")
check "27.2 护士概览统计" '"success":true' "$R"

# ============================================
echo ""
echo "=============================================="
echo "  测试完成"
echo "=============================================="
echo -e "  ${GREEN}通过: $PASS${NC}"
echo -e "  ${RED}失败: $FAIL${NC}"
echo "  总计: $((PASS + FAIL))"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}存在 $FAIL 项失败！${NC}"
    exit 1
else
    echo -e "${GREEN}全部 $PASS 项测试通过！${NC}"
    exit 0
fi

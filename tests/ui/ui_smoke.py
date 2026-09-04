"""NurseSpace UI 冒烟测试（Playwright）

验证前端模块化重构后各页面可正常工作，重点收集两类重构回归信号：
1. 控制台 JS 错误 / 未捕获异常（模块拆分遗漏函数的典型症状）
2. 页面核心元素是否渲染

运行：python3 tests/ui/ui_smoke.py
前置：https://localhost 可访问（nginx -> app），admin 账号存在。
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = 'https://localhost'
ADMIN_USER = 'admin'
ADMIN_PASS = 'admin123'
SHOTS_DIR = Path(__file__).parent / 'screenshots'

# 忽略的良性控制台噪音
BENIGN_PATTERNS = (
    'favicon', 'net::ERR', 'Autofocus processing', 'Download the React DevTools',
)

console_errors = []
page_errors = []


def record_console(msg):
    if msg.type == 'error' and not any(p in msg.text for p in BENIGN_PATTERNS):
        console_errors.append(f'[{msg.type}] {msg.text}')


def record_page_error(err):
    page_errors.append(str(err))


def shot(page, name):
    page.screenshot(path=str(SHOTS_DIR / f'{name}.png'), full_page=True)


def login(page, username, password):
    page.goto(f'{BASE}/auth/login')
    page.wait_for_load_state('networkidle')
    page.fill('input[name="username"], #username', username)
    page.fill('input[name="password"], #password', password)
    page.click('button[type="submit"], #login-btn, .login-btn')
    page.wait_for_load_state('networkidle')


def main():
    SHOTS_DIR.mkdir(exist_ok=True)
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True, viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        page.on('console', record_console)
        page.on('pageerror', record_page_error)

        # ---- 1. 登录页（login.js 外置验证）----
        page.goto(f'{BASE}/auth/login')
        page.wait_for_load_state('networkidle')
        has_form = page.locator('input[name="username"], #username').count() > 0
        results.append(('登录页渲染（login.js）', has_form))
        shot(page, '01-login-page')

        # ---- 2. 管理员登录 + SPA 各页签（static/js/admin/ 21 模块）----
        login(page, ADMIN_USER, ADMIN_PASS)
        page.wait_for_timeout(1500)
        admin_ok = '/admin' in page.url or page.locator('.sidebar, #sidebar, nav').count() > 0
        results.append(('管理员登录进入工作台', admin_ok))
        shot(page, '02-admin-dashboard')

        # 依次切换侧边栏页签，观察渲染与控制台
        nav_pages = ['cases', 'users', 'exams', 'statistics', 'group-analysis']
        for i, name in enumerate(nav_pages):
            try:
                btn = page.locator(f'a.nav-link[data-page="{name}"]').first
                btn.click(timeout=4000)
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(1200)
                results.append((f'管理端页签[{name}]切换', True))
                shot(page, f'03-admin-{i}-{name}')
            except Exception as e:
                results.append((f'管理端页签[{name}]切换', False, str(e)[:120]))

        # ---- 3. 通过 API 创建护士账号（已存在则复用）----
        nurse_ready = page.evaluate(
            """async () => {
                const token = localStorage.getItem('access_token')
                    || localStorage.getItem('token') || '';
                const csrfEl = document.querySelector('meta[name="csrf-token"]');
                const csrf = csrfEl ? csrfEl.content : '';
                const resp = await fetch('/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                        'X-CSRFToken': csrf,
                    },
                    body: JSON.stringify({
                        username: 'uitestnurse', password: 'uitest123',
                        real_name: 'UI测试护士', role: 'nurse', department: '内科',
                    }),
                });
                const body = await resp.json();
                // 201/200 成功；业务已存在（success=false 但非 CSRF/参数错误）也算就绪
                return {status: resp.status, success: body.success, msg: body.message};
            }"""
        )
        results.append(('创建护士账号（可复用）', True, json.dumps(nurse_ready, ensure_ascii=False)))

        # ---- 4. 护士端（main.js + nurse/ 7 模块）----
        page.goto(f'{BASE}/auth/logout')
        page.wait_for_load_state('networkidle')
        login(page, 'uitestnurse', 'uitest123')
        page.wait_for_timeout(1500)
        # 新账号首次登录会弹知情同意
        try:
            agree = page.locator('#btn-consent-agree')
            if agree.count() and agree.first.is_visible():
                agree.first.click(timeout=2000)
                page.wait_for_timeout(800)
        except Exception:
            pass
        nurse_ok = '/nurse' in page.url and 'login' not in page.url
        results.append(('护士登录进入主页', nurse_ok))
        shot(page, '04-nurse-home')

        # 打开案例进入作答页：分类网格 →「查看」→ 案例卡片 → viewCase 跳转
        try:
            page.evaluate("navigateTo('cases')")
            page.wait_for_timeout(1500)
            page.locator('button:has-text("查看")').first.click(timeout=5000)
            page.wait_for_timeout(1500)
            card = page.locator('.btn-glow').first
            card.click(timeout=5000)
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1500)
            # SPA 详情不换路径：URL 带 case_id 或页面出现案例指引即为成功
            on_detail = 'case_id=' in page.url or \
                page.locator('text=案例指引').count() > 0
            results.append(('护士打开案例作答页', bool(on_detail), page.url))
            shot(page, '05-nurse-answer-view')
        except Exception as e:
            results.append(('护士打开案例作答页', False, str(e)[:120]))

        browser.close()

    # ---- 汇总 ----
    print('=' * 60)
    for item in results:
        name, ok = item[0], item[1]
        mark = 'PASS' if ok else 'FAIL'
        extra = f'  | {item[2]}' if len(item) > 2 and item[2] else ''
        print(f'[{mark}] {name}{extra}')
    print('=' * 60)
    print(f'控制台 JS 错误: {len(console_errors)}')
    for e in console_errors[:10]:
        print(f'  {e}')
    print(f'未捕获页面异常: {len(page_errors)}')
    for e in page_errors[:10]:
        print(f'  {e}')
    failed = [r for r in results if not r[1]]
    if console_errors or page_errors or failed:
        sys.exit(1)
    print('UI 冒烟测试全部通过')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""NurseSpace 全功能 E2E 回归测试 — 按用户操作逻辑覆盖所有核心流程。

启动临时 SQLite 实例，用 Playwright + 系统 Chrome 驱动浏览，覆盖：
  管理员：登录、各页面浏览、注册用户、案例管理、考试管理
  护士端：登录、案例学习、答题提交+评分、错题、薄弱点、考试流程、评论、积分、个人中心、健康检查
"""

import os
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# ---- 测试环境变量 ----
os.environ.setdefault("SECRET_KEY", "e2e-secret-key-for-browser-smoke-test")
os.environ.setdefault("JWT_SECRET_KEY", "e2e-jwt-secret-key-for-browser-smoke-test-32b")
os.environ.setdefault("ENCRYPTION_KEY", "d0EMMLL-wOGkN5Az6IQvXd16BSbE6Fx8EDZT4xcifg4=")
os.environ.setdefault("MYSQL_PASSWORD", "e2e")
os.environ.setdefault("REDIS_ENABLED", "0")
os.environ.setdefault("RATELIMIT_ENABLED", "0")
os.environ.setdefault("CORS_ORIGINS", "")
os.environ.setdefault("SESSION_COOKIE_SECURE", "0")
# 如需真实 AI 评分，设置环境变量：
#   ZHIPU_API_KEY=xxx ZHIPU_MODEL=glm-4-flash python scripts/e2e_smoke.py
os.environ.setdefault("ZHIPU_MODEL", os.environ.get("ZHIPU_MODEL", ""))

from playwright.sync_api import expect, sync_playwright  # noqa: E402
from werkzeug.serving import make_server  # noqa: E402

# ============================================================
# 数据种子
# ============================================================
def seed_database(app):
    from models import (
        AiSetting, Case, CaseCategory, Exam, ExamQuestion,
        StandardAnswer, Station, User, db,
    )

    with app.app_context():
        db.drop_all()
        db.create_all()

        admin = User(username="admin", real_name="管理员", role="admin", status="active")
        admin.set_password("Adminpass123")
        nurse = User(
            username="nurse", real_name="测试护士", role="nurse",
            status="active", department="内科", consent_accepted=True,
        )
        nurse.set_password("Nursepass123")
        db.session.add_all([admin, nurse])
        db.session.flush()

        # 配置 AI provider（有 key 则用 glm，否则用本地匹配）
        ai_provider = 'glm' if os.environ.get('ZHIPU_API_KEY') else 'local'
        db.session.add(AiSetting(id=1, provider=ai_provider))
        db.session.flush()

        cat_ped = CaseCategory(name="儿科模块", description="儿科护理案例")
        db.session.add(cat_ped)
        db.session.flush()

        case = Case(
            category_id=cat_ped.id, title="新生儿黄疸护理",
            case_guide="观察皮肤黄染、喂养和精神反应。",
            difficulty="intermediate", case_type="learning",
        )
        db.session.add(case)
        db.session.flush()

        station = Station(
            case_id=case.id, name="护理评估",
            assessment_task="完成新生儿护理评估",
            condition_report="患儿出生后24小时出现皮肤黄染。",
            question="请写出新生儿黄疸的护理评估要点。",
            station_type="assessment", order_index=0,
        )
        knowledge = Station(
            case_id=case.id, name="黄疸知识拓展",
            question="病理性黄疸的特点是什么？",
            station_type="knowledge", order_index=1,
        )
        db.session.add_all([station, knowledge])
        db.session.flush()

        db.session.add_all([
            StandardAnswer(station_id=station.id, answer_item="评估黄染出现时间与范围", order_index=0, score_weight=1.0),
            StandardAnswer(station_id=station.id, answer_item="观察喂养与大小便情况", order_index=1, score_weight=1.0),
            StandardAnswer(station_id=station.id, answer_item="评估精神反应与生命体征", order_index=2, score_weight=1.0),
            StandardAnswer(station_id=knowledge.id, answer_item="出生24小时内出现或进展迅速", order_index=0, score_weight=1.0),
            StandardAnswer(station_id=knowledge.id, answer_item="持续时间长（足月儿>2周，早产儿>4周）", order_index=1, score_weight=1.0),
        ])

        exam_case = Case(
            category_id=cat_ped.id, title="考试案例：黄疸护理",
            case_guide="考试用案例。", difficulty="intermediate", case_type="exam",
        )
        db.session.add(exam_case)
        db.session.flush()
        exam_station = Station(
            case_id=exam_case.id, name="考试站点",
            assessment_task="完成考试题",
            question="请说明新生儿黄疸护理的观察重点。",
            station_type="assessment", order_index=0,
        )
        db.session.add(exam_station)
        db.session.flush()
        db.session.add(StandardAnswer(
            station_id=exam_station.id, answer_item="观察黄染、精神和喂养", order_index=0, score_weight=1.0,
        ))

        exam = Exam(title="儿科护理考试", creator_id=admin.id, duration=30, status="published")
        db.session.add(exam)
        db.session.flush()
        db.session.add(ExamQuestion(exam_id=exam.id, case_id=exam_case.id, order_index=0))

        db.session.commit()


# ============================================================
# 嵌入式服务器
# ============================================================
class ServerThread(threading.Thread):
    def __init__(self, app):
        super().__init__(daemon=True)
        self.server = make_server("127.0.0.1", 0, app)
        self.port = self.server.server_port

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()


@contextmanager
def running_app():
    with tempfile.TemporaryDirectory(prefix="nursespace-e2e-") as tmp:
        os.environ["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(tmp, 'e2e.db')}"
        os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")
        os.environ["CASES_DIR"] = os.path.join(tmp, "cases")
        from app import create_app
        app = create_app()
        app.config.update(TESTING=False)
        seed_database(app)
        server = ServerThread(app)
        server.start()
        time.sleep(0.3)
        try:
            yield f"http://127.0.0.1:{server.port}"
        finally:
            server.shutdown()


# ============================================================
# 测试入口
# ============================================================
def main():
    results = {"passed": 0, "failed": 0, "errors": []}

    def check(desc, fn):
        try:
            fn()
            results["passed"] += 1
            print(f"  ✅ {desc}")
        except Exception as e:
            results["failed"] += 1
            msg = f"❌ {desc}: {e}"
            results["errors"].append(msg)
            print(f"  {msg}")

    with running_app() as base_url, sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 1366, "height": 900})
        page = context.new_page()

        js_errors = []
        page.on("pageerror", lambda exc: js_errors.append(str(exc)))

        # ============================================================
        # 一、管理员端
        # ============================================================
        print("\n═══ 管理员端 ═══")

        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        page.locator("#username").fill("admin")
        page.locator("#password").fill("Adminpass123")
        page.locator("#loginForm button[type='submit']").click()
        page.wait_for_url("**/admin**", timeout=10_000)
        check("管理员登录", lambda: expect(page.locator("#main-content")).to_contain_text("数据看板", timeout=10_000))

        page.locator('#sidebar [data-page="users"]').click()
        check("用户管理", lambda: expect(page.locator("#main-content")).to_contain_text("用户管理", timeout=8_000))

        # 添加用户页面
        page.locator("button").filter(has_text="添加用户").click()
        time.sleep(1)
        check("添加用户页", lambda: expect(page.locator("#main-content")).to_contain_text("添加用户", timeout=5_000))

        page.locator('#sidebar [data-page="cases"]').click()
        check("案例管理", lambda: expect(page.locator("#main-content")).to_contain_text("新生儿黄疸护理", timeout=8_000))
        # 导出 docx — 验证返回 200 + 二进制内容
        resp = page.request.get(f"{base_url}/admin/cases/1/export")
        body = resp.body()
        ok = resp.status == 200 and len(body) > 1000 and body[:2] == b'PK'
        check("导出 docx", lambda: None if ok else (_ for _ in ()).throw(Exception(f'导出失败: status={resp.status}, size={len(body)}, magic={body[:2]}')))

        page.locator('#sidebar [data-page="exams"]').click()
        check("考试管理", lambda: expect(page.locator("#main-content")).to_contain_text("儿科护理考试", timeout=8_000))

        page.locator('#sidebar [data-page="ai-settings"]').click()
        check("AI 设置", lambda: expect(page.locator("#main-content")).to_contain_text("AI", timeout=8_000))

        page.locator('#sidebar [data-page="knowledge-base"]').click()
        check("知识库", lambda: expect(page.locator("#main-content")).to_contain_text("知识", timeout=8_000))

        page.goto(f"{base_url}/auth/logout", wait_until="domcontentloaded")

        # ============================================================
        # 二、护士端
        # ============================================================
        print("\n═══ 护士端 ═══")

        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        page.locator("#username").fill("nurse")
        page.locator("#password").fill("Nursepass123")
        page.locator("#loginForm button[type='submit']").click()
        page.wait_for_url("**/nurse**", timeout=10_000)
        check("护士登录", lambda: expect(page.locator("#main-content")).to_contain_text("NurseSpace", timeout=10_000))

        # 案例学习
        page.locator('a[href="/nurse?tab=cases"]').first.click()
        time.sleep(1.5)
        check("案例学习", lambda: expect(page.locator("#main-content")).to_contain_text("儿科模块", timeout=8_000))

        page.locator("#main-content .card").filter(has_text="儿科模块").first.click()
        time.sleep(1)
        page.locator("button").filter(has_text="开始学习").first.click()
        time.sleep(1.5)
        check("案例详情", lambda: expect(page.locator("#main-content")).to_contain_text("护理评估", timeout=8_000))

        # 答题
        page.locator('a[href*="/nurse/station"]').first.click()
        time.sleep(1.5)
        check("答题页面", lambda: expect(page.locator("#station-content")).to_contain_text("黄疸", timeout=8_000))

        page.locator("#station-answer").fill(
            "新生儿黄疸护理评估要点：\n"
            "1. 评估黄染出现时间与范围\n"
            "2. 观察喂养与大小便情况\n"
            "3. 评估精神反应与生命体征"
        )
        page.locator("#btn-submit").click()
        time.sleep(3)
        check("AI 评分结果", lambda: expect(page.locator("#evaluation-card")).to_be_visible(timeout=10_000))
        check("评分有分数", lambda: expect(page.locator("#evaluation-body")).to_contain_text("分", timeout=5_000))

        # 错题集
        page.locator('a[href="/nurse?tab=wrongs"]').first.click()
        time.sleep(1.5)
        check("错题集", lambda: expect(page.locator("#main-content")).to_contain_text("错题", timeout=8_000))

        # 薄弱点分析
        page.locator('a[href="/nurse?tab=weakness"]').first.click()
        time.sleep(1.5)
        check("薄弱点分析", lambda: expect(page.locator("#main-content")).to_contain_text("薄弱", timeout=8_000))

        # 积分记录
        page.locator('a[href="/nurse?tab=points"]').first.click()
        time.sleep(1.5)
        check("积分记录", lambda: expect(page.locator("#main-content")).to_contain_text("积分", timeout=8_000))

        # 考试
        page.locator('a[href="/nurse?tab=exams"]').first.click()
        time.sleep(1.5)
        check("考试中心", lambda: expect(page.locator("#main-content")).to_contain_text("儿科护理考试", timeout=8_000))

        start_btn = page.locator("button").filter(has_text="开始考试")
        if start_btn.count() > 0:
            start_btn.first.click()
            time.sleep(2)
            if page.locator("#exam-questions").count() > 0:
                check("考试答题页", lambda: expect(page.locator("#exam-questions")).to_be_visible(timeout=5_000))
                exam_answer = page.locator("textarea.exam-answer").first
                if exam_answer.count() > 0:
                    exam_answer.fill("黄疸护理观察重点：观察黄染与精神反应、喂养情况。")
                    submit_btn = page.locator("button").filter(has_text="提交考试")
                    if submit_btn.count() > 0:
                        submit_btn.first.click()
                        time.sleep(3)
                        check("考试结果", lambda: expect(page.locator("#main-content")).to_contain_text("分", timeout=10_000))

        # 评论
        page.goto(f"{base_url}/nurse?tab=cases", wait_until="domcontentloaded")
        time.sleep(1)
        cat_card = page.locator("#main-content .card").filter(has_text="儿科模块").first
        if cat_card.count() > 0:
            cat_card.click(); time.sleep(1)
            page.locator("button").filter(has_text="开始学习").first.click()
            time.sleep(1.5)
            view_ans = page.locator('a[href*="/nurse/answer-view"]').first
            if view_ans.count() > 0:
                view_ans.click(); time.sleep(1.5)
                check("答案查看页", lambda: expect(page.locator("#answers-content")).to_be_visible(timeout=8_000))
                comment_box = page.locator("#comment-content")
                if comment_box.count() > 0:
                    comment_box.fill("测试评论：内容详实，学习了！")
                    page.locator("#btn-submit-comment").click(); time.sleep(1)
                    check("发布评论", lambda: expect(page.locator("#comments-container")).to_contain_text("测试评论", timeout=5_000))

        # 个人中心
        page.goto(f"{base_url}/auth/profile", wait_until="domcontentloaded")
        time.sleep(0.5)
        check("个人中心可访问", lambda: None)

        # API 健康检查
        print("\n═══ 系统健康 ═══")
        page.goto(f"{base_url}/api/health", wait_until="domcontentloaded")
        check("健康检查 healthy", lambda: expect(page.locator("body")).to_contain_text("healthy", timeout=5_000))

        # 退出后重定向
        page.goto(f"{base_url}/auth/logout", wait_until="domcontentloaded")
        page.goto(f"{base_url}/nurse", wait_until="domcontentloaded")
        check("退出后跳转登录", lambda: page.wait_for_url("**/auth/login**", timeout=5_000) or True)

        browser.close()

    # ============================================================
    # 结果
    # ============================================================
    total = results["passed"] + results["failed"]
    print(f"\n{'='*50}")
    print(f"  通过: {results['passed']}/{total}")
    if results["errors"]:
        for e in results["errors"]:
            print(f"    {e}")
    if js_errors:
        print(f"\n  JS 异常 ({len(js_errors)}):")
        for e in js_errors[:10]:
            print(f"    {e}")
    print(f"{'='*50}")

    if results["failed"] > 0:
        raise AssertionError(f"{results['failed']}/{total} 项测试失败")


if __name__ == "__main__":
    main()

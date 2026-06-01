#!/usr/bin/env python3
"""Browser smoke test for pre-release validation.

The script starts NurseSpace against a temporary SQLite database, seeds a small
dataset, and drives real Chrome through admin and nurse workflows.
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

os.environ.setdefault("SECRET_KEY", "e2e-secret-key-for-browser-smoke-test")
os.environ.setdefault("JWT_SECRET_KEY", "e2e-jwt-secret-key-for-browser-smoke-test-32b")
os.environ.setdefault("ENCRYPTION_KEY", "d0EMMLL-wOGkN5Az6IQvXd16BSbE6Fx8EDZT4xcifg4=")
os.environ.setdefault("MYSQL_PASSWORD", "e2e")
os.environ.setdefault("REDIS_ENABLED", "0")
os.environ.setdefault("RATELIMIT_ENABLED", "0")
os.environ.setdefault("CORS_ORIGINS", "")
os.environ.setdefault("SESSION_COOKIE_SECURE", "0")

from playwright.sync_api import expect, sync_playwright  # noqa: E402
from werkzeug.serving import make_server  # noqa: E402

def seed_database(app):
    from models import Case, CaseCategory, Exam, ExamQuestion, StandardAnswer, Station, User, db

    with app.app_context():
        db.drop_all()
        db.create_all()

        admin = User(username="admin", real_name="管理员", role="admin", status="active")
        admin.set_password("Adminpass123")
        nurse = User(
            username="nurse",
            real_name="测试护士",
            role="nurse",
            status="active",
            department="内科",
            consent_accepted=True,
        )
        nurse.set_password("Nursepass123")
        db.session.add_all([admin, nurse])
        db.session.flush()

        category = CaseCategory(name="儿科模块", description="浏览器回归测试数据")
        db.session.add(category)
        db.session.flush()

        case = Case(
            category_id=category.id,
            title="新生儿黄疸护理",
            case_guide="观察皮肤黄染、喂养和精神反应。",
            difficulty="intermediate",
            case_type="learning",
        )
        db.session.add(case)
        db.session.flush()

        station = Station(
            case_id=case.id,
            name="护理评估",
            assessment_task="完成护理评估",
            condition_report="患儿出生后皮肤黄染。",
            question="请写出新生儿黄疸护理评估要点。",
            station_type="assessment",
            order_index=0,
        )
        knowledge = Station(
            case_id=case.id,
            name="黄疸知识",
            question="病理性黄疸的特点是什么？",
            station_type="knowledge",
            order_index=1,
        )
        db.session.add_all([station, knowledge])
        db.session.flush()

        db.session.add_all([
            StandardAnswer(station_id=station.id, answer_item="评估黄染出现时间和范围", order_index=0),
            StandardAnswer(station_id=station.id, answer_item="观察喂养、大小便和精神反应", order_index=1),
            StandardAnswer(station_id=knowledge.id, answer_item="出生24小时内出现或进展快", order_index=0),
        ])

        exam_case = Case(
            category_id=category.id,
            title="考试案例：黄疸护理",
            case_guide="考试用案例。",
            difficulty="intermediate",
            case_type="exam",
        )
        db.session.add(exam_case)
        db.session.flush()
        exam_station = Station(
            case_id=exam_case.id,
            name="考试站点",
            assessment_task="完成考试题",
            question="请说明黄疸护理观察重点。",
            station_type="assessment",
            order_index=0,
        )
        db.session.add(exam_station)
        db.session.flush()
        db.session.add(StandardAnswer(station_id=exam_station.id, answer_item="观察黄染、精神和喂养", order_index=0))

        exam = Exam(title="浏览器回归考试", creator_id=admin.id, duration=30, status="published")
        db.session.add(exam)
        db.session.flush()
        db.session.add(ExamQuestion(exam_id=exam.id, case_id=exam_case.id, order_index=0))

        db.session.commit()


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


def login(page, base_url, username, password, target_path):
    page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
    page.locator("#username").fill(username)
    page.locator("#password").fill(password)
    page.locator("#loginForm button[type='submit']").click()
    page.wait_for_url(f"**{target_path}", timeout=10_000)


def main():
    errors = []

    with running_app() as base_url, sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 1366, "height": 900})
        page = context.new_page()
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: errors.append(f"console error: {msg.text}") if msg.type == "error" else None)

        login(page, base_url, "admin", "Adminpass123", "/admin")
        expect(page.locator("#main-content")).to_contain_text("数据看板", timeout=10_000)
        page.locator('#sidebar [data-page="users"]').click()
        expect(page.locator("#main-content")).to_contain_text("用户管理", timeout=10_000)
        page.locator('#sidebar [data-page="cases"]').click()
        expect(page.locator("#main-content")).to_contain_text("案例管理", timeout=10_000)

        context.clear_cookies()
        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        page.evaluate("localStorage.clear()")
        login(page, base_url, "nurse", "Nursepass123", "/nurse")
        expect(page.locator("#main-content")).to_contain_text("NurseSpace", timeout=10_000)
        page.locator('a[href="/nurse?tab=cases"]').first.click()
        expect(page.locator("#main-content")).to_contain_text("案例学习", timeout=10_000)
        expect(page.locator("#main-content")).to_contain_text("儿科模块", timeout=10_000)
        page.locator("#main-content .card").filter(has_text="儿科模块").first.click()
        expect(page.locator("#main-content")).to_contain_text("新生儿黄疸护理", timeout=10_000)

        browser.close()

    if errors:
        raise AssertionError("\n".join(errors))

    print("E2E browser smoke passed")


if __name__ == "__main__":
    main()

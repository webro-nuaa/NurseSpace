"""调试探针：重现 test_delete_station / test_toggle_user_status 失败的真实响应。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from models import db, Station, User, CaseCategory, Case  # noqa: E402
from flask_jwt_extended import create_access_token  # noqa: E402

app = create_app()
app.config.update(TESTING=True, WTF_CSRF_ENABLED=False, SECRET_KEY='s',
                  SQLALCHEMY_DATABASE_URI=os.environ.get('SQLALCHEMY_DATABASE_URI',
                  f"mysql+pymysql://nursespace_app:{os.environ.get('MYSQL_PASSWORD')}@db/nurse_training_test?charset=utf8mb4"))
app.json.ensure_ascii = False
ctx = app.app_context()
ctx.push()
db.create_all()

admin = User(username='admin1', real_name='A', role='admin', status='active')
admin.set_password('x12345678')
db.session.add(admin)
db.session.commit()

cat = CaseCategory(name='调试分类')
db.session.add(cat)
db.session.commit()
case = Case(category_id=cat.id, title='调试案例', case_guide='g')
db.session.add(case)
db.session.commit()
from models import StandardAnswer
s1 = Station(case_id=case.id, name='站点1', assessment_task='考核任务1', question='问题1？', order_index=0)
db.session.add(s1)
db.session.flush()
db.session.add(StandardAnswer(station_id=s1.id, answer_item='答案1', score_weight=1.0, order_index=0))
db.session.commit()
station = Station(case_id=case.id, name='待删除站点', question='问题？', order_index=99)
db.session.add(station)
db.session.commit()

with app.test_client() as client:
    token = create_access_token(identity=str(admin.id),
                                additional_claims={'v': admin.token_version or 0})
    h = {'Authorization': f'Bearer {token}'}

    # 场景1：删除站点（镜像 sample_case 结构）
    r1 = client.delete(f'/admin/cases/{case.id}/stations/{station.id}', headers=h)
    print('delete_station ->', r1.status_code, r1.get_json())

    # 场景2：停用/启用用户（真实路由 /auth/users/<id>/toggle-status）
    nurse = User(username='nurse1', real_name='N', role='nurse', status='active')
    nurse.set_password('x12345678')
    db.session.add(nurse)
    db.session.commit()
    r2 = client.post(f'/auth/users/{nurse.id}/toggle-status', headers=h)
    print('toggle_status ->', r2.status_code, r2.get_json())

db.session.rollback()
db.engine.dispose()
db.drop_all()
ctx.pop()

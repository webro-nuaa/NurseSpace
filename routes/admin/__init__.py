from flask import Blueprint

admin_bp = Blueprint('admin', __name__)

# Import sub-modules to register all routes
from routes.admin import dashboard  # noqa: E402,F401
from routes.admin import users  # noqa: E402,F401
from routes.admin import cases  # noqa: E402,F401
from routes.admin import stations  # noqa: E402,F401
from routes.admin import exams  # noqa: E402,F401
from routes.admin import knowledge  # noqa: E402,F401
from routes.admin import media  # noqa: E402,F401
from routes.admin import asr  # noqa: E402,F401

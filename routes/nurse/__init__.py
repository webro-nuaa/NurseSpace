from flask import Blueprint

nurse_bp = Blueprint('nurse', __name__)

# Import sub-modules to register all routes
from routes.nurse import dashboard  # noqa: E402,F401
from routes.nurse import cases  # noqa: E402,F401
from routes.nurse import learning  # noqa: E402,F401
from routes.nurse import exams  # noqa: E402,F401
from routes.nurse import knowledge  # noqa: E402,F401

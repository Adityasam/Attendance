import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SECRET_KEY = os.environ.get('SECRET_KEY', 'arch-attendance-secret-2024')
DATABASE = os.path.join(BASE_DIR, 'db.sqlite3')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB

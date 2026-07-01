import os
import sqlite3
from flask import Flask, g, send_from_directory
from config import DATABASE, SECRET_KEY, UPLOAD_FOLDER

def create_app():
    app = Flask(__name__)
    app.secret_key = SECRET_KEY
    app.config['DATABASE'] = DATABASE
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['PERMANENT_SESSION_LIFETIME'] = 60 * 60 * 24 * 30

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    def get_db():
        if 'db' not in g:
            g.db = sqlite3.connect(
                app.config['DATABASE'],
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            g.db.row_factory = sqlite3.Row
        return g.db

    def close_db(e=None):
        db = g.pop('db', None)
        if db is not None:
            db.close()

    app.teardown_appcontext(close_db)

    # Make get_db available via app context
    app.get_db = get_db

    from routes.auth import auth_bp
    from routes.employees import employees_bp
    from routes.projects import projects_bp
    from routes.attendance import attendance_bp
    from routes.settings import settings_bp
    from routes.pages import pages_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(employees_bp, url_prefix='/api/employees')
    app.register_blueprint(projects_bp, url_prefix='/api/projects')
    app.register_blueprint(attendance_bp, url_prefix='/api/attendance')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(pages_bp)

    @app.route('/sw.js')
    def service_worker():
        return send_from_directory('static', 'sw.js',
                                   mimetype='application/javascript')

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

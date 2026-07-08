from flask import Blueprint, request, session, redirect, url_for, jsonify, render_template
from routes.db_helper import query, execute
from werkzeug.security import check_password_hash
import functools

auth_bp = Blueprint('auth', __name__)


def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated


PAGE_ROUTE_MAP = {
    'PG-00001': 'pages.dashboard',
    'PG-00002': 'pages.attendance',
    'PG-00003': 'pages.employees',
    'PG-00004': 'pages.projects',
    'PG-00005': 'pages.settings',
}


def page_access_required(page_code):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if session.get('is_admin'):
                return f(*args, **kwargs)
            allowed = session.get('allowed_pages')
            if allowed is None:
                rows = query('SELECT PageCode FROM main_pageaccess WHERE UserId=?',
                             (session.get('user_id'),))
                allowed = [r['PageCode'] for r in rows]
                session['allowed_pages'] = allowed
            if page_code not in allowed:
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'Access denied'}), 403
                for pc in allowed:
                    if pc in PAGE_ROUTE_MAP and pc != page_code:
                        return redirect(url_for(PAGE_ROUTE_MAP[pc]))
                return redirect(url_for('auth.login'))
            return f(*args, **kwargs)
        return decorated
    return decorator


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        user_id = data.get('username', '').strip()
        password = data.get('password', '').strip()

        user = query(
            'SELECT * FROM main_myuser WHERE UserId=? AND Active=1 AND Deleted=0',
            (user_id,), one=True
        )

        if user and user['Password'] == password:
            session.clear()
            session.permanent = True
            session['user_id'] = user['UserId']
            session['user_name'] = user['Name']
            session['is_admin'] = bool(user['IsAdmin'])

            if session['is_admin']:
                session['allowed_pages'] = ['PG-00001', 'PG-00002', 'PG-00003', 'PG-00004', 'PG-00005']
            else:
                rows = query('SELECT PageCode FROM main_pageaccess WHERE UserId=?', (user['UserId'],))
                session['allowed_pages'] = [r['PageCode'] for r in rows]

            if request.is_json:
                return jsonify({'success': True, 'name': user['Name'], 'is_admin': bool(user['IsAdmin'])})
            return redirect(url_for('pages.dashboard'))

        if request.is_json:
            return jsonify({'error': 'Invalid credentials'}), 401
        return render_template('login.html', error='Invalid credentials')

    if 'user_id' in session:
        return redirect(url_for('pages.dashboard'))
    return render_template('login.html')


@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))


@auth_bp.route('/api/auth/me')
def me():
    if 'user_id' not in session:
        return jsonify({'authenticated': False}), 401
    return jsonify({
        'authenticated': True,
        'user_id': session['user_id'],
        'user_name': session['user_name'],
        'is_admin': session.get('is_admin', False)
    })

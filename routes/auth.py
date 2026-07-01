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

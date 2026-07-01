from flask import Blueprint, request, jsonify, session
from routes.db_helper import query, execute
from routes.auth import login_required

settings_bp = Blueprint('settings', __name__)


# ── Users ──────────────────────────────────────────────────────────────────

@settings_bp.route('/users', methods=['GET'])
@login_required
def list_users():
    rows = query('SELECT id, UserId, Name, Active, IsAdmin FROM main_myuser WHERE Deleted=0 ORDER BY Name')
    return jsonify([dict(r) for r in rows])


@settings_bp.route('/users', methods=['POST'])
@login_required
def add_user():
    data = request.get_json()
    if not data.get('UserId') or not data.get('Password'):
        return jsonify({'error': 'UserId and Password required'}), 400
    existing = query('SELECT id FROM main_myuser WHERE UserId=?', (data['UserId'],), one=True)
    if existing:
        return jsonify({'error': 'User already exists'}), 409
    execute(
        'INSERT INTO main_myuser (UserId, Password, Name, Active, Deleted, IsAdmin) VALUES (?,?,?,1,0,?)',
        (data['UserId'], data['Password'], data.get('Name', ''), int(data.get('IsAdmin', 0)))
    )
    row = query('SELECT id, UserId, Name, Active, IsAdmin FROM main_myuser WHERE UserId=?',
                (data['UserId'],), one=True)
    return jsonify(dict(row)), 201


@settings_bp.route('/users/<user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    data = request.get_json()
    existing = query('SELECT * FROM main_myuser WHERE UserId=? AND Deleted=0', (user_id,), one=True)
    if not existing:
        return jsonify({'error': 'Not found'}), 404
    password = data['Password'] if data.get('Password') else existing['Password']
    execute(
        'UPDATE main_myuser SET Name=?, Password=?, Active=?, IsAdmin=? WHERE UserId=?',
        (
            data.get('Name', existing['Name']),
            password,
            int(data.get('Active', existing['Active'])),
            int(data.get('IsAdmin', existing['IsAdmin'])),
            user_id
        )
    )
    row = query('SELECT id, UserId, Name, Active, IsAdmin FROM main_myuser WHERE UserId=?', (user_id,), one=True)
    return jsonify(dict(row))


@settings_bp.route('/users/<user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    if user_id == session.get('user_id'):
        return jsonify({'error': 'Cannot delete yourself'}), 400
    execute('UPDATE main_myuser SET Deleted=1 WHERE UserId=?', (user_id,))
    return jsonify({'success': True})


# ── Page Access ─────────────────────────────────────────────────────────────

@settings_bp.route('/pages', methods=['GET'])
@login_required
def list_pages():
    rows = query('SELECT * FROM main_page WHERE Active=1 ORDER BY SortOrder')
    return jsonify([dict(r) for r in rows])


@settings_bp.route('/access/<user_id>', methods=['GET'])
@login_required
def get_user_access(user_id):
    rows = query('SELECT PageCode FROM main_pageaccess WHERE UserId=?', (user_id,))
    return jsonify([r['PageCode'] for r in rows])


@settings_bp.route('/access/<user_id>', methods=['PUT'])
@login_required
def set_user_access(user_id):
    data = request.get_json()
    page_codes = data.get('pages', [])
    execute('DELETE FROM main_pageaccess WHERE UserId=?', (user_id,))
    for code in page_codes:
        execute('INSERT INTO main_pageaccess (UserId, PageCode) VALUES (?,?)', (user_id, code))
    return jsonify({'success': True})


# ── App Settings ─────────────────────────────────────────────────────────────

@settings_bp.route('/app', methods=['GET'])
@login_required
def get_app_settings():
    row = query('SELECT * FROM main_appsettings LIMIT 1', one=True)
    if not row:
        return jsonify({})
    return jsonify(dict(row))


@settings_bp.route('/app', methods=['PUT'])
@login_required
def update_app_settings():
    data = request.get_json()
    existing = query('SELECT id FROM main_appsettings LIMIT 1', one=True)
    if existing:
        execute(
            '''UPDATE main_appsettings SET
               haveProjects=?, manualAttendance=?, exportAttendance=?, offlineAttendance=?''',
            (
                int(data.get('haveProjects', 1)),
                int(data.get('manualAttendance', 0)),
                int(data.get('exportAttendance', 1)),
                int(data.get('offlineAttendance', 1))
            )
        )
    else:
        execute(
            'INSERT INTO main_appsettings (haveProjects, manualAttendance, exportAttendance, offlineAttendance) VALUES (?,?,?,?)',
            (
                int(data.get('haveProjects', 1)),
                int(data.get('manualAttendance', 0)),
                int(data.get('exportAttendance', 1)),
                int(data.get('offlineAttendance', 1))
            )
        )
    return jsonify({'success': True})

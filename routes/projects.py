from flask import Blueprint, request, jsonify, session
from routes.db_helper import query, execute
from routes.auth import login_required

projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/', methods=['GET'])
@login_required
def list_projects():
    rows = query(
        'SELECT * FROM main_myproject WHERE Deleted=0 ORDER BY Title'
    )
    result = []
    for r in rows:
        p = dict(r)
        incharge = query(
            'SELECT UserId FROM main_projectincharge WHERE ProjectId=?', (r['id'],)
        )
        p['incharge_list'] = [i['UserId'] for i in incharge]
        result.append(p)
    return jsonify(result)


@projects_bp.route('/<int:proj_id>', methods=['GET'])
@login_required
def get_project(proj_id):
    row = query('SELECT * FROM main_myproject WHERE id=? AND Deleted=0', (proj_id,), one=True)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    p = dict(row)
    incharge = query('SELECT UserId FROM main_projectincharge WHERE ProjectId=?', (proj_id,))
    p['incharge_list'] = [i['UserId'] for i in incharge]
    return jsonify(p)


@projects_bp.route('/', methods=['POST'])
@login_required
def add_project():
    data = request.get_json()
    if not data.get('Title'):
        return jsonify({'error': 'Title is required'}), 400

    execute(
        '''INSERT INTO main_myproject
           (Title, Location, Status, Deleted, Incharge, Latitude, Longitude, StartTime, EndTime)
           VALUES (?,?,?,0,?,?,?,?,?)''',
        (
            data['Title'], data.get('Location', ''),
            data.get('Status', 'Active'), data.get('Incharge', ''),
            data.get('Latitude'), data.get('Longitude'),
            data.get('StartTime', ''), data.get('EndTime', '')
        )
    )
    row = query('SELECT * FROM main_myproject ORDER BY id DESC LIMIT 1', one=True)
    proj_id = row['id']

    for uid in data.get('incharge_list', []):
        execute('INSERT INTO main_projectincharge (ProjectId, UserId) VALUES (?,?)', (proj_id, uid))

    return jsonify(dict(row)), 201


@projects_bp.route('/<int:proj_id>', methods=['PUT'])
@login_required
def update_project(proj_id):
    data = request.get_json()
    existing = query('SELECT * FROM main_myproject WHERE id=? AND Deleted=0', (proj_id,), one=True)
    if not existing:
        return jsonify({'error': 'Not found'}), 404

    execute(
        '''UPDATE main_myproject SET
           Title=?, Location=?, Status=?, Incharge=?,
           Latitude=?, Longitude=?, StartTime=?, EndTime=?
           WHERE id=?''',
        (
            data.get('Title', existing['Title']),
            data.get('Location', existing['Location']),
            data.get('Status', existing['Status']),
            data.get('Incharge', existing['Incharge']),
            data.get('Latitude', existing['Latitude']),
            data.get('Longitude', existing['Longitude']),
            data.get('StartTime', existing['StartTime']),
            data.get('EndTime', existing['EndTime']),
            proj_id
        )
    )

    if 'incharge_list' in data:
        execute('DELETE FROM main_projectincharge WHERE ProjectId=?', (proj_id,))
        for uid in data['incharge_list']:
            execute('INSERT INTO main_projectincharge (ProjectId, UserId) VALUES (?,?)', (proj_id, uid))

    row = query('SELECT * FROM main_myproject WHERE id=?', (proj_id,), one=True)
    return jsonify(dict(row))


@projects_bp.route('/<int:proj_id>', methods=['DELETE'])
@login_required
def delete_project(proj_id):
    existing = query('SELECT id FROM main_myproject WHERE id=? AND Deleted=0', (proj_id,), one=True)
    if not existing:
        return jsonify({'error': 'Not found'}), 404
    execute('UPDATE main_myproject SET Deleted=1 WHERE id=?', (proj_id,))
    return jsonify({'success': True})

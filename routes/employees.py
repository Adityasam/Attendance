import os
import base64
import uuid
from flask import Blueprint, request, jsonify, current_app, session
from routes.db_helper import query, execute, get_db
from routes.auth import login_required

employees_bp = Blueprint('employees', __name__)


def row_to_dict(row):
    return dict(row) if row else None


@employees_bp.route('/', methods=['GET'])
@login_required
def list_employees():
    rows = query(
        'SELECT id, EmployeeCode, FullName, Mobile, Email, Active, Designation, '
        'EmployeeType, Manager, Picture, FaceData FROM main_employee WHERE Deleted=0 ORDER BY FullName'
    )
    return jsonify([dict(r) for r in rows])


@employees_bp.route('/face-data', methods=['GET'])
@login_required
def face_data():
    """Return employees with face descriptors for offline sync."""
    rows = query(
        'SELECT id, EmployeeCode, FullName, Picture, FaceData FROM main_employee '
        'WHERE Deleted=0 AND Active=1 AND FaceData IS NOT NULL AND FaceData != ""'
    )
    return jsonify([dict(r) for r in rows])


@employees_bp.route('/<int:emp_id>', methods=['GET'])
@login_required
def get_employee(emp_id):
    row = query('SELECT * FROM main_employee WHERE id=? AND Deleted=0', (emp_id,), one=True)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@employees_bp.route('/', methods=['POST'])
@login_required
def add_employee():
    data = request.get_json()
    required = ['EmployeeCode', 'FullName']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400

    picture_path = _save_picture(data.get('Picture'), data.get('EmployeeCode'))

    execute(
        '''INSERT INTO main_employee
           (EmployeeCode, FullName, Mobile, Email, Active, Deleted, Picture,
            Designation, FaceData, EmployeeType, Manager)
           VALUES (?,?,?,?,1,0,?,?,?,?,?)''',
        (
            data['EmployeeCode'], data['FullName'],
            data.get('Mobile', ''), data.get('Email', ''),
            picture_path,
            data.get('Designation', ''), data.get('FaceData', ''),
            data.get('EmployeeType', 'Staff'), data.get('Manager', '')
        )
    )
    row = query('SELECT * FROM main_employee WHERE EmployeeCode=?',
                (data['EmployeeCode'],), one=True)
    return jsonify(dict(row)), 201


@employees_bp.route('/<int:emp_id>', methods=['PUT'])
@login_required
def update_employee(emp_id):
    data = request.get_json()
    existing = query('SELECT * FROM main_employee WHERE id=? AND Deleted=0', (emp_id,), one=True)
    if not existing:
        return jsonify({'error': 'Not found'}), 404

    picture_path = existing['Picture']
    if data.get('Picture') and not data['Picture'].startswith('/static/'):
        picture_path = _save_picture(data['Picture'], existing['EmployeeCode'])

    face_data = data.get('FaceData', existing['FaceData'])

    execute(
        '''UPDATE main_employee SET
           EmployeeCode=?, FullName=?, Mobile=?, Email=?, Active=?, Designation=?,
           EmployeeType=?, Manager=?, Picture=?, FaceData=?
           WHERE id=?''',
        (
            data.get('EmployeeCode', existing['EmployeeCode']),
            data.get('FullName', existing['FullName']),
            data.get('Mobile', existing['Mobile']),
            data.get('Email', existing['Email']),
            int(data.get('Active', existing['Active'])),
            data.get('Designation', existing['Designation']),
            data.get('EmployeeType', existing['EmployeeType']),
            data.get('Manager', existing['Manager']),
            picture_path, face_data, emp_id
        )
    )
    row = query('SELECT * FROM main_employee WHERE id=?', (emp_id,), one=True)
    return jsonify(dict(row))


@employees_bp.route('/<int:emp_id>', methods=['DELETE'])
@login_required
def delete_employee(emp_id):
    existing = query('SELECT id FROM main_employee WHERE id=? AND Deleted=0', (emp_id,), one=True)
    if not existing:
        return jsonify({'error': 'Not found'}), 404
    execute('UPDATE main_employee SET Deleted=1 WHERE id=?', (emp_id,))
    return jsonify({'success': True})


def _save_picture(data_url, emp_code):
    """Save base64 picture and return path."""
    if not data_url or not data_url.startswith('data:image'):
        return ''
    try:
        header, encoded = data_url.split(',', 1)
        ext = 'jpg'
        if 'png' in header:
            ext = 'png'
        filename = f"{emp_code}_{uuid.uuid4().hex[:8]}.{ext}"
        upload_dir = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(encoded))
        return f'/static/uploads/{filename}'
    except Exception:
        return ''

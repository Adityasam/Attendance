from flask import Blueprint, render_template, session, redirect, url_for
from routes.auth import login_required, page_access_required

pages_bp = Blueprint('pages', __name__)


@pages_bp.route('/')
@login_required
@page_access_required('PG-00001')
def dashboard():
    return render_template('dashboard.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False),
                           allowed_pages=session.get('allowed_pages', []))


@pages_bp.route('/employees')
@login_required
@page_access_required('PG-00003')
def employees():
    return render_template('employees.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False),
                           allowed_pages=session.get('allowed_pages', []))


@pages_bp.route('/projects')
@login_required
@page_access_required('PG-00004')
def projects():
    return render_template('projects.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False),
                           allowed_pages=session.get('allowed_pages', []))


@pages_bp.route('/attendance')
@login_required
@page_access_required('PG-00002')
def attendance():
    return render_template('attendance.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False),
                           allowed_pages=session.get('allowed_pages', []))


@pages_bp.route('/settings')
@login_required
@page_access_required('PG-00005')
def settings():
    return render_template('settings.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False),
                           allowed_pages=session.get('allowed_pages', []))

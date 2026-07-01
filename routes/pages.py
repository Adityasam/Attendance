from flask import Blueprint, render_template, session, redirect, url_for
from routes.auth import login_required

pages_bp = Blueprint('pages', __name__)


@pages_bp.route('/')
@login_required
def dashboard():
    return render_template('dashboard.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False))


@pages_bp.route('/employees')
@login_required
def employees():
    return render_template('employees.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False))


@pages_bp.route('/projects')
@login_required
def projects():
    return render_template('projects.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False))


@pages_bp.route('/attendance')
@login_required
def attendance():
    return render_template('attendance.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False))


@pages_bp.route('/settings')
@login_required
def settings():
    return render_template('settings.html',
                           user_name=session.get('user_name'),
                           is_admin=session.get('is_admin', False))

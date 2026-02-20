"""Authentication routes"""

import os
from flask import Blueprint, request, jsonify
from app.models import db
from app.models.user import User
from app.auth.decorators import generate_token, login_required

auth_bp = Blueprint('auth', __name__)

# 관리자 비밀키 (환경변수 또는 기본값)
ADMIN_SECRET = os.getenv('ADMIN_SECRET', 'marketflow-admin-2024')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    name = (data.get('name') or '').strip()

    if not email or not password or not name:
        return jsonify({'error': 'email, password, name are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(email=email, name=name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = generate_token(user.id)
    return jsonify({'user': user.to_dict(), 'token': token}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'email and password are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = generate_token(user.id)
    return jsonify({'user': user.to_dict(), 'token': token})


@auth_bp.route('/me')
@login_required
def me():
    return jsonify({'user': request.current_user.to_dict()})


# ═══════════════════════════════════════════════════════
# Admin API — 관리자 전용 (ADMIN_SECRET 인증)
# ═══════════════════════════════════════════════════════

def _check_admin():
    """관리자 인증 확인. Header: X-Admin-Secret"""
    secret = request.headers.get('X-Admin-Secret', '')
    if secret != ADMIN_SECRET:
        return False
    return True


@auth_bp.route('/admin/users', methods=['GET'])
def admin_list_users():
    """전체 유저 목록 조회"""
    if not _check_admin():
        return jsonify({'error': 'Admin access denied'}), 403
    users = User.query.all()
    return jsonify({'users': [u.to_dict() for u in users]})


@auth_bp.route('/admin/set-tier', methods=['POST'])
def admin_set_tier():
    """유저 tier 변경 (free ↔ pro)

    Body: { "email": "user@example.com", "tier": "pro" }
    Header: X-Admin-Secret: <ADMIN_SECRET>
    """
    if not _check_admin():
        return jsonify({'error': 'Admin access denied'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    email = (data.get('email') or '').strip().lower()
    tier = (data.get('tier') or '').strip().lower()

    if not email or tier not in ('free', 'pro'):
        return jsonify({'error': 'email and tier (free/pro) are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': f'User not found: {email}'}), 404

    old_tier = user.tier
    user.tier = tier
    db.session.commit()

    return jsonify({
        'message': f'{email}: {old_tier} → {tier}',
        'user': user.to_dict(),
    })

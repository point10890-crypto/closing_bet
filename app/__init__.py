# app/__init__.py
"""Flask 애플리케이션 팩토리 (KR Market + Auth + Stripe)"""

import os
import sys
from flask import Flask, make_response

# 패키지 루트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def create_app(config=None):
    """Flask 앱 팩토리 함수"""
    app = Flask(__name__,
                template_folder='../templates',
                static_folder='../static')

    # CORS 설정 (옵셔널)
    try:
        from flask_cors import CORS
        CORS(app, resources={r"/api/*": {"origins": "*"}})
    except ImportError:
        print("flask-cors not installed, CORS disabled")

    # 환경변수 로드
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    # 기본 설정
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'marketflow-secret-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(
        os.path.abspath(os.path.dirname(os.path.dirname(__file__))), 'data', 'users.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # 설정 적용
    if config:
        app.config.update(config)

    # Database
    from app.models import db
    db.init_app(app)
    with app.app_context():
        from app.models.user import User  # noqa: F401
        db.create_all()

    # Blueprint 등록
    from app.routes import register_blueprints
    register_blueprints(app)

    # ── 실시간 API 캐시 방지 (모바일/ngrok 동시 갱신 보장) ──
    @app.after_request
    def add_no_cache_headers(response):
        """API 응답에 Cache-Control 헤더 추가 — 모바일·ngrok 캐시 방지"""
        if response.content_type and 'application/json' in response.content_type:
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        return response

    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        from flask import jsonify as _jsonify
        return _jsonify({'status': 'ok', 'service': 'MarketFlow API'})

    # ── 스케줄러 상태 API ──
    @app.route('/api/scheduler/status')
    def scheduler_status():
        from flask import jsonify as _jsonify
        from app.utils.scheduler import get_scheduler_status
        return _jsonify(get_scheduler_status())

    # ── 스케줄러 수동 트리거 API ──
    @app.route('/api/scheduler/trigger/<task>', methods=['POST'])
    def scheduler_trigger(task):
        from flask import jsonify as _jsonify
        import threading
        from app.utils.scheduler import (
            _run_jongga_v2, _run_round2, _run_us_update, _run_crypto_pipeline,
            _run_all_update
        )

        tasks_map = {
            'jongga-v2': _run_jongga_v2,
            'round2': _run_round2,
            'us-update': _run_us_update,
            'crypto': _run_crypto_pipeline,
            'all-update': _run_all_update,
        }
        func = tasks_map.get(task)
        if not func:
            return _jsonify({'error': f'Unknown task: {task}', 'available': list(tasks_map.keys())}), 400

        # 백그라운드 스레드에서 실행
        threading.Thread(target=func, daemon=True, name=f'trigger-{task}').start()
        return _jsonify({'status': 'triggered', 'task': task})

    # ── 라우트 등록 검증: 핵심 라우트 누락 시 즉시 중단 ──
    registered = {r.rule for r in app.url_map.iter_rules()}
    for critical in ['/api/health', '/api/data-version']:
        if critical not in registered:
            raise RuntimeError(
                f"[FATAL] Critical route not registered: {critical}\n"
                f"  Registered ({len(registered)}): {sorted(list(registered))[:15]}..."
            )

    # ── 클라우드 스케줄러 자동 시작 (Render 또는 SCHEDULER_ENABLED) ──
    if os.getenv('RENDER') or os.getenv('SCHEDULER_ENABLED', '').lower() in ('true', '1'):
        try:
            from app.utils.scheduler import start_cloud_scheduler
            start_cloud_scheduler()
            print("[OK] Cloud scheduler started in background thread")
        except Exception as e:
            print(f"[WARN] Cloud scheduler failed to start: {e}")

    return app

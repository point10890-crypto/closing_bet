#!/usr/bin/env python3
"""
Flask 애플리케이션 진입점
기존 호환성을 위해 유지 - 내부적으로 Blueprint 기반 app 사용

원본 파일은 flask_app_backup.py 에 백업됨
"""
import sys
import os
import shutil

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Fix SSL cert path for Korean directory names (curl_cffi can't handle non-ASCII paths)
try:
    import certifi
    cert_src = certifi.where()
    safe_cert = os.path.join(os.path.expanduser('~'), 'cacert.pem')
    if not os.path.exists(safe_cert) or os.path.getmtime(cert_src) > os.path.getmtime(safe_cert):
        shutil.copy2(cert_src, safe_cert)
    os.environ['CURL_CA_BUNDLE'] = safe_cert
    os.environ['SSL_CERT_FILE'] = safe_cert
except Exception:
    pass

# ── 경로 강제 고정 (프로젝트 루트 = flask_app.py 위치) ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

# sys.path 오염 방지: 프로젝트 내 하위 패키지(korean market/, crypto-analytics/ 등)와
# 외부 프로젝트(C:\Projects 등)의 app/config 패키지 충돌을 차단
_blocked = ['korean market', 'crypto-analytics', 'us-market-pro', 'kr_market_package']
sys.path = [p for p in sys.path if not any(b in p for b in _blocked)]
sys.path.insert(0, BASE_DIR)

from app import create_app

# 로드된 모듈 검증: 잘못된 app 패키지를 import했으면 즉시 중단
import app as _app_mod
_expected = os.path.normpath(os.path.join(BASE_DIR, 'app', '__init__.py'))
_actual = os.path.normpath(_app_mod.__file__)
if _expected != _actual:
    print(f"[FATAL] Wrong app module loaded!")
    print(f"  Expected: {_expected}")
    print(f"  Actual:   {_actual}")
    sys.exit(1)

# Create the Flask app using the factory
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5001))
    print("\n" + "="*60)
    print(f"[START] Flask App (port {port})")
    print(f"   BASE_DIR: {BASE_DIR}")
    print(f"   app module: {_actual}")
    print("="*60 + "\n")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=True
    )

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

# ── CWD를 프로젝트 루트로 강제 고정 ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

from app import create_app

# Create the Flask app using the factory
app = create_app()

if __name__ == '__main__':
    print("\n" + "="*60)
    print("[START] Flask App Starting (Blueprint Version)")
    print(f"   BASE_DIR: {BASE_DIR}")
    print("   Original code backed up to: flask_app_backup.py")
    print("="*60 + "\n")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True,
        use_reloader=False  # Avoid duplicate scheduler starts
    )

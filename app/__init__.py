# app/__init__.py
"""Flask 애플리케이션 팩토리 (KR Market 전용)"""

import os
import sys
from flask import Flask

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
        CORS(app)
    except ImportError:
        print("⚠️ flask-cors not installed, CORS disabled")
    
    # 환경변수 로드
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    
    # 설정 적용
    if config:
        app.config.update(config)
    
    # Blueprint 등록
    from app.routes import register_blueprints
    register_blueprints(app)
    
    return app

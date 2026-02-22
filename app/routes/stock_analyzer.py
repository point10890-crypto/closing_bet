# app/routes/stock_analyzer.py
"""Investing.com ProPicks 종목 분석 - Blueprint"""

import os
import time
import pandas as pd
from io import BytesIO
from flask import Blueprint, jsonify, request, send_file
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime

stock_analyzer_bp = Blueprint('stock_analyzer', __name__)

# --- 경로 설정 ---
_ROUTES_DIR = os.path.dirname(os.path.abspath(__file__))
_BASE_DIR = os.path.dirname(os.path.dirname(_ROUTES_DIR))
XLSX_PATH = os.path.join(_BASE_DIR, 'stock_data.xlsx')

# --- 종목 데이터 로드 ---
_stock_df = None
_stock_list = []

XPATH = "//*[@id='pro-score-mobile']/div/div[2]/div[3]/div/div/div[1]/div"

# ChromeDriver 서비스 (lazy init)
_chrome_service = None


def _load_stocks():
    """stock_data.xlsx 로드 (최초 1회)"""
    global _stock_df, _stock_list
    if _stock_df is None:
        try:
            _stock_df = pd.read_excel(XLSX_PATH)
            _stock_list = _stock_df.to_dict('records')
            print(f"[StockAnalyzer] {len(_stock_list)}개 종목 로드 완료: {XLSX_PATH}")
        except Exception as e:
            print(f"[StockAnalyzer] 종목 로드 실패: {e}")
            _stock_df = pd.DataFrame()
            _stock_list = []
    return _stock_list


def _get_chrome_service():
    """ChromeDriver 서비스 (lazy init)"""
    global _chrome_service
    if _chrome_service is None:
        _chrome_service = Service(ChromeDriverManager().install())
    return _chrome_service


def _create_driver():
    """Headless Chrome 드라이버 생성"""
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--window-size=375,812")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_experimental_option('excludeSwitches', ['enable-logging'])
    opts.page_load_strategy = 'eager'
    return webdriver.Chrome(service=_get_chrome_service(), options=opts)


def _scrape_single(url):
    """단건 스크래핑: 드라이버 생성 → 접속 → 결과 추출 → 드라이버 종료"""
    driver = _create_driver()
    try:
        driver.get(url)
        time.sleep(2)
        element = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, XPATH))
        )
        return element.text
    except (TimeoutException, WebDriverException):
        return None
    finally:
        driver.quit()


# ============================================================
# API Endpoints
# ============================================================

@stock_analyzer_bp.route('/search')
def search_stocks():
    """종목 검색 (이름 부분 매칭, 최대 20건)"""
    q = request.args.get('q', '').strip().lower()
    stocks = _load_stocks()

    if not q:
        return jsonify([])

    results = []
    for s in stocks:
        name = str(s.get('종목', '')).lower()
        num = str(s.get('순번', ''))
        if q in name or q in num:
            results.append({
                'id': s.get('순번'),
                'name': s.get('종목'),
                'url': s.get('url')
            })
            if len(results) >= 20:
                break

    return jsonify(results)


@stock_analyzer_bp.route('/analyze', methods=['POST'])
def analyze_stock():
    """단건 스크래핑 분석"""
    data = request.json or {}
    url = data.get('url')
    name = data.get('name', '')

    if not url:
        return jsonify({'error': 'URL이 없습니다.'}), 400

    result = _scrape_single(url)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if result:
        return jsonify({
            'name': name,
            'result': result,
            'date': now,
            'url': url
        })
    else:
        return jsonify({
            'error': f'{name} 분석 실패 (Cloudflare 차단 가능성)',
            'name': name
        }), 500


@stock_analyzer_bp.route('/export', methods=['POST'])
def export_history():
    """클라이언트 조회 기록을 Excel로 변환하여 다운로드"""
    data = request.json or {}
    records = data.get('records', [])

    if not records:
        return jsonify({'error': '저장할 데이터가 없습니다.'}), 400

    df = pd.DataFrame(records)
    output = BytesIO()
    df.to_excel(output, index=False, engine='openpyxl')
    output.seek(0)

    filename = datetime.now().strftime('%y%m%d') + '_propicks_result.xlsx'
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )

import sys
sys.stdout.reconfigure(encoding='utf-8')

import os
import time
import pandas as pd
from flask import Flask, render_template, request, jsonify
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime

app = Flask(__name__)

# 엑셀에서 종목 목록 로드
df = pd.read_excel('stock_data.xlsx')
stock_list = df.to_dict('records')

# 조회 기록 저장
history = []

# ChromeDriver 서비스 미리 준비
service = Service(ChromeDriverManager().install())

XPATH = "//*[@id='pro-score-mobile']/div/div[2]/div[3]/div/div/div[1]/div"


def create_driver():
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
    return webdriver.Chrome(service=service, options=opts)


def scrape_single(url):
    """단건 스크래핑: 드라이버 생성 → 접속 → 결과 추출 → 드라이버 종료"""
    driver = create_driver()
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


@app.route('/')
def index():
    return render_template('index.html', stocks=stock_list)


@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.json
    url = data.get('url')
    name = data.get('name', '')

    if not url:
        return jsonify({'error': 'URL이 없습니다.'}), 400

    result = scrape_single(url)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if result:
        entry = {
            '순번': data.get('순번'),
            '종목': name,
            'url': url,
            '분석결과': result,
            'date': now
        }
        history.append(entry)
        return jsonify({'name': name, 'result': result, 'date': now})
    else:
        return jsonify({'error': f'{name} 분석 실패 (Cloudflare 차단 가능성)'}), 500


@app.route('/api/history')
def api_history():
    return jsonify(history)


@app.route('/api/export')
def export_excel():
    if not history:
        return jsonify({'error': '저장된 데이터가 없습니다.'}), 400

    result_df = pd.DataFrame(history)
    file_name = datetime.now().strftime('%y%m%d') + '_result.xlsx'
    folder = '날짜별 데이터'
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, file_name)
    result_df.to_excel(path, index=False)
    return jsonify({'ok': True, 'path': path, 'count': len(history)})


if __name__ == '__main__':
    print("서버 시작: http://localhost:5000", flush=True)
    app.run(debug=False, port=5000)

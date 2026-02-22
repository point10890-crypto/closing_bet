import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')


def create_driver():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--window-size=375,812")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    chrome_options.page_load_strategy = 'eager'
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=chrome_options)


def get_element_text(driver, url, xpath):
    try:
        driver.get(url)
        element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, xpath))
        )
        return element.text
    except (TimeoutException, WebDriverException) as e:
        print(f"Error occurred: {str(e)}")
        return None


# 엑셀 파일 경로
file_path = 'stock_data.xlsx'

# 엑셀 파일 불러오기
df = pd.read_excel(file_path)

# 결과를 저장할 리스트 초기화
results = []

xpath = "//*[@id='pro-score-mobile']/div/div[2]/div[3]/div/div/div[1]/div"

total = len(df)
print(f"총 {total}개 종목 분석 시작...", flush=True)
start_time = time.time()

# 드라이버 한 번만 생성하여 재사용
driver = create_driver()

try:
    # 데이터 순회
    for index, row in df.iterrows():
        url = row['url']
        element_text = get_element_text(driver, url, xpath)

        if element_text:
            print(f"[{index + 1}/{total}] {row['종목']}의 분석 결과: {element_text}", flush=True)
            results.append([row['순번'], row['종목'], row['url'], datetime.now().strftime('%Y-%m-%d'), element_text])
        else:
            print(f"[{index + 1}/{total}] {row['종목']}의 처리 중 오류 발생: {url}", flush=True)
            results.append([row['순번'], row['종목'], row['url'], datetime.now().strftime('%Y-%m-%d'), '오류 발생'])
finally:
    driver.quit()

elapsed = time.time() - start_time
print(f"\n스크래핑 완료! 소요 시간: {elapsed/60:.1f}분", flush=True)

# 결과를 데이터프레임으로 변환
result_df = pd.DataFrame(results, columns=['순번', '종목', 'url', '오늘 날짜', '분석 결과'])

# 현재 날짜를 기준으로 파일명 생성
file_name = datetime.now().strftime('%y%m%d') + '_result.xlsx'

# 저장 폴더 경로
folder_path = '날짜별 데이터'

# 폴더가 없으면 생성
if not os.path.exists(folder_path):
    os.makedirs(folder_path)

# 전체 파일 경로 생성
file_path = os.path.join(folder_path, file_name)

# 엑셀 파일로 저장
result_df.to_excel(file_path, index=False)

print(f"분석 결과가 '{file_path}' 파일로 저장되었습니다.")

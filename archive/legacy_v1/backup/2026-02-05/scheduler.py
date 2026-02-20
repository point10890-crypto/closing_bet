#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR Market - 자동 스케줄러 (배포용)

환경 변수:
- KR_MARKET_DIR: 프로젝트 루트 디렉토리 (기본: 현재 디렉토리)
- KR_MARKET_LOG_DIR: 로그 디렉토리 (기본: KR_MARKET_DIR/logs)
- KR_MARKET_TZ: 타임존 (기본: Asia/Seoul)
- KR_MARKET_SCHEDULE_ENABLED: 스케줄 활성화 (기본: true)

스케줄:
- 평일 16:00 - 일별 가격 데이터 업데이트
- 평일 16:10 - 수급 데이터(외인/기관) 업데이트
- 평일 16:20 - VCP 시그널 스캔
- 평일 16:30 - 성과 리포트 생성
- 토요일 10:00 - 과거 히스토리 수집 (백업)

실행 방법:
  # 로컬 개발
  python3 kr_market/scheduler.py
  
  # 즉시 업데이트 실행
  python3 kr_market/scheduler.py --now
  
  # Docker
  docker run -d --name kr-scheduler kr-market-scheduler
  
  # systemd
  sudo systemctl start kr-market-scheduler
"""
import os
from dotenv import load_dotenv
load_dotenv(override=True)
import sys
import time
import logging
import subprocess
import signal
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional
import json

# Windows 환경에서 콘솔 출력 인코딩 강제 설정
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# 선택적 import (배포 시 설치 필요)
try:
    import schedule
except ImportError:
    print("❌ 'schedule' 패키지가 필요합니다: pip install schedule")
    sys.exit(1)

# ============================================================
# 설정
# ============================================================

class Config:
    """배포 환경 설정"""
    
    # 디렉토리 - 스크립트가 있는 디렉토리를 기본값으로 사용
    _SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = os.environ.get('KR_MARKET_DIR', _SCRIPT_DIR)
    LOG_DIR = os.environ.get('KR_MARKET_LOG_DIR', os.path.join(BASE_DIR, 'logs'))
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    
    # 스케줄
    SCHEDULE_ENABLED = os.environ.get('KR_MARKET_SCHEDULE_ENABLED', 'true').lower() == 'true'
    TZ = os.environ.get('KR_MARKET_TZ', 'Asia/Seoul')
    
    # 스케줄 시간 (KST 기준)
    PRICE_UPDATE_TIME = os.environ.get('KR_MARKET_PRICE_TIME', '16:00')
    INST_UPDATE_TIME = os.environ.get('KR_MARKET_INST_TIME', '16:10')
    SIGNAL_SCAN_TIME = os.environ.get('KR_MARKET_SIGNAL_TIME', '16:20')
    REPORT_TIME = os.environ.get('KR_MARKET_REPORT_TIME', '16:30')
    REPORT_TIME = os.environ.get('KR_MARKET_REPORT_TIME', '16:30')
    CLOSING_BET_TIME = os.environ.get('KR_MARKET_CLOSING_BET_TIME', '15:20')
    HISTORY_TIME = os.environ.get('KR_MARKET_HISTORY_TIME', '10:00')
    
    # 타임아웃 (초)
    PRICE_TIMEOUT = int(os.environ.get('KR_MARKET_PRICE_TIMEOUT', '600'))
    INST_TIMEOUT = int(os.environ.get('KR_MARKET_INST_TIMEOUT', '600'))
    SIGNAL_TIMEOUT = int(os.environ.get('KR_MARKET_SIGNAL_TIMEOUT', '300'))
    HISTORY_TIMEOUT = int(os.environ.get('KR_MARKET_HISTORY_TIMEOUT', '900'))
    
    # Python 실행 경로 (가상환경 지원)
    PYTHON_PATH = os.environ.get('KR_MARKET_PYTHON', sys.executable)
    
    @classmethod
    def ensure_dirs(cls):
        """필요한 디렉토리 생성"""
        Path(cls.LOG_DIR).mkdir(parents=True, exist_ok=True)
        Path(cls.DATA_DIR).mkdir(parents=True, exist_ok=True)


# ============================================================
# 로깅 설정
# ============================================================

def setup_logging():
    """로깅 설정"""
    Config.ensure_dirs()
    
    log_file = os.path.join(Config.LOG_DIR, 'scheduler.log')
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)


logger = setup_logging()


# ============================================================
# 작업 함수들
# ============================================================

def run_command(cmd: list, description: str, timeout: int = 600) -> bool:
    """명령 실행 헬퍼 (실시간 출력 스트리밍)"""
    logger.info(f"🚀 시작: {description}")
    send_telegram(f"🚀 작업을 시작합니다: {description}")
    start = time.time()
    
    try:
        # Popen으로 실행하여 실시간 출력 캡처
        process = subprocess.Popen(
            cmd,
            cwd=Config.BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8', # Windows CP949 이슈 해결
            errors='replace', # 인코딩 오류 무시
            env={**os.environ, 'PYTHONPATH': Config.BASE_DIR, 'PYTHONIOENCODING': 'utf-8'},
            bufsize=1
        )
        
        # 실시간 출력 로깅
        for line in iter(process.stdout.readline, ''):
            clean = line.strip()
            if clean:
                logger.info(f"   > {clean}")
        
        # 종료 대기
        process.wait(timeout=timeout)
        
        elapsed = time.time() - start
        
        if process.returncode == 0:
            logger.info(f"✅ 완료: {description} ({elapsed:.1f}초)")
            # send_telegram(f"✅ 완료: {description}") # 너무 잦은 알림 방지
            return True
        else:
            logger.error(f"❌ 실패: {description} (Exit Code: {process.returncode})")
            send_telegram(f"❌ 실패: {description} (Error Code: {process.returncode})")
            return False
            
    except subprocess.TimeoutExpired:
        process.kill()
        logger.error(f"⏰ 타임아웃: {description}")
        send_telegram(f"⏰ 타임아웃 발생: {description}")
        return False
    except Exception as e:
        logger.error(f"❌ 에러: {description} - {e}")
        send_telegram(f"❌ 예외 발생: {description}\n{str(e)}")
        return False


def send_telegram(message: str) -> bool:
    """텔레그램 메시지 전송"""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id or "your_bot_token" in token:
        logger.warning("⚠️ 텔레그램 설정이 완료되지 않아 알림을 건너뜁니다.")
        return False
        
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    
    try:
        import requests
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"❌ 텔레그램 전송 실패: {e}")
        return False


def update_daily_prices():
    """일별 가격 데이터 업데이트"""
    script_path = os.path.join(Config.BASE_DIR, 'scripts', 'create_complete_daily_prices.py').replace("\\", "\\\\")
    data_dir_escaped = Config.DATA_DIR.replace("\\", "\\\\")
    base_dir_escaped = Config.BASE_DIR.replace("\\", "\\\\")
    script = f"import os; os.environ['DATA_DIR'] = '{data_dir_escaped}'; os.chdir('{base_dir_escaped}'); exec(open('{script_path}', encoding='utf-8').read())"
    return run_command(
        [Config.PYTHON_PATH, '-c', script],
        '일별 가격 데이터 업데이트',
        timeout=Config.PRICE_TIMEOUT
    )


def update_institutional_data():
    """수급 데이터 업데이트"""
    script_path = os.path.join(Config.BASE_DIR, 'all_institutional_trend_data.py').replace("\\", "\\\\")
    data_dir_escaped = Config.DATA_DIR.replace("\\", "\\\\")
    base_dir_escaped = Config.BASE_DIR.replace("\\", "\\\\")
    script = f"import os; os.environ['DATA_DIR'] = '{data_dir_escaped}'; os.chdir('{base_dir_escaped}'); exec(open('{script_path}', encoding='utf-8').read())"
    return run_command(
        [Config.PYTHON_PATH, '-c', script],
        '외인/기관 수급 데이터 업데이트',
        timeout=Config.INST_TIMEOUT
    )


def run_vcp_signal_scan():
    """VCP 시그널 스캔"""
    success = run_command(
        [Config.PYTHON_PATH, '-m', 'signal_tracker'],
        'VCP + 외인매집 시그널 스캔',
        timeout=Config.SIGNAL_TIMEOUT
    )

    if success:
        try:
            # VCP 시그널 상위 10개 텔레그램 전송
            send_vcp_telegram_summary()
        except Exception as e:
            logger.error(f"❌ VCP 텔레그램 전송 실패: {e}")

    return success


def send_vcp_telegram_summary():
    """VCP 시그널 상위 10개 텔레그램 전송"""
    import pandas as pd

    signals_path = os.path.join(Config.DATA_DIR, 'signals_log.csv')
    if not os.path.exists(signals_path):
        logger.warning("⚠️ signals_log.csv가 없어 VCP 알림을 건너뜁니다.")
        return

    df = pd.read_csv(signals_path, encoding='utf-8-sig')

    # OPEN 상태만 필터
    if 'status' in df.columns:
        df = df[df['status'] == 'OPEN']

    if df.empty:
        logger.info("📭 열린 VCP 시그널이 없습니다.")
        return

    # 종목명 매핑 (daily_prices.csv에서 가져오기)
    ticker_name_map = {}
    prices_path = os.path.join(Config.DATA_DIR, 'daily_prices.csv')
    if os.path.exists(prices_path):
        try:
            prices_df = pd.read_csv(prices_path, encoding='utf-8-sig')
            if 'ticker' in prices_df.columns and 'name' in prices_df.columns:
                ticker_name_map = dict(zip(prices_df['ticker'].astype(str).str.zfill(6), prices_df['name']))
        except Exception as e:
            logger.warning(f"종목명 매핑 실패: {e}")

    # 점수 기준 정렬 후 상위 10개
    if 'score' in df.columns:
        df = df.sort_values('score', ascending=False)

    top_10 = df.head(10)

    today = datetime.now().strftime('%m/%d')
    msg = f"<b>📈 VCP 시그널 Top 10 ({today})</b>\n"
    msg += f"총 {len(df)}개 중 상위 10개\n"
    msg += "────────────────────\n"

    for i, (_, row) in enumerate(top_10.iterrows(), 1):
        ticker = str(row.get('ticker', '')).zfill(6)
        name = row.get('name', '') or ticker_name_map.get(ticker, ticker)
        score = row.get('score', 0)
        entry = row.get('entry_price', 0)
        foreign = row.get('foreign_5d', 0)
        inst = row.get('inst_5d', 0)

        # 수급 아이콘
        supply_icon = ""
        if foreign > 0 and inst > 0:
            supply_icon = "🔥"  # 외인+기관 쌍끌이
        elif foreign > 0:
            supply_icon = "🌍"  # 외인 매수
        elif inst > 0:
            supply_icon = "🏛"  # 기관 매수

        msg += f"\n{i}. <b>{name}</b> ({ticker}) {supply_icon}\n"
        msg += f"   점수: {score:.1f} | 진입: {entry:,.0f}원\n"
        if foreign != 0 or inst != 0:
            msg += f"   외인: {foreign:+,} | 기관: {inst:+,}\n"

    send_telegram(msg)


def collect_historical_institutional():
    """과거 수급 데이터 수집 (히스토리 축적용)"""
    data_dir_escaped = Config.DATA_DIR.replace("\\", "\\\\")
    script = f"""
from collect_historical_data import HistoricalInstitutionalCollector
collector = HistoricalInstitutionalCollector(data_dir='{data_dir_escaped}')
df = collector.collect_all(max_stocks=None, max_workers=15)
if not df.empty:
    collector.generate_signals_from_history(lookback_days=5)
print(f'수집 완료: {{len(df)}}개 레코드')
"""
    return run_command(
        [Config.PYTHON_PATH, '-c', script],
        '과거 수급 히스토리 수집',
        timeout=Config.HISTORY_TIMEOUT
    )


def run_ai_analysis_scan():
    """AI 분석 및 JSON 생성 (kr_ai_analysis.json)"""
    logger.info("🤖 AI 종목 분석 및 데이터 생성 중...")
    try:
        # Import dynamic
        if Config.BASE_DIR not in sys.path:
            sys.path.append(Config.BASE_DIR)
        
        from kr_ai_analyzer import generate_ai_recommendations
        import pandas as pd
        
        signals_path = os.path.join(Config.DATA_DIR, 'signals_log.csv')
        if not os.path.exists(signals_path):
            logger.warning("⚠️ 시그널 로그가 없어 AI 분석을 건너뜁니다.")
            return True 
            
        df = pd.read_csv(signals_path)
        if 'status' not in df.columns:
            return True
            
        # Filter OPEN
        df = df[df['status'] == 'OPEN']
        if df.empty:
            logger.info("분석할 OPEN 시그널이 없습니다.")
            return True
            
        # Prepare Data
        signals = []
        for _, row in df.iterrows():
            signals.append({
                'ticker': str(row['ticker']).zfill(6),
                'name': row.get('name', ''),
                'score': float(row.get('score', 0)),
                'contraction_ratio': float(row.get('contraction_ratio', 0)),
                'foreign_5d': int(row.get('foreign_5d', 0)),
                'inst_5d': int(row.get('inst_5d', 0)),
                'entry_price': float(row.get('entry_price', 0))
            })
            
        # Top 20
        signals.sort(key=lambda x: x['score'], reverse=True)
        target_signals = signals[:20]
        
        # Run AI
        logger.info(f"   Top {len(target_signals)}개 종목 분석 시작 (Gemini/GPT)...")
        result = generate_ai_recommendations(target_signals)
        
        # Save JSON
        json_dir = os.path.join(Config.DATA_DIR, 'data')
        os.makedirs(json_dir, exist_ok=True)
        json_path = os.path.join(json_dir, 'kr_ai_analysis.json')
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            
        # 히스토리 저장
        from datetime import datetime
        today_str = datetime.now().strftime('%Y%m%d')
        history_dir = os.path.join(json_dir, 'history')
        os.makedirs(history_dir, exist_ok=True)
        history_path = os.path.join(history_dir, f'kr_ai_analysis_{today_str}.json')
        
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            
        logger.info(f"✅ AI 분석 데이터 저장 완료: {json_path}")
        logger.info(f"   (히스토리 저장: {history_path})")
        return True
        
    except Exception as e:
        logger.error(f"❌ AI 분석 실패: {e}")
        return False


def generate_daily_report():
    """일일 리포트 생성"""
    logger.info("📊 일일 리포트 생성 중...")
    
    try:
        import pandas as pd
        signals_path = os.path.join(Config.DATA_DIR, 'signals_log.csv')
        
        if os.path.exists(signals_path):
            df = pd.read_csv(signals_path, encoding='utf-8-sig')
            
            open_signals = len(df[df['status'] == 'OPEN'])
            closed_signals = len(df[df['status'] == 'CLOSED'])
            
            # 오늘 생성된 시그널
            today = datetime.now().strftime('%Y-%m-%d')
            today_signals = len(df[df['signal_date'] == today])
            
            report = {
                'date': today,
                'open_signals': open_signals,
                'closed_signals': closed_signals,
                'today_new_signals': today_signals,
                'total_signals': len(df),
                'generated_at': datetime.now().isoformat(),
                'env': {
                    'base_dir': Config.BASE_DIR,
                    'python': Config.PYTHON_PATH
                }
            }
            
            # 리포트 저장
            report_path = os.path.join(Config.DATA_DIR, 'daily_report.json')
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            
            logger.info(f"✅ 일일 리포트 저장: {report_path}")
            logger.info(f"   열린 시그널: {open_signals}개, 청산됨: {closed_signals}개, 오늘 신규: {today_signals}개")
            return True
            
    except Exception as e:
        logger.error(f"❌ 리포트 생성 실패: {e}")
        return False


def update_closing_bet():
    """종가베팅 데이터 업데이트 (summary.json) - legacy V1"""
    script_path = os.path.join(Config.BASE_DIR, 'scripts', 'run_closing_bet.py').replace("\\", "\\\\")
    base_dir_escaped = Config.BASE_DIR.replace("\\", "\\\\")
    script = f"import os; os.chdir('{base_dir_escaped}'); exec(open('{script_path}', encoding='utf-8').read())"
    return run_command(
        [Config.PYTHON_PATH, '-c', script],
        '종가베팅 스캔 및 요약 생성 (V1)',
        timeout=300
    )


def update_jongga_v2():
    """종가베팅 V2 데이터 업데이트 (jongga_v2_latest.json)"""
    # Windows 경로 인코딩 문제 해결을 위해 os.path.join 대신 raw string 또는 유니코드 처리
    base_dir_escaped = Config.BASE_DIR.replace("\\", "\\\\")
    script = f"""
import os
import sys
import asyncio
from datetime import datetime, timedelta, date

sys.path.append(r'{base_dir_escaped}')
from engine.generator import run_screener

# 새벽(0~9시)에 실행된 경우, 어제 날짜 기준으로 분석
now = datetime.now()
target_date = date.today()
if now.hour < 9:
    target_date = target_date - timedelta(days=1)
    # 주말 처리 (월요일 새벽이면 금요일로)
    if target_date.weekday() == 6: # 일요일이면 금요일로
        target_date = target_date - timedelta(days=2)
    elif target_date.weekday() == 5: # 토요일이면 금요일로
        target_date = target_date - timedelta(days=1)

print(f"📅 분석 기준일: {{target_date}}")
asyncio.run(run_screener(capital=50_000_000, markets=["KOSPI", "KOSDAQ"], target_date=target_date))

"""
    success = run_command(
        [Config.PYTHON_PATH, '-c', script],
        '종가베팅 V2 분석 엔진 실행',
        timeout=600
    )
    
    if success:
        try:
            # 결과 요약 전송 (S/A급만)
            json_path = os.path.join(Config.BASE_DIR, "data", "jongga_v2_latest.json")
            if os.path.exists(json_path):
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                date_str = data.get("date", "")
                all_signals = data.get("signals", [])
                total_count = len(all_signals)

                # S급, A급만 필터링
                sa_signals = [s for s in all_signals if s.get("grade") in ["S", "A"]]
                s_count = len([s for s in all_signals if s.get("grade") == "S"])
                a_count = len([s for s in all_signals if s.get("grade") == "A"])
                b_count = len([s for s in all_signals if s.get("grade") == "B"])

                # 헤더 메시지
                header = f"<b>🎯 종가베팅 V2 ({date_str})</b>\n\n"
                header += f"총 {total_count}개 시그널 (S:{s_count} A:{a_count} B:{b_count})\n"
                header += "────────────────────"

                if not sa_signals:
                    send_telegram(header + "\n\n⚠️ S/A급 시그널 없음 (B급 제외됨)")
                else:
                    # 메시지를 3~4개씩 나눠서 전송 (텔레그램 4096자 제한)
                    messages = [header]
                    current_msg = ""

                    for s in sa_signals:
                        grade = s.get("grade", "B")
                        icon = "🥇" if grade == "S" else "🥈"
                        change_pct = s.get("change_pct", 0)
                        trading_value = s.get("trading_value", 0) / 100_000_000

                        item = f"\n{icon} <b>{s.get('stock_name')}</b> ({s.get('stock_code')}) {s.get('market', '')}\n"
                        item += f"   등급: {grade} | 점수: {s.get('score', {}).get('total', 0)} | 등락: {change_pct:+.1f}%\n"
                        item += f"   진입: {s.get('entry_price', 0):,}원 | 목표: {s.get('target_price', 0):,}원\n"
                        if s.get("themes"):
                            item += f"   테마: {', '.join(s.get('themes')[:3])}\n"
                        llm_reason = s.get('score', {}).get('llm_reason', '')
                        if llm_reason:
                            item += f"   💡 {llm_reason[:60]}...\n"

                        # 3500자 넘으면 새 메시지로
                        if len(current_msg) + len(item) > 3500:
                            messages.append(current_msg)
                            current_msg = item
                        else:
                            current_msg += item

                    if current_msg:
                        messages.append(current_msg)

                    # 모든 메시지 전송
                    for i, msg in enumerate(messages):
                        if i == 0:
                            send_telegram(msg + messages[1] if len(messages) > 1 else msg)
                        elif i > 1:
                            send_telegram(f"<b>🎯 종가베팅 V2 계속 ({i}/{len(messages)-1})</b>\n" + msg)
                        import time
                        time.sleep(0.5)  # 텔레그램 rate limit 방지

        except Exception as e:
            logger.error(f"❌ 종가베팅 결과 전송 실패: {e}")
            
    return success


def run_full_update():
    """전체 업데이트 (순차 실행)"""
    logger.info("=" * 60)
    logger.info("🔄 KR Market 전체 업데이트 시작")
    logger.info(f"   BASE_DIR: {Config.BASE_DIR}")
    logger.info(f"   PYTHON: {Config.PYTHON_PATH}")
    logger.info("=" * 60)
    
    results = []
    
    # 1. 가격 데이터
    results.append(('daily_prices', update_daily_prices()))
    
    # 2. 수급 데이터
    results.append(('institutional', update_institutional_data()))
    
    # 3. VCP 스캔
    results.append(('vcp_signals', run_vcp_signal_scan()))
    
    # 4. AI 분석 (NEW)
    results.append(('ai_analysis', run_ai_analysis_scan()))
    
    # 5. 종가베팅 스캔 (Legacy V1)
    results.append(('closing_bet_v1', update_closing_bet()))

    # 6. 종가베팅 V2 스캔 (AI)
    results.append(('closing_bet_v2', update_jongga_v2()))

    # 7. 리포트 생성
    results.append(('daily_report', generate_daily_report()))
    
    # 결과 요약
    logger.info("=" * 60)
    logger.info("📋 업데이트 결과")
    for name, success in results:
        status = "✅" if success else "❌"
        logger.info(f"   {status} {name}")
    logger.info("=" * 60)
    
    return all(r[1] for r in results)


# ============================================================
# 스케줄러
# ============================================================

class Scheduler:
    """스케줄러 클래스"""
    
    def __init__(self):
        self.running = True
        
        # 시그널 핸들러 등록 (graceful shutdown)
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """종료 시그널 핸들러"""
        logger.info(f"📛 종료 시그널 수신 (signal={signum})")
        self.running = False
    
    def setup_schedules(self):
        """스케줄 등록"""
        weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        
        for day in weekdays:
            getattr(schedule.every(), day).at(Config.PRICE_UPDATE_TIME).do(update_daily_prices)
            getattr(schedule.every(), day).at(Config.INST_UPDATE_TIME).do(update_institutional_data)
            getattr(schedule.every(), day).at(Config.SIGNAL_SCAN_TIME).do(run_vcp_signal_scan)
            getattr(schedule.every(), day).at(Config.SIGNAL_SCAN_TIME).do(run_vcp_signal_scan)
            getattr(schedule.every(), day).at(Config.CLOSING_BET_TIME).do(update_closing_bet)
            getattr(schedule.every(), day).at(Config.CLOSING_BET_TIME).do(update_jongga_v2)
            getattr(schedule.every(), day).at(Config.REPORT_TIME).do(generate_daily_report)
        
        # 토요일 히스토리 수집
        schedule.every().saturday.at(Config.HISTORY_TIME).do(collect_historical_institutional)
        
        logger.info("📅 스케줄 등록 완료:")
        logger.info(f"   - 평일 {Config.PRICE_UPDATE_TIME} 가격 데이터 업데이트")
        logger.info(f"   - 평일 {Config.INST_UPDATE_TIME} 수급 데이터 업데이트")
        logger.info(f"   - 평일 {Config.SIGNAL_SCAN_TIME} VCP 시그널 스캔")
        logger.info(f"   - 평일 {Config.SIGNAL_SCAN_TIME} VCP 시그널 스캔")
        logger.info(f"   - 평일 {Config.CLOSING_BET_TIME} 종가베팅 스캔")
        logger.info(f"   - 평일 {Config.REPORT_TIME} 일일 리포트")
        logger.info(f"   - 토요일 {Config.HISTORY_TIME} 히스토리 수집")
    
    def run(self):
        """스케줄러 실행"""
        logger.info("⏰ 스케줄러 시작... (Ctrl+C / SIGTERM으로 종료)")
        
        while self.running:
            schedule.run_pending()
            time.sleep(30)  # 30초마다 체크
        
        logger.info("👋 스케줄러 종료")


# ============================================================
# 메인
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='KR Market 자동 스케줄러')
    parser.add_argument('--now', action='store_true', help='즉시 전체 업데이트 실행')
    parser.add_argument('--prices', action='store_true', help='가격 데이터만 업데이트')
    parser.add_argument('--inst', action='store_true', help='수급 데이터만 업데이트')
    parser.add_argument('--signals', action='store_true', help='VCP 시그널 스캔만 실행')
    parser.add_argument('--closing-bet', action='store_true', help='종가베팅(V1) 스캔만 실행')
    parser.add_argument('--jongga-v2', action='store_true', help='종가베팅 V2분석만 실행')
    parser.add_argument('--history', action='store_true', help='히스토리 수집만 실행')
    parser.add_argument('--daemon', action='store_true', help='데몬 모드 (스케줄러만 실행)')
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("🚀 KR Market 스케줄러")
    logger.info("=" * 60)
    logger.info(f"   BASE_DIR: {Config.BASE_DIR}")
    logger.info(f"   LOG_DIR: {Config.LOG_DIR}")
    logger.info(f"   DATA_DIR: {Config.DATA_DIR}")
    logger.info(f"   PYTHON: {Config.PYTHON_PATH}")
    logger.info(f"   SCHEDULE_ENABLED: {Config.SCHEDULE_ENABLED}")
    logger.info("=" * 60)
    
    # 개별 작업 실행
    if args.now:
        run_full_update()
        if not args.daemon:
            return
    
    if args.prices:
        update_daily_prices()
        if not args.daemon:
            return
    
    if args.inst:
        update_institutional_data()
        if not args.daemon:
            return
    
    if args.signals:
        run_vcp_signal_scan()
        if not args.daemon:
            return
            
    if args.jongga_v2:
        update_jongga_v2()
        if not args.daemon:
            return
    
    if args.history:
        collect_historical_institutional()
        if not args.daemon:
            return
    
    # 스케줄러 모드
    if Config.SCHEDULE_ENABLED:
        scheduler = Scheduler()
        scheduler.setup_schedules()
        scheduler.run()
    else:
        logger.info("⚠️ 스케줄 비활성화됨 (KR_MARKET_SCHEDULE_ENABLED=false)")


if __name__ == "__main__":
    main()

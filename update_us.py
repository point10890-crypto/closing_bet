#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🇺🇸 US Market 통합 업데이트 스크립트
매일 오전 9시(KST) 실행 — Preview 데이터 + Smart Money 스크리닝

실행 흐름:
1. Market Data (indices, bonds, currencies, commodities, Fear&Greed)
2. Sector Heatmap (11개 섹터 ETF)
3. Smart Money Top Picks (S&P 500 주요 50종목 스크리닝)
4. ML Prediction (SPY 5일 방향 예측)
5. AI Briefing (Perplexity API 또는 템플릿)
6. 텔레그램 리포트 전송

사용법:
  python update_us.py          # 전체 실행
  python update_us.py --quick  # AI/ML 스킵
  python update_us.py --test   # 텔레그램 테스트만
"""

import os
import sys
import subprocess
import time
import json
import argparse
import logging
import requests
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)

# Windows 콘솔 UTF-8
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# 경로 설정
# ============================================================
PROJECT_ROOT = Path(__file__).parent.absolute()
PREVIEW_SCRIPTS = PROJECT_ROOT / 'us_market_preview' / 'scripts'
PREVIEW_OUTPUT = PROJECT_ROOT / 'us_market_preview' / 'output'
US_DATA_DIR = PROJECT_ROOT / 'us_market' / 'data'
LOGS_DIR = PROJECT_ROOT / 'logs'
PYTHON_PATH = sys.executable

# 출력 디렉토리 보장
PREVIEW_OUTPUT.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# 스크립트 실행
# ============================================================

PREVIEW_PIPELINE = [
    ("market_data.py", "Market Data (Indices/Bonds/Currencies/Fear&Greed)", 120),
    ("sector_heatmap.py", "Sector Heatmap (11 Sectors)", 60),
    ("screener.py", "Smart Money Top Picks (S&P 500)", 300),
    ("predictor.py", "ML Prediction (SPY 5-Day)", 120),
    ("briefing.py", "AI Market Briefing", 90),
]


def run_script(script_name: str, description: str, timeout: int) -> bool:
    """스크립트 실행 (실시간 로그)"""
    script_path = PREVIEW_SCRIPTS / script_name
    if not script_path.exists():
        logger.warning(f"⚠️ 스크립트 없음: {script_path}")
        return False

    logger.info(f"🚀 {description} 시작...")
    start = time.time()

    try:
        process = subprocess.Popen(
            [PYTHON_PATH, str(script_path)],
            cwd=str(PREVIEW_SCRIPTS),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            env={**os.environ, 'PYTHONIOENCODING': 'utf-8'},
            bufsize=1
        )

        for line in iter(process.stdout.readline, ''):
            clean = line.strip()
            if clean:
                logger.info(f"   > {clean}")

        process.wait(timeout=timeout)
        elapsed = time.time() - start

        if process.returncode == 0:
            logger.info(f"✅ {description} 완료 ({elapsed:.1f}초)")
            return True
        else:
            logger.error(f"❌ {description} 실패 (Exit: {process.returncode})")
            return False

    except subprocess.TimeoutExpired:
        process.kill()
        logger.error(f"⏰ {description} 타임아웃 ({timeout}s)")
        return False
    except Exception as e:
        logger.error(f"❌ {description} 에러: {e}")
        return False


# ============================================================
# 텔레그램 전송
# ============================================================

def send_telegram(message: str) -> bool:
    """텔레그램 메시지 전송 (개인 + 채널)"""
    success = False

    # 개인 봇
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if token and chat_id and "your_bot_token" not in token:
        try:
            r = requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
                timeout=10
            )
            if r.status_code == 200:
                success = True
        except Exception as e:
            logger.error(f"❌ 텔레그램(개인) 실패: {e}")

    # 채널 봇
    ch_token = os.getenv("TELEGRAM_CHANNEL_BOT_TOKEN")
    ch_chat_id = os.getenv("TELEGRAM_CHANNEL_CHAT_ID")
    if ch_token and ch_chat_id:
        try:
            r = requests.post(
                f"https://api.telegram.org/bot{ch_token}/sendMessage",
                json={"chat_id": ch_chat_id, "text": message, "parse_mode": "HTML"},
                timeout=10
            )
            if r.status_code == 200:
                success = True
        except Exception as e:
            logger.error(f"❌ 텔레그램(채널) 실패: {e}")

    return success


def build_us_telegram_report() -> str:
    """US Market 텔레그램 리포트 생성"""
    now = datetime.now().strftime('%m/%d %H:%M')

    # 1. Market Data 로드
    market_text = ""
    market_path = PREVIEW_OUTPUT / 'market_data.json'
    if market_path.exists():
        with open(market_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Indices
        indices = data.get('indices', {})
        for sym, info in indices.items():
            name = info.get('name', sym)
            price = info.get('price', 0)
            change = info.get('change', 0)
            icon = "▲" if change >= 0 else "▼"
            market_text += f"  {name}: {price:,.2f} {icon}{change:+.2f}%\n"

        # Fear & Greed
        fg = data.get('fear_greed', {})
        fg_score = fg.get('score', 50)
        fg_level = fg.get('level', 'N/A')
        fg_vix = fg.get('vix', 0)
        market_text += f"\n  Fear&Greed: {fg_score} ({fg_level}) | VIX: {fg_vix}"

    # 2. Top Picks
    picks_text = ""
    picks_path = PREVIEW_OUTPUT / 'top_picks.json'
    if picks_path.exists():
        with open(picks_path, 'r', encoding='utf-8') as f:
            picks_data = json.load(f)
        top_picks = picks_data.get('top_picks', [])[:5]
        for p in top_picks:
            rank = p.get('rank', 0)
            ticker = p.get('ticker', '')
            name = p.get('name', ticker)[:15]
            score = p.get('composite_score', 0)
            grade = p.get('grade', '-')
            price = p.get('price', 0)
            picks_text += f"  {rank}. <b>{ticker}</b> ({name}) {score}점 [{grade}] ${price:,.2f}\n"

    # 3. Prediction
    pred_text = ""
    pred_path = PREVIEW_OUTPUT / 'prediction.json'
    if pred_path.exists():
        with open(pred_path, 'r', encoding='utf-8') as f:
            pred_data = json.load(f)
        spy = pred_data.get('spy', {})
        prob = spy.get('bullish_probability', 50)
        direction = spy.get('direction', 'Neutral')
        pred_text = f"  SPY 5-Day: {prob}% {direction}"

    # 4. Sector Heatmap
    sector_text = ""
    sector_path = PREVIEW_OUTPUT / 'sector_heatmap.json'
    if sector_path.exists():
        with open(sector_path, 'r', encoding='utf-8') as f:
            sector_data = json.load(f)
        sectors = sector_data.get('sectors', [])
        top3 = sectors[:3] if sectors else []
        bot3 = sectors[-3:] if len(sectors) >= 3 else []
        if top3:
            sector_text += "  📈 " + ", ".join(
                [f"{s['ticker']} {s['change']:+.2f}%" for s in top3])
        if bot3:
            sector_text += "\n  📉 " + ", ".join(
                [f"{s['ticker']} {s['change']:+.2f}%" for s in bot3])

    # 조합
    msg = f"<b>🇺🇸 US Night Preview ({now})</b>\n"
    msg += "────────────────────\n"

    if market_text:
        msg += f"\n<b>📊 Market Overview</b>\n{market_text}\n"

    if sector_text:
        msg += f"\n<b>🏢 Sector</b>\n{sector_text}\n"

    if pred_text:
        msg += f"\n<b>🤖 ML Prediction</b>\n{pred_text}\n"

    if picks_text:
        msg += f"\n<b>🏆 Smart Money Top 5</b>\n{picks_text}"

    return msg


# ============================================================
# 메인 실행
# ============================================================

def run_full_update(quick: bool = False, no_telegram: bool = False):
    """전체 US Market 업데이트"""
    logger.info("=" * 60)
    logger.info("🇺🇸 US Market 전체 업데이트 시작")
    logger.info(f"   모드: {'Quick' if quick else 'Full'}")
    logger.info(f"   텔레그램: {'OFF' if no_telegram else 'ON'}")
    logger.info(f"   시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)

    start = time.time()
    results = []

    for script, desc, timeout in PREVIEW_PIPELINE:
        if quick and ("ML" in desc or "AI" in desc):
            logger.info(f"⏭ 건너뜀: {desc} (Quick 모드)")
            continue
        ok = run_script(script, desc, timeout)
        results.append((desc, ok))

    elapsed = time.time() - start
    success = sum(1 for _, ok in results if ok)
    total = len(results)

    logger.info("=" * 60)
    logger.info(f"🇺🇸 US Market 업데이트 완료: {success}/{total} ({elapsed:.0f}초)")
    logger.info("=" * 60)

    # 텔레그램 리포트 전송
    if not no_telegram:
        try:
            report = build_us_telegram_report()
            if report:
                send_telegram(report)
                logger.info("📬 텔레그램 리포트 전송 완료")
        except Exception as e:
            logger.error(f"❌ 텔레그램 전송 실패: {e}")

    return success == total


def main():
    parser = argparse.ArgumentParser(description='US Market 통합 업데이트')
    parser.add_argument('--quick', action='store_true', help='AI/ML 스킵 (빠른 모드)')
    parser.add_argument('--test', action='store_true', help='텔레그램 테스트만')
    parser.add_argument('--no-telegram', action='store_true', help='텔레그램 전송 안 함')
    args = parser.parse_args()

    if args.test:
        logger.info("📬 텔레그램 테스트 전송...")
        report = build_us_telegram_report()
        if report:
            ok = send_telegram(report)
            logger.info(f"결과: {'성공' if ok else '실패'}")
        else:
            logger.warning("리포트 생성 실패 — 데이터 파일이 없습니다")
        return

    run_full_update(quick=args.quick, no_telegram=args.no_telegram)


if __name__ == "__main__":
    main()

# app/utils/scheduler.py
"""백그라운드 스케줄러 - V2 엔진 연동

경로: 절대 경로 기반 (고정)
데이터: data/jongga_v2_latest.json (V2 엔진 결과)
"""

import os
import json
import time
import threading

# ── 고정 경로 ──────────────────────────────────────────────
_APP_DIR = os.path.dirname(os.path.abspath(__file__))       # app/utils/
_APP_ROOT = os.path.dirname(_APP_DIR)                        # app/
BASE_DIR = os.path.dirname(_APP_ROOT)                        # /c/closing_bet
DATA_DIR = os.path.join(BASE_DIR, 'data')


def start_kr_price_scheduler():
    """KR 종가베팅 V2 가격 업데이트 스케줄러 (5분 간격)

    - data/jongga_v2_latest.json 기반
    - pykrx로 현재가 갱신
    - 시그널별 수익률 재계산
    """
    def _run_scheduler():
        print(f"[Scheduler] KR Price Updater started (base={BASE_DIR})", flush=True)

        while True:
            try:
                latest_path = os.path.join(DATA_DIR, 'jongga_v2_latest.json')
                if not os.path.exists(latest_path):
                    time.sleep(60)
                    continue

                with open(latest_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                signals = data.get('signals', [])
                if not signals:
                    time.sleep(300)
                    continue

                # pykrx로 현재가 업데이트
                updated = 0
                for sig in signals:
                    code = sig.get('stock_code', '')
                    entry = sig.get('entry_price', 0)
                    if not code or entry <= 0:
                        continue

                    try:
                        from pykrx import stock as pykrx_stock
                        from datetime import date
                        today = date.today().strftime("%Y%m%d")
                        df = pykrx_stock.get_market_ohlcv(today, today, code)
                        if not df.empty:
                            cur = int(df.iloc[-1]['종가'])
                            if cur > 0:
                                sig['current_price'] = cur
                                sig['return_pct'] = round(((cur - entry) / entry) * 100, 2)
                                updated += 1
                    except Exception:
                        pass

                    time.sleep(2)  # Rate limit

                if updated > 0:
                    with open(latest_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    print(f"[Scheduler] {updated}/{len(signals)} prices updated", flush=True)

                time.sleep(300)  # 5분 대기

            except Exception as e:
                print(f"[Scheduler] Error: {e}", flush=True)
                time.sleep(60)

    thread = threading.Thread(target=_run_scheduler, daemon=True)
    thread.start()

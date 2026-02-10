# app/utils/scheduler.py
"""백그라운드 스케줄러"""

import os
import json
import time
import threading


def start_kr_price_scheduler():
    """KR 가격 업데이트 스케줄러 시작 (5분 간격, 10초 스태거)"""
    def _run_scheduler():
        print("⏰ KR Price Scheduler started (5min interval, 10s stagger)")
        while True:
            try:
                # 1. Load existing analysis data
                json_path = 'data/kr_ai_analysis.json'
                if not os.path.exists(json_path):
                    time.sleep(60)
                    continue

                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                signals = data.get('signals', [])
                if not signals:
                    time.sleep(300)
                    continue

                # 2. Iterate and update
                updated_count = 0
                for signal in signals:
                    ticker = signal.get('ticker')
                    if not ticker:
                        continue

                    try:
                        # Fetch current price
                        from kr_ai_analyzer import fetch_current_price
                        current_price = fetch_current_price(ticker)
                        
                        if current_price > 0:
                            entry = signal.get('entry_price', 0)
                            signal['current_price'] = current_price
                            if entry > 0:
                                signal['return_pct'] = round(((current_price - entry) / entry) * 100, 2)
                            
                            with open(json_path, 'w', encoding='utf-8') as f:
                                json.dump(data, f, ensure_ascii=False, indent=2)
                            
                            print(f"🔄 Updated price for {signal.get('name')} ({ticker}): {current_price}")
                            updated_count += 1
                        
                    except Exception as e:
                        print(f"Error updating price for {ticker}: {e}")

                    # 3. Stagger delay
                    time.sleep(10)

                print(f"✅ Completed 5-min price update cycle ({updated_count} updated). Sleeping...")
                time.sleep(300)

            except Exception as e:
                print(f"Scheduler error: {e}")
                time.sleep(60)

    # Start daemon thread
    thread = threading.Thread(target=_run_scheduler, daemon=True)
    thread.start()

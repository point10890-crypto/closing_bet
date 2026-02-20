
import sys
import os
import io
# 한글 출력 인코딩 설정 (macOS/Linux)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    from pykrx import stock
    from datetime import datetime, timedelta

    print("Pykrx version:", stock.__file__)

    today = datetime.now().strftime('%Y%m%d')
    print(f"Today: {today}")

    # 1. 오늘 날짜 시도
    print(f"\n[Attempt 1] Fetching OHLCV for {today}...")
    try:
        df = stock.get_market_ohlcv(today, market="KOSPI")
        print(f"Result: {len(df)} rows")
        if not df.empty:
            print(df.head())
    except Exception as e:
        print(f"Error: {e}")

    # 2. 어제 날짜 시도
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y%m%d')
    print(f"\n[Attempt 2] Fetching OHLCV for {yesterday}...")
    try:
        df = stock.get_market_ohlcv(yesterday, market="KOSPI")
        print(f"Result: {len(df)} rows")
        if not df.empty:
            print(df.head())
    except Exception as e:
        print(f"Error: {e}")

    # 3. 그제 날짜 시도
    day_before = (datetime.now() - timedelta(days=2)).strftime('%Y%m%d')
    print(f"\n[Attempt 3] Fetching OHLCV for {day_before}...")
    try:
        df = stock.get_market_ohlcv(day_before, market="KOSPI")
        print(f"Result: {len(df)} rows")
        if not df.empty:
            print(df.head())
    except Exception as e:
        print(f"Error: {e}")

except ImportError:
    print("Pykrx not installed")
except Exception as e:
    print(f"Unexpected error: {e}")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR Market - Full Historical Backtest
과거 시그널 기반 정확한 백테스트

1. 과거 수급 데이터 → 시그널 생성
2. 시그널 발생일 다음날 매수 → N일 후 청산
3. 거래비용 반영
"""
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

print("=" * 80)
print("🚀 과거 시그널 기반 정확한 백테스트")
print("=" * 80)

# 설정
HOLD_DAYS = 10          # 보유 기간
TOTAL_COST_PCT = 0.36   # 총 거래비용

# 1. 과거 시그널 로드
signals_path = 'kr_market/historical_signals.csv'
if not os.path.exists(signals_path):
    print("❌ 시그널 파일이 없습니다. collect_historical_data.py를 먼저 실행하세요.")
    exit()

signals_df = pd.read_csv(signals_path)
signals_df['signal_date'] = pd.to_datetime(signals_df['signal_date'])
signals_df['ticker'] = signals_df['ticker'].astype(str).str.zfill(6)

print(f"📊 시그널 로드: {len(signals_df)}개")
print(f"   기간: {signals_df['signal_date'].min()} ~ {signals_df['signal_date'].max()}")

# 2. 가격 데이터 로드
print("\n📈 가격 데이터 로딩...")
signal_tickers = signals_df['ticker'].unique().tolist()

chunks = pd.read_csv('daily_prices.csv', chunksize=100000, low_memory=False)
prices = []
for chunk in chunks:
    chunk['ticker'] = chunk['ticker'].astype(str).str.zfill(6)
    filtered = chunk[chunk['ticker'].isin(signal_tickers)]
    if len(filtered) > 0:
        prices.append(filtered)

price_df = pd.concat(prices) if prices else pd.DataFrame()
price_df['date'] = pd.to_datetime(price_df['date'])
print(f"   가격 데이터: {len(price_df):,} rows")

# 3. 백테스트 실행
print(f"\n📊 백테스트 실행 (보유기간: {HOLD_DAYS}일)...")
results = []

for _, sig in signals_df.iterrows():
    ticker = sig['ticker']
    signal_date = sig['signal_date']
    
    # 해당 종목 가격 데이터
    ticker_prices = price_df[price_df['ticker'] == ticker].sort_values('date')
    
    # 시그널 다음날 이후 데이터
    after_signal = ticker_prices[ticker_prices['date'] > signal_date]
    
    if len(after_signal) >= 2:
        # 시그널 다음날 시가(또는 종가) 매수
        entry_date = after_signal.iloc[0]['date']
        entry_price = after_signal.iloc[0]['current_price']
        
        # N일 후 청산 (또는 마지막 날)
        exit_idx = min(HOLD_DAYS, len(after_signal) - 1)
        exit_date = after_signal.iloc[exit_idx]['date']
        exit_price = after_signal.iloc[exit_idx]['current_price']
        
        # 수익률 계산
        gross_return = (exit_price - entry_price) / entry_price * 100
        net_return = gross_return - TOTAL_COST_PCT
        
        results.append({
            'ticker': ticker,
            'signal_date': signal_date.strftime('%Y-%m-%d'),
            'entry_date': entry_date.strftime('%Y-%m-%d'),
            'exit_date': exit_date.strftime('%Y-%m-%d'),
            'entry_price': entry_price,
            'exit_price': exit_price,
            'foreign_sum': sig['foreign_sum'],
            'inst_sum': sig['inst_sum'],
            'consecutive_days': sig['consecutive_days'],
            'gross_return': gross_return,
            'net_return': net_return,
            'is_winner': net_return > 0,
            'hold_days': exit_idx
        })

# 4. 결과 분석
df = pd.DataFrame(results)

print("\n" + "=" * 80)
print("📊 백테스트 결과 - 과거 시그널 기반")
print("=" * 80)

if len(df) > 0:
    total = len(df)
    winners = df['is_winner'].sum()
    losers = total - winners
    
    avg_gross = df['gross_return'].mean()
    avg_net = df['net_return'].mean()
    total_return = df['net_return'].sum()
    
    avg_win = df[df['is_winner']]['net_return'].mean() if winners > 0 else 0
    avg_loss = df[~df['is_winner']]['net_return'].mean() if losers > 0 else 0
    pf = abs(avg_win / avg_loss) if avg_loss != 0 else 0
    
    max_win = df['net_return'].max()
    max_loss = df['net_return'].min()
    
    print(f"\n   📈 총 거래: {total}")
    print(f"   ✅ 승리: {winners} | ❌ 패배: {losers}")
    print(f"   🎯 승률: {winners/total*100:.1f}%")
    print(f"")
    print(f"   💰 평균 수익률 (비용 전): {avg_gross:+.2f}%")
    print(f"   💰 평균 수익률 (비용 후): {avg_net:+.2f}%")
    print(f"   📈 누적 수익률: {total_return:+.2f}%")
    print(f"")
    print(f"   ✅ 평균 수익 (승): {avg_win:+.2f}%")
    print(f"   ❌ 평균 손실 (패): {avg_loss:+.2f}%")
    print(f"   📊 Profit Factor: {pf:.2f}")
    print(f"")
    print(f"   🔥 최대 수익: {max_win:+.2f}%")
    print(f"   💀 최대 손실: {max_loss:+.2f}%")
    
    # 개별 거래 내역
    print("\n" + "-" * 60)
    print("📋 개별 거래 내역")
    print("-" * 60)
    
    for _, r in df.sort_values('signal_date').iterrows():
        emoji = '✅' if r['is_winner'] else '❌'
        print(f"{emoji} {r['signal_date']} | {r['ticker']} | "
              f"{r['entry_price']:,.0f} → {r['exit_price']:,.0f} | "
              f"{r['net_return']:+.2f}% | {r['hold_days']}일")
    
    # 저장
    output_path = 'kr_market/historical_backtest_results.csv'
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"\n📁 저장됨: {output_path}")
    
    # 최종 판정
    print("\n" + "=" * 80)
    print("💡 최종 판정")
    print("=" * 80)
    
    if avg_net > 1.0 and pf > 1.5 and winners/total > 0.5:
        print("   ✅ 실전 적용 가능!")
        print(f"   - 승률 {winners/total*100:.0f}% > 50%")
        print(f"   - Profit Factor {pf:.2f} > 1.5")
        print(f"   - 평균 수익 {avg_net:.2f}% > 1%")
    elif avg_net > 0 and pf > 1.0:
        print("   ⚠️ 조건부 적용 가능")
        print("   - 손절 철저히 적용 필요")
        print("   - 점수 높은 시그널만 선별 권장")
    else:
        print("   ❌ 추가 검증 필요")
        print("   - 로직 개선 또는 필터 강화 필요")

else:
    print("⚠️ 백테스트 결과가 없습니다.")

print("\n" + "=" * 80)
print("✅ 백테스트 완료")
print("=" * 80)

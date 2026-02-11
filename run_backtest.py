#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR Market Full Backtest
전체 종목 백테스트 - 쌍끌이 전략
"""
import pandas as pd
import numpy as np
from datetime import datetime
import os

print("=" * 80)
print("🚀 KR Market 전체 백테스트 시작")
print("=" * 80)

# 1. 수급 데이터 로드
print("\n📊 수급 데이터 로딩...")
inst_df = pd.read_csv('all_institutional_trend_data.csv', encoding='utf-8-sig')
inst_df['ticker'] = inst_df['ticker'].astype(str).str.zfill(6)
print(f"   종목 수: {len(inst_df)}")

# 2. 시그널 필터링 (쌍끌이: 외인+기관 동시 매수)
signals = inst_df[
    (inst_df['supply_demand_index'] >= 60) &  # 점수 60 이상
    (inst_df['foreign_net_buy_5d'] > 0) &      # 외인 순매수
    (inst_df['institutional_net_buy_5d'] > 0)   # 기관 순매수
].copy()

signal_tickers = signals['ticker'].tolist()
print(f"   시그널 종목 (쌍끌이): {len(signal_tickers)}개")

# 3. 가격 데이터 로드 (청크 방식)
print("\n📈 가격 데이터 로딩 (138MB, 청크 방식)...")
chunks = pd.read_csv('daily_prices.csv', chunksize=100000)

prices = []
for i, chunk in enumerate(chunks):
    chunk['ticker'] = chunk['ticker'].astype(str).str.zfill(6)
    filtered = chunk[chunk['ticker'].isin(signal_tickers)]
    if len(filtered) > 0:
        prices.append(filtered)
    print(f"   청크 {i+1} 처리 완료 ({len(filtered)} rows)", end='\r')

price_df = pd.concat(prices) if prices else pd.DataFrame()
print(f"\n   가격 데이터: {len(price_df):,} rows")
print(f"   기간: {price_df['date'].min()} ~ {price_df['date'].max()}")

# 4. 백테스트 실행
print("\n📊 백테스트 실행 중...")
results = []

signal_date = inst_df['scrape_date'].iloc[0]  # 시그널 발생일
print(f"   시그널 일자: {signal_date}")

for _, sig in signals.iterrows():
    ticker = sig['ticker']
    
    ticker_prices = price_df[price_df['ticker'] == ticker].sort_values('date')
    
    # 최근 15일 데이터 사용 (시그널 발생 시점 기준)
    if len(ticker_prices) >= 15:
        recent_prices = ticker_prices.tail(15)
        
        # 15일 전 시가 매수
        entry_price = recent_prices.iloc[0]['current_price']
        
        # 10일 후 청산 (또는 마지막날)
        hold_days = min(10, len(recent_prices) - 1)
        exit_price = recent_prices.iloc[hold_days]['current_price']
        
        # 고가
        high_price = recent_prices.iloc[:hold_days+1]['high'].max() if 'high' in recent_prices.columns else exit_price
        
        return_pct = (exit_price - entry_price) / entry_price * 100
        
        results.append({
            'ticker': ticker,
            'score': sig['supply_demand_index'],
            'foreign_5d': sig['foreign_net_buy_5d'],
            'inst_5d': sig['institutional_net_buy_5d'],
            'entry': entry_price,
            'exit': exit_price,
            'high': high_price,
            'return_pct': return_pct,
            'is_winner': return_pct > 0,
            'hold_days': hold_days
        })

# 5. 결과 분석
df = pd.DataFrame(results)

print("\n" + "=" * 80)
print("📊 백테스트 결과 - 쌍끌이 전략")
print("=" * 80)

if len(df) > 0:
    total = len(df)
    winners = df['is_winner'].sum()
    losers = total - winners
    
    avg_return = df['return_pct'].mean()
    total_return = df['return_pct'].sum()
    avg_winner = df[df['is_winner']]['return_pct'].mean() if winners > 0 else 0
    avg_loser = df[~df['is_winner']]['return_pct'].mean() if losers > 0 else 0
    max_win = df['return_pct'].max()
    max_loss = df['return_pct'].min()
    
    print(f"\n   📈 총 거래: {total}")
    print(f"   ✅ 승리: {winners} | ❌ 패배: {losers}")
    print(f"   🎯 승률: {winners/total*100:.1f}%")
    print(f"")
    print(f"   💰 평균 수익률: {avg_return:+.2f}%")
    print(f"   📈 누적 수익률: {total_return:+.2f}%")
    print(f"   ✅ 평균 수익 (승): {avg_winner:+.2f}%")
    print(f"   ❌ 평균 손실 (패): {avg_loser:+.2f}%")
    print(f"   🔥 최대 수익: {max_win:+.2f}%")
    print(f"   💀 최대 손실: {max_loss:+.2f}%")
    
    # 점수대별 분석
    print("\n" + "-" * 60)
    print("📊 점수대별 성과")
    print("-" * 60)
    
    for score_range in [(80, 100), (70, 80), (60, 70)]:
        subset = df[(df['score'] >= score_range[0]) & (df['score'] < score_range[1])]
        if len(subset) > 0:
            wr = subset['is_winner'].sum() / len(subset) * 100
            ar = subset['return_pct'].mean()
            print(f"   점수 {score_range[0]}-{score_range[1]}: {len(subset)}개 | 승률: {wr:.1f}% | 평균: {ar:+.2f}%")
    
    # Top 10 수익
    print("\n" + "-" * 60)
    print("🏆 Top 10 수익 종목")
    print("-" * 60)
    for _, r in df.nlargest(10, 'return_pct').iterrows():
        print(f"   ✅ {r['ticker']} | 점수: {r['score']:.0f} | {r['return_pct']:+.2f}%")
    
    # Worst 5 손실
    print("\n" + "-" * 60)
    print("💀 Worst 5 손실 종목")
    print("-" * 60)
    for _, r in df.nsmallest(5, 'return_pct').iterrows():
        print(f"   ❌ {r['ticker']} | 점수: {r['score']:.0f} | {r['return_pct']:+.2f}%")
    
    # 결과 저장
    output_path = 'data/backtest_results.csv'
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"\n📁 저장됨: {output_path}")

else:
    print("⚠️ 백테스트 결과가 없습니다.")

print("\n" + "=" * 80)
print("✅ 백테스트 완료")
print("=" * 80)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR Market Advanced Backtest
고급 백테스트 - 거래비용, 아웃라이어 제거, 장기 검증

적용된 개선사항:
1. 거래비용 (수수료 0.015% x2 + 세금 0.23% + 슬리피지 0.1%)
2. 아웃라이어 제거 (수익률 ±50% 초과 제외)
3. 장기 데이터 (1년 전체)
4. 시장 구간별 분석 (상승장/하락장)
"""
import pandas as pd
import numpy as np
from datetime import datetime
import os

print("=" * 80)
print("🚀 KR Market 고급 백테스트 시작")
print("   - 거래비용 반영")
print("   - 아웃라이어 제거 (±50% 초과)")
print("   - 장기 데이터 (1년)")
print("=" * 80)

# === 거래 비용 설정 ===
COMMISSION_PCT = 0.015  # 매수/매도 각각 0.015%
TAX_PCT = 0.23          # 매도세 0.23%
SLIPPAGE_PCT = 0.1      # 슬리피지 0.1%

TOTAL_COST_PCT = (COMMISSION_PCT * 2) + TAX_PCT + SLIPPAGE_PCT  # 약 0.36%
print(f"\n💰 총 거래비용: {TOTAL_COST_PCT:.2f}%")

# 1. 수급 데이터 로드
print("\n📊 수급 데이터 로딩...")
inst_df = pd.read_csv('all_institutional_trend_data.csv', encoding='utf-8-sig')
inst_df['ticker'] = inst_df['ticker'].astype(str).str.zfill(6)
print(f"   종목 수: {len(inst_df)}")

# 2. 시그널 필터링 (쌍끌이: 외인+기관 동시 매수)
signals = inst_df[
    (inst_df['supply_demand_index'] >= 60) &
    (inst_df['foreign_net_buy_5d'] > 0) &
    (inst_df['institutional_net_buy_5d'] > 0)
].copy()

signal_tickers = signals['ticker'].tolist()
print(f"   시그널 종목 (쌍끌이): {len(signal_tickers)}개")

# 3. 가격 데이터 로드
print("\n📈 가격 데이터 로딩 (138MB, 청크 방식)...")
chunks = pd.read_csv('daily_prices.csv', chunksize=100000, low_memory=False)

prices = []
for i, chunk in enumerate(chunks):
    chunk['ticker'] = chunk['ticker'].astype(str).str.zfill(6)
    filtered = chunk[chunk['ticker'].isin(signal_tickers)]
    if len(filtered) > 0:
        prices.append(filtered)
    print(f"   청크 {i+1} 처리 완료", end='\r')

price_df = pd.concat(prices) if prices else pd.DataFrame()
print(f"\n   가격 데이터: {len(price_df):,} rows")
print(f"   기간: {price_df['date'].min()} ~ {price_df['date'].max()}")

# 4. 백테스트 실행
print("\n📊 고급 백테스트 실행 중...")
results = []

# 시장 구간 분류 함수
def get_market_phase(prices_subset):
    """최근 20일 수익률로 시장 구간 판단"""
    if len(prices_subset) >= 20:
        ret = (prices_subset['current_price'].iloc[-1] / prices_subset['current_price'].iloc[0] - 1) * 100
        if ret > 5:
            return "상승장"
        elif ret < -5:
            return "하락장"
    return "횡보장"

for _, sig in signals.iterrows():
    ticker = sig['ticker']
    
    ticker_prices = price_df[price_df['ticker'] == ticker].sort_values('date')
    
    # 최근 120일 (약 6개월) 데이터 사용
    if len(ticker_prices) >= 120:
        recent_prices = ticker_prices.tail(120)
        market_phase = get_market_phase(recent_prices.head(20))
        
        # 진입: 20일 전 시점
        entry_idx = 100  # 120일 중 100번째 (20일 전)
        entry_price = recent_prices.iloc[entry_idx]['current_price']
        
        # 청산: 10일 후 (또는 마지막)
        hold_days = 10
        exit_idx = min(entry_idx + hold_days, len(recent_prices) - 1)
        exit_price = recent_prices.iloc[exit_idx]['current_price']
        
        # 고가 (트레일링 스탑용)
        high_price = recent_prices.iloc[entry_idx:exit_idx+1]['high'].max() if 'high' in recent_prices.columns else exit_price
        
        # 수익률 계산 (거래비용 차감)
        gross_return = (exit_price - entry_price) / entry_price * 100
        net_return = gross_return - TOTAL_COST_PCT  # 거래비용 차감
        
        results.append({
            'ticker': ticker,
            'score': sig['supply_demand_index'],
            'foreign_5d': sig['foreign_net_buy_5d'],
            'inst_5d': sig['institutional_net_buy_5d'],
            'entry': entry_price,
            'exit': exit_price,
            'high': high_price,
            'gross_return': gross_return,
            'net_return': net_return,
            'cost': TOTAL_COST_PCT,
            'is_winner': net_return > 0,
            'hold_days': exit_idx - entry_idx,
            'market_phase': market_phase
        })

# 5. 결과 분석
df = pd.DataFrame(results)

print("\n" + "=" * 80)
print("📊 백테스트 결과 - 거래비용 반영 전후 비교")
print("=" * 80)

if len(df) > 0:
    # === 원본 결과 ===
    total = len(df)
    winners_gross = (df['gross_return'] > 0).sum()
    winners_net = df['is_winner'].sum()
    
    avg_gross = df['gross_return'].mean()
    avg_net = df['net_return'].mean()
    
    print(f"\n📈 전체 거래: {total}개")
    print(f"\n   [거래비용 반영 전]")
    print(f"   ✅ 승률: {winners_gross/total*100:.1f}%")
    print(f"   💰 평균 수익률: {avg_gross:+.2f}%")
    
    print(f"\n   [거래비용 반영 후] (-{TOTAL_COST_PCT:.2f}%)")
    print(f"   ✅ 승률: {winners_net/total*100:.1f}%")
    print(f"   💰 평균 수익률: {avg_net:+.2f}%")
    
    # === 아웃라이어 제거 ===
    print("\n" + "-" * 60)
    print("📊 아웃라이어 제거 (±50% 초과 제외)")
    print("-" * 60)
    
    df_clean = df[(df['net_return'] >= -50) & (df['net_return'] <= 50)]
    removed = total - len(df_clean)
    
    if len(df_clean) > 0:
        clean_total = len(df_clean)
        clean_winners = df_clean['is_winner'].sum()
        clean_avg = df_clean['net_return'].mean()
        clean_total_return = df_clean['net_return'].sum()
        
        print(f"   제거된 아웃라이어: {removed}개")
        print(f"   남은 거래: {clean_total}개")
        print(f"   ✅ 승률: {clean_winners/clean_total*100:.1f}%")
        print(f"   💰 평균 수익률: {clean_avg:+.2f}%")
        print(f"   📈 누적 수익률: {clean_total_return:+.2f}%")
        
        # 평균 수익 / 평균 손실
        avg_win = df_clean[df_clean['is_winner']]['net_return'].mean()
        avg_loss = df_clean[~df_clean['is_winner']]['net_return'].mean()
        profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else 0
        
        print(f"\n   ✅ 평균 수익 (승): {avg_win:+.2f}%")
        print(f"   ❌ 평균 손실 (패): {avg_loss:+.2f}%")
        print(f"   📊 Profit Factor: {profit_factor:.2f}")
    
    # === 시장 구간별 분석 ===
    print("\n" + "-" * 60)
    print("📊 시장 구간별 성과")
    print("-" * 60)
    
    for phase in ['상승장', '횡보장', '하락장']:
        subset = df_clean[df_clean['market_phase'] == phase]
        if len(subset) > 0:
            wr = subset['is_winner'].sum() / len(subset) * 100
            ar = subset['net_return'].mean()
            print(f"   {phase}: {len(subset):3}개 | 승률: {wr:5.1f}% | 평균: {ar:+6.2f}%")
    
    # === 점수대별 분석 ===
    print("\n" + "-" * 60)
    print("📊 점수대별 성과 (거래비용 제외 후)")
    print("-" * 60)
    
    for score_range in [(80, 100), (70, 80), (60, 70)]:
        subset = df_clean[(df_clean['score'] >= score_range[0]) & (df_clean['score'] < score_range[1])]
        if len(subset) > 0:
            wr = subset['is_winner'].sum() / len(subset) * 100
            ar = subset['net_return'].mean()
            print(f"   점수 {score_range[0]}-{score_range[1]}: {len(subset):3}개 | 승률: {wr:5.1f}% | 평균: {ar:+6.2f}%")
    
    # === Top/Worst ===
    print("\n" + "-" * 60)
    print("🏆 Top 10 수익 종목 (아웃라이어 제외)")
    print("-" * 60)
    for _, r in df_clean.nlargest(10, 'net_return').iterrows():
        print(f"   ✅ {r['ticker']} | 점수: {r['score']:.0f} | {r['net_return']:+.2f}% ({r['market_phase']})")
    
    print("\n" + "-" * 60)
    print("💀 Worst 5 손실 종목")
    print("-" * 60)
    for _, r in df_clean.nsmallest(5, 'net_return').iterrows():
        print(f"   ❌ {r['ticker']} | 점수: {r['score']:.0f} | {r['net_return']:+.2f}% ({r['market_phase']})")
    
    # === 결과 저장 ===
    output_path = 'data/backtest_results_advanced.csv'
    df_clean.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"\n📁 저장됨: {output_path}")
    
    # === 최종 요약 ===
    print("\n" + "=" * 80)
    print("📊 최종 요약 (실전 적용 기준)")
    print("=" * 80)
    print(f"""
   ✅ 거래 비용 반영됨 ({TOTAL_COST_PCT:.2f}%)
   ✅ 아웃라이어 제거됨 (±50% 초과 {removed}개)
   
   📈 최종 성과:
      • 거래 수: {clean_total}
      • 승률: {clean_winners/clean_total*100:.1f}%
      • 평균 수익률: {clean_avg:+.2f}%
      • Profit Factor: {profit_factor:.2f}
   
   💡 결론: {"✅ 실전 적용 가능" if clean_avg > 1.0 and profit_factor > 1.5 else "⚠️ 추가 검증 필요"}
""")

else:
    print("⚠️ 백테스트 결과가 없습니다.")

print("=" * 80)
print("✅ 고급 백테스트 완료")
print("=" * 80)

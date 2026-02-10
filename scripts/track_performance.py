#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
추천 종목 성과 추적 스크립트
recommendation_history.csv에 저장된 과거 추천 종목들의 현재 수익률을 계산합니다.
"""

import pandas as pd
import os
from datetime import datetime

def track_performance():
    data_dir = '.'
    history_file = os.path.join(data_dir, 'recommendation_history.csv')
    prices_file = os.path.join(data_dir, 'daily_prices.csv')
    
    if not os.path.exists(history_file):
        print("❌ 추천 이력 파일(recommendation_history.csv)이 없습니다.")
        print("   먼저 run_analysis.py를 실행하여 추천 이력을 생성해주세요.")
        return

    if not os.path.exists(prices_file):
        print("❌ 시세 데이터 파일(daily_prices.csv)이 없습니다.")
        return
        
    print("📊 추천 종목 성과 분석 중...")
    
    try:
        # 데이터 로드
        history_df = pd.read_csv(history_file, dtype={'ticker': str})
        prices_df = pd.read_csv(prices_file, dtype={'ticker': str})
        
        # 최신 가격 정보 추출
        # 날짜순 정렬 후 각 종목별 마지막 데이터 선택
        latest_prices = prices_df.sort_values('date').groupby('ticker').last()['current_price']
        latest_dates = prices_df.sort_values('date').groupby('ticker').last()['date']
        
        print(f"   총 추천 이력: {len(history_df)}건")
        
        results = []
        
        for idx, row in history_df.iterrows():
            ticker = row['ticker']
            rec_price = float(row['current_price'])
            rec_date = row['recommendation_date']
            
            if ticker in latest_prices.index:
                curr_price = float(latest_prices[ticker])
                curr_date = latest_dates[ticker]
                
                # 수익률 계산
                if rec_price > 0:
                    return_rate = (curr_price - rec_price) / rec_price * 100
                else:
                    return_rate = 0
                
                # 보유 기간 계산
                days_held = (pd.to_datetime(curr_date) - pd.to_datetime(rec_date)).days
                
                results.append({
                    'ticker': ticker,
                    'name': row.get('name', ticker),
                    'rec_date': rec_date,
                    'rec_price': rec_price,
                    'curr_price': curr_price,
                    'return': return_rate,
                    'days': days_held,
                    'score': row.get('final_investment_score', 0),
                    'grade': row.get('investment_grade', 'N/A')
                })
                
        if not results:
            print("⚠️ 성과를 계산할 수 있는 데이터가 없습니다.")
            return

        res_df = pd.DataFrame(results)
        
        # 결과 출력
        print("\n" + "="*80)
        print("📈 추천 종목 성과 리포트")
        print("="*80)
        
        # 전체 통계
        avg_return = res_df['return'].mean()
        win_rate = (res_df['return'] > 0).mean() * 100
        
        print(f"• 총 분석 대상: {len(res_df)}건")
        print(f"• 평균 수익률: {avg_return:+.2f}%")
        print(f"• 승률 (수익 종목 비율): {win_rate:.1f}%")
        
        # 기간별 성과 (최근 1주일, 1개월 등)
        # 여기서는 간단하게 전체 출력
        
        print("\n🏆 수익률 Top 5")
        print("-" * 80)
        print(f"{'종목명':<10} {'추천일':<12} {'추천가':>10} {'현재가':>10} {'수익률':>10} {'보유일':>6}")
        print("-" * 80)
        
        top_performers = res_df.sort_values('return', ascending=False).head(5)
        for _, row in top_performers.iterrows():
            print(f"{row['name']:<10} {row['rec_date']:<12} {row['rec_price']:>10,.0f} {row['curr_price']:>10,.0f} {row['return']:>+9.1f}% {row['days']:>5}일")
            
        print("\n💀 수익률 Bottom 5")
        print("-" * 80)
        worst_performers = res_df.sort_values('return', ascending=True).head(5)
        for _, row in worst_performers.iterrows():
            print(f"{row['name']:<10} {row['rec_date']:<12} {row['rec_price']:>10,.0f} {row['curr_price']:>10,.0f} {row['return']:>+9.1f}% {row['days']:>5}일")
            
        print("="*80)
        
        # 파일로 저장
        output_path = os.path.join(data_dir, 'performance_report.csv')
        res_df.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f"\n📄 상세 성과 리포트 저장: {output_path}")

    except Exception as e:
        print(f"❌ 성과 분석 중 오류 발생: {e}")
    
if __name__ == "__main__":
    track_performance()

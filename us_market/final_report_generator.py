#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Final Top 10 Report Generator
Combines quantitative scores with AI analysis for final picks
"""

import os
import json
import logging
import pandas as pd
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
HISTORY_DIR = os.path.join(os.path.dirname(__file__), 'history')


class FinalReportGenerator:
    def __init__(self, data_dir=None):
        self.data_dir = data_dir or DATA_DIR
        self.history_dir = HISTORY_DIR
        os.makedirs(self.history_dir, exist_ok=True)

    def run(self, top_n=10):
        stats_path = os.path.join(self.data_dir, 'smart_money_picks_v2.csv')
        if not os.path.exists(stats_path):
            logger.error("❌ Smart money picks not found")
            return

        df = pd.read_csv(stats_path)

        # Load AI Data
        ai_path = os.path.join(self.data_dir, 'ai_summaries.json')
        ai_data = {}
        if os.path.exists(ai_path):
            with open(ai_path) as f:
                ai_data = json.load(f)

        results = []
        for _, row in df.iterrows():
            ticker = row['ticker']
            summary = ""
            if ticker in ai_data:
                summary = ai_data[ticker].get('summary', '')

            # AI Bonus Score
            ai_score = 0
            rec = "Hold"
            if "매수" in summary or "Buy" in summary.lower():
                ai_score = 10
                rec = "Buy"
            if "적극" in summary or "strong" in summary.lower():
                ai_score = 20
                rec = "Strong Buy"

            final_score = row['composite_score'] * 0.8 + ai_score

            results.append({
                'ticker': ticker,
                'name': row.get('name', ticker),
                'final_score': round(final_score, 1),
                'quant_score': row['composite_score'],
                'ai_recommendation': rec,
                'current_price': row.get('current_price', 0),
                'price_at_analysis': row.get('current_price', 0),
                'ai_summary': summary,
                'grade': row.get('grade', 'N/A'),
                'sector': row.get('size', 'N/A')
            })

        results.sort(key=lambda x: x['final_score'], reverse=True)
        top_picks = results[:top_n]
        for i, p in enumerate(top_picks, 1):
            p['rank'] = i

        today = datetime.now().strftime('%Y-%m-%d')

        # Save current report
        report = {
            'analysis_date': today,
            'analysis_timestamp': datetime.now().isoformat(),
            'picks': top_picks,
            'total_analyzed': len(df)
        }

        # Save for API
        with open(os.path.join(self.data_dir, 'final_top10_report.json'), 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        # Save for dashboard (smart_money_current.json)
        with open(os.path.join(self.data_dir, 'smart_money_current.json'), 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        # Save history
        history_file = os.path.join(self.history_dir, f'picks_{today}.json')
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        logger.info(f"✅ Generated Final Report for {len(top_picks)} stocks")
        logger.info(f"   History saved: {history_file}")

        # Print summary
        for p in top_picks:
            print(f"   #{p['rank']} {p['ticker']}: Score {p['final_score']} | {p['ai_recommendation']}")


if __name__ == "__main__":
    FinalReportGenerator().run()

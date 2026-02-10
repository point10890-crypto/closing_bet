#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETF Fund Flow Analysis
Analyzes 24 major ETFs for fund flow signals using volume and price data.
Generates AI analysis using Gemini.

Tracks 24 major ETFs (SPY, QQQ, IWM, GLD, USO, etc.)
Calculates Flow Score (0-100) based on OBV, Volume Ratio, Price Momentum
Generates Gemini AI analysis for fund flow interpretation
Outputs: us_etf_flows.csv, etf_flow_analysis.json
"""

import os
import sys

# Add parent project to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import pandas as pd
import numpy as np
import yfinance as yf
import logging
import requests
from datetime import datetime
from typing import Dict, List
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set data_dir to this script's directory
data_dir = os.path.dirname(os.path.abspath(__file__))


class ETFFlowAnalyzer:
    """
    Analyze ETF fund flows using volume/price proxy indicators.
    Tracks 24 major ETFs across Broad Market, Sector, Commodity, Bond, and International categories.
    """

    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self.output_csv = os.path.join(self.data_dir, 'us_etf_flows.csv')
        self.output_json = os.path.join(self.data_dir, 'etf_flow_analysis.json')

        # 24 major ETFs to track
        self.etfs = {
            'SPY': {'name': 'S&P 500', 'category': 'Broad Market'},
            'QQQ': {'name': 'NASDAQ 100', 'category': 'Broad Market'},
            'IWM': {'name': 'Russell 2000', 'category': 'Broad Market'},
            'DIA': {'name': 'Dow Jones', 'category': 'Broad Market'},
            'XLK': {'name': 'Technology', 'category': 'Sector'},
            'XLF': {'name': 'Financials', 'category': 'Sector'},
            'XLV': {'name': 'Healthcare', 'category': 'Sector'},
            'XLE': {'name': 'Energy', 'category': 'Sector'},
            'XLY': {'name': 'Consumer Disc.', 'category': 'Sector'},
            'XLP': {'name': 'Consumer Staples', 'category': 'Sector'},
            'XLI': {'name': 'Industrials', 'category': 'Sector'},
            'XLB': {'name': 'Materials', 'category': 'Sector'},
            'XLU': {'name': 'Utilities', 'category': 'Sector'},
            'XLRE': {'name': 'Real Estate', 'category': 'Sector'},
            'XLC': {'name': 'Comm. Services', 'category': 'Sector'},
            'GLD': {'name': 'Gold', 'category': 'Commodity'},
            'SLV': {'name': 'Silver', 'category': 'Commodity'},
            'USO': {'name': 'Crude Oil', 'category': 'Commodity'},
            'TLT': {'name': '20Y Treasury', 'category': 'Bond'},
            'SHY': {'name': '1-3Y Treasury', 'category': 'Bond'},
            'LQD': {'name': 'IG Corporate', 'category': 'Bond'},
            'HYG': {'name': 'High Yield', 'category': 'Bond'},
            'EEM': {'name': 'Emerging Markets', 'category': 'International'},
            'EFA': {'name': 'Developed Markets', 'category': 'International'},
        }

    def calculate_flow_proxy(self, df: pd.DataFrame) -> Dict:
        """
        Calculate flow proxy score from volume/price data.
        Uses OBV, Volume Ratio, and Price Momentum to estimate fund flows.

        Returns dict with flow metrics and score (0-100).
        """
        if len(df) < 20:
            return None

        close = df['Close']
        volume = df['Volume']

        # OBV trend calculation
        obv = [0]
        for i in range(1, len(df)):
            if close.iloc[i] > close.iloc[i-1]:
                obv.append(obv[-1] + volume.iloc[i])
            elif close.iloc[i] < close.iloc[i-1]:
                obv.append(obv[-1] - volume.iloc[i])
            else:
                obv.append(obv[-1])

        obv_change = (obv[-1] - obv[-20]) / abs(obv[-20]) * 100 if obv[-20] != 0 else 0

        # Volume ratio (5-day avg vs 20-day avg)
        vol_5d = volume.tail(5).mean()
        vol_20d = volume.tail(20).mean()
        vol_ratio = vol_5d / vol_20d if vol_20d > 0 else 1

        # Price momentum
        ret_5d = (close.iloc[-1] / close.iloc[-5] - 1) * 100 if len(close) >= 5 else 0
        ret_20d = (close.iloc[-1] / close.iloc[-20] - 1) * 100 if len(close) >= 20 else 0

        # Flow score calculation (0-100)
        score = 50

        # OBV contribution
        if obv_change > 10:
            score += 20
        elif obv_change > 5:
            score += 10
        elif obv_change < -10:
            score -= 20
        elif obv_change < -5:
            score -= 10

        # Volume ratio contribution
        if vol_ratio > 1.5:
            score += 10
        elif vol_ratio > 1.2:
            score += 5
        elif vol_ratio < 0.7:
            score -= 5

        # Price momentum contribution
        if ret_5d > 2:
            score += 10
        elif ret_5d > 0:
            score += 5
        elif ret_5d < -2:
            score -= 10

        score = max(0, min(100, score))

        # Determine flow stage
        if score >= 70:
            stage = "Strong Inflow"
        elif score >= 55:
            stage = "Inflow"
        elif score >= 45:
            stage = "Neutral"
        elif score >= 30:
            stage = "Outflow"
        else:
            stage = "Strong Outflow"

        return {
            'current_price': round(float(close.iloc[-1]), 2),
            'return_5d': round(ret_5d, 2),
            'return_20d': round(ret_20d, 2),
            'vol_ratio': round(vol_ratio, 2),
            'obv_change': round(obv_change, 2),
            'flow_score': round(score, 1),
            'flow_stage': stage
        }

    def generate_ai_analysis(self, results_df: pd.DataFrame) -> str:
        """
        Generate AI analysis of ETF fund flows using Gemini.
        Interprets the "why" behind fund flow movements.

        Returns AI-generated analysis text.
        """
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            logger.warning("GOOGLE_API_KEY not set. Skipping AI analysis.")
            return "API Key not set. Skip AI analysis."

        summary = results_df.to_string(index=False)
        prompt = f"""Analyze the following ETF fund flow data and suggest investment strategies.

{summary}

Please provide:
1. Overall market fund flow summary (2-3 lines)
2. Notable sectors/assets (top fund inflows)
3. Sectors/assets to watch out for (fund outflows)
4. Investment strategy suggestions
Write in Korean."""

        try:
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 1500
                }
            }
            resp = requests.post(f"{url}?key={api_key}", json=payload, timeout=30)

            if resp.status_code == 200:
                data = resp.json()
                return data['candidates'][0]['content']['parts'][0]['text']
            else:
                logger.error(f"Gemini API error: {resp.status_code}")
                return f"AI analysis failed with status {resp.status_code}."

        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return "AI analysis failed."

    def run(self) -> pd.DataFrame:
        """
        Run ETF flow analysis for all tracked ETFs.
        Downloads 3-month price history, calculates flow scores,
        generates AI analysis, and saves results.
        """
        logger.info("Starting ETF Flow Analysis...")

        results = []

        for ticker, info in tqdm(self.etfs.items(), desc="Analyzing ETFs"):
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period='3mo')

                if hist.empty or len(hist) < 20:
                    logger.debug(f"Insufficient data for {ticker}")
                    continue

                flow = self.calculate_flow_proxy(hist)
                if flow:
                    results.append({
                        'ticker': ticker,
                        'name': info['name'],
                        'category': info['category'],
                        **flow
                    })

            except Exception as e:
                logger.debug(f"Error analyzing {ticker}: {e}")

        results_df = pd.DataFrame(results)

        if not results_df.empty:
            # Save CSV results
            results_df.to_csv(self.output_csv, index=False)
            logger.info(f"Saved CSV to {self.output_csv}")

            # Generate and save AI Analysis
            ai_text = self.generate_ai_analysis(results_df)

            output = {
                'timestamp': datetime.now().isoformat(),
                'ai_analysis': ai_text,
                'etf_count': len(results_df),
                'categories': results_df['category'].unique().tolist(),
                'avg_flow_score': round(results_df['flow_score'].mean(), 1),
                'top_inflow': results_df.nlargest(3, 'flow_score')[['ticker', 'name', 'flow_score']].to_dict('records'),
                'top_outflow': results_df.nsmallest(3, 'flow_score')[['ticker', 'name', 'flow_score']].to_dict('records')
            }

            with open(self.output_json, 'w', encoding='utf-8') as f:
                json.dump(output, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved AI analysis to {self.output_json}")

            # Print summary
            logger.info("\nETF Flow Summary by Category:")
            for category in results_df['category'].unique():
                cat_data = results_df[results_df['category'] == category]
                avg_score = cat_data['flow_score'].mean()
                logger.info(f"   {category}: Avg Score {avg_score:.1f}")

        else:
            logger.warning("No ETF results to save")

        return results_df


def main():
    """Main execution"""
    import argparse

    parser = argparse.ArgumentParser(description='ETF Fund Flow Analysis')
    parser.add_argument('--dir', default=None, help='Data directory')
    args = parser.parse_args()

    analyzer = ETFFlowAnalyzer(data_dir=args.dir)
    results = analyzer.run()

    if not results.empty:
        print("\nETF Flow Summary:")
        print(results[['ticker', 'name', 'category', 'flow_score', 'flow_stage']].to_string(index=False))

        # Show top inflows
        print("\nTop 5 Inflows:")
        top_5 = results.nlargest(5, 'flow_score')
        for _, row in top_5.iterrows():
            print(f"   {row['ticker']} ({row['name']}): Score {row['flow_score']} - {row['flow_stage']}")

        # Show top outflows
        print("\nTop 5 Outflows:")
        bottom_5 = results.nsmallest(5, 'flow_score')
        for _, row in bottom_5.iterrows():
            print(f"   {row['ticker']} ({row['name']}): Score {row['flow_score']} - {row['flow_stage']}")


if __name__ == "__main__":
    main()

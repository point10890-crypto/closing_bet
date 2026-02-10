#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Macro Market Analyzer
- Collects macro indicators (VIX, Yields, Commodities, etc.)
- Uses Gemini AI to generate investment strategy
"""

import os
import json
import requests
import yfinance as yf
import logging
from datetime import datetime
from typing import Dict, List
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')


class MacroDataCollector:
    def __init__(self):
        self.macro_tickers = {
            'VIX': '^VIX', 'DXY': 'DX-Y.NYB',
            '2Y_Yield': '^IRX', '10Y_Yield': '^TNX',
            'GOLD': 'GC=F', 'OIL': 'CL=F', 'BTC': 'BTC-USD',
            'SPY': 'SPY', 'QQQ': 'QQQ'
        }

    def get_current_macro_data(self) -> Dict:
        logger.info("📊 Fetching macro data...")
        macro_data = {}
        try:
            tickers = list(self.macro_tickers.values())
            data = yf.download(tickers, period='5d', progress=False)

            for name, ticker in self.macro_tickers.items():
                try:
                    if ticker not in data['Close'].columns:
                        continue
                    hist = data['Close'][ticker].dropna()
                    if len(hist) < 2:
                        continue

                    val = hist.iloc[-1]
                    prev = hist.iloc[-2]
                    change = ((val / prev) - 1) * 100

                    full_hist = yf.Ticker(ticker).history(period='1y')
                    high = full_hist['High'].max() if not full_hist.empty else 0
                    pct_high = ((val / high) - 1) * 100 if high > 0 else 0

                    macro_data[name] = {
                        'value': round(float(val), 2),
                        'change_1d': round(float(change), 2),
                        'pct_from_high': round(float(pct_high), 1)
                    }
                except:
                    pass

            if '2Y_Yield' in macro_data and '10Y_Yield' in macro_data:
                spread = macro_data['10Y_Yield']['value'] - macro_data['2Y_Yield']['value']
                macro_data['YieldSpread'] = {'value': round(spread, 2), 'change_1d': 0, 'pct_from_high': 0}

        except Exception as e:
            logger.error(f"Error: {e}")
        return macro_data

    def get_macro_news(self) -> List[Dict]:
        news = []
        try:
            import xml.etree.ElementTree as ET
            url = "https://news.google.com/rss/search?q=Federal+Reserve+Economy&hl=en-US&gl=US&ceid=US:en"
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                for item in root.findall('.//item')[:5]:
                    news.append({'title': item.find('title').text, 'source': 'Google News'})
        except:
            pass
        return news


class MacroAIAnalyzer:
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    def analyze(self, data, news, lang='ko'):
        if not self.api_key:
            return "API Key Missing - set GOOGLE_API_KEY in .env"

        prompt = self._build_prompt(data, news, lang)

        try:
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2000}
            }
            resp = requests.post(f"{self.url}?key={self.api_key}", json=payload, timeout=30)
            if resp.status_code == 200:
                return resp.json()['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            return f"Error: {e}"
        return "Failed to generate"

    def _build_prompt(self, data, news, lang):
        metrics = "\n".join([f"- {k}: {v['value']} (1d: {v['change_1d']}%)" for k, v in data.items()])
        headlines = "\n".join([n['title'] for n in news])

        if lang == 'en':
            return f"""Analyze current macro conditions and suggest strategy.
Indicators:
{metrics}
News:
{headlines}
Request: 1. Summary 2. Opportunity 3. Risks 4. Strategy. Be concise."""
        else:
            return f"""현재 시장 상황을 분석하고 전략을 제안하세요.
지표:
{metrics}
뉴스:
{headlines}
요청: 1. 요약 2. 기회(섹터) 3. 리스크 4. 구체적 전략. 한국어로 작성."""


class MultiModelAnalyzer:
    def __init__(self, data_dir=None):
        self.data_dir = data_dir or DATA_DIR
        os.makedirs(self.data_dir, exist_ok=True)
        self.collector = MacroDataCollector()
        self.gemini = MacroAIAnalyzer()

    def run(self):
        data = self.collector.get_current_macro_data()
        news = self.collector.get_macro_news()

        analysis_ko = self.gemini.analyze(data, news, 'ko')
        analysis_en = self.gemini.analyze(data, news, 'en')

        output = {
            'timestamp': datetime.now().isoformat(),
            'macro_indicators': data,
            'ai_analysis': analysis_ko
        }

        with open(os.path.join(self.data_dir, 'macro_analysis.json'), 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        output['ai_analysis'] = analysis_en
        with open(os.path.join(self.data_dir, 'macro_analysis_en.json'), 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2)

        logger.info("✅ Saved macro analysis (KO + EN)")


if __name__ == "__main__":
    MultiModelAnalyzer().run()

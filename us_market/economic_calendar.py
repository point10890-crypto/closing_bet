#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Economic Calendar with AI Impact Analysis
Fetches upcoming economic events and enriches with AI predictions
"""

import os
import json
import requests
import logging
from datetime import datetime, timedelta
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')


class EconomicCalendar:
    def __init__(self, data_dir=None):
        self.data_dir = data_dir or DATA_DIR
        os.makedirs(self.data_dir, exist_ok=True)
        self.output = os.path.join(self.data_dir, 'weekly_calendar.json')

    def get_events(self):
        events = []
        try:
            from io import StringIO
            url = "https://finance.yahoo.com/calendar/economic"
            headers = {'User-Agent': 'Mozilla/5.0'}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                dfs = pd.read_html(StringIO(resp.text))
                if dfs:
                    df = dfs[0]
                    if 'Country' in df.columns:
                        us = df[df['Country'] == 'US']
                    else:
                        us = df
                    for _, row in us.head(20).iterrows():
                        events.append({
                            'date': datetime.now().strftime('%Y-%m-%d'),
                            'event': str(row.get('Event', row.iloc[0] if len(row) > 0 else 'Unknown')),
                            'impact': 'Medium',
                            'description': f"Actual: {row.get('Actual', '-')} | Est: {row.get('Market Expectation', '-')}"
                        })
        except Exception as e:
            logger.warning(f"Yahoo calendar fetch failed: {e}")

        # Add standing major events as fallback
        if not events:
            today = datetime.now()
            events = [
                {
                    'date': today.strftime('%Y-%m-%d'),
                    'event': 'Market Open - Regular Session',
                    'impact': 'Low',
                    'description': 'US markets regular trading hours'
                }
            ]

        return events

    def enrich_ai(self, events):
        key = os.getenv('GOOGLE_API_KEY')
        if not key:
            return events

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

        for ev in events:
            if ev['impact'] == 'High':
                try:
                    payload = {
                        "contents": [{"parts": [{"text": f"Explain market impact of: {ev['event']} in 2 sentences."}]}],
                        "generationConfig": {"maxOutputTokens": 200}
                    }
                    resp = requests.post(f"{url}?key={key}", json=payload, timeout=15)
                    if resp.status_code == 200:
                        ai_text = resp.json()['candidates'][0]['content']['parts'][0]['text']
                        ev['description'] += f"\n\nAI: {ai_text}"
                except:
                    pass
        return events

    def run(self):
        events = self.get_events()
        events = self.enrich_ai(events)

        output = {
            'updated': datetime.now().isoformat(),
            'events': events,
            'week_start': datetime.now().strftime('%Y-%m-%d'),
            'count': len(events)
        }
        with open(self.output, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        logger.info(f"✅ Saved economic calendar: {len(events)} events")


if __name__ == "__main__":
    EconomicCalendar().run()

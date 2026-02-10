#!/usr/bin/env python3
"""
AI market briefing using Perplexity API. Falls back to template.
Output: output/briefing.json
"""
import os, json, requests
from datetime import datetime

def generate_briefing():
    api_key = os.environ.get('PERPLEXITY_API_KEY', '')
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'output')
    os.makedirs(output_dir, exist_ok=True)
    market = {}
    market_path = os.path.join(output_dir, 'market_data.json')
    if os.path.exists(market_path):
        with open(market_path, 'r') as f: market = json.load(f)

    spy = market.get('indices', {}).get('SPY', {})
    vix = market.get('volatility', {}).get('^VIX', {})

    if api_key:
        prompt = f"SPY: {spy.get('price','N/A')} ({spy.get('change',0):+.2f}%), VIX: {vix.get('price','N/A')}. 오늘 미국 주식 시장을 간단하게 분석해주세요."
        try:
            resp = requests.post('https://api.perplexity.ai/chat/completions',
                headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
                json={'model': 'sonar', 'messages': [
                    {'role': 'system', 'content': '월스트리트 애널리스트로서 한국어로 답변하세요.'},
                    {'role': 'user', 'content': prompt}],
                    'temperature': 0.2, 'max_tokens': 2000}, timeout=60)
            data = resp.json()
            content = data.get('choices',[{}])[0].get('message',{}).get('content','')
            citations = data.get('citations',[])
        except Exception as e:
            content, citations = f"Error: {e}", []
    else:
        content = f"# 시장 브리핑\n\nSPY: {spy.get('price','N/A')} ({spy.get('change',0):+.2f}%)\nVIX: {vix.get('price','N/A')}\n\n> `PERPLEXITY_API_KEY` 환경변수를 설정하면 AI 분석이 활성화됩니다."
        citations = []

    with open(os.path.join(output_dir, 'briefing.json'), 'w', encoding='utf-8') as f:
        json.dump({'timestamp': datetime.now().isoformat(), 'content': content, 'citations': citations}, f, indent=2, ensure_ascii=False)
    print("Saved briefing")

if __name__ == '__main__':
    generate_briefing()

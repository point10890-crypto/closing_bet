#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top 5 종목 심층 분석 스크립트 (Gemini 3.0 활용)
추천 이력에서 최신 Top 5 종목을 가져와 관련 뉴스를 검색하고 AI로 분석합니다.
"""

import os
import pandas as pd
import google.generativeai as genai
from duckduckgo_search import DDGS
from newspaper import Article
from datetime import datetime
import time
from tqdm import tqdm
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# Google API Key 설정
# 환경 변수에서 가져오거나 직접 입력
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

def setup_gemini():
    """Gemini 설정"""
    if not GOOGLE_API_KEY:
        print("❌ Google API Key가 설정되지 않았습니다.")
        print("   export GOOGLE_API_KEY='your_api_key' 또는 스크립트 내에 키를 입력해주세요.")
        return False
    
    genai.configure(api_key=GOOGLE_API_KEY)
    return True

def get_top_stocks(limit=5):
    """추천 이력에서 최신 Top 종목 가져오기"""
    # DATA_DIR 환경 변수 사용
    data_dir = os.getenv('DATA_DIR', '.')
    history_file = os.path.join(data_dir, 'recommendation_history.csv')
    if not os.path.exists(history_file):
        print("❌ 추천 이력 파일이 없습니다.")
        return []
    
    df = pd.read_csv(history_file, dtype={'ticker': str})
    
    # 최신 날짜 확인
    latest_date = df['recommendation_date'].max()
    print(f"📅 분석 기준일: {latest_date}")
    
    # 최신 날짜의 데이터만 필터링
    latest_df = df[df['recommendation_date'] == latest_date].copy()
    
    # 점수순 정렬
    top_stocks = latest_df.sort_values('final_investment_score', ascending=False).head(limit)
    
    return top_stocks[['ticker', 'name', 'final_investment_score']].to_dict('records')

def search_news(keyword, limit=3):
    """뉴스 검색"""
    results = []
    try:
        with DDGS() as ddgs:
            # "종목명 주식 뉴스"로 검색
            query = f"{keyword} 주식 뉴스"
            search_results = list(ddgs.news(query, region="kr-kr", safesearch="off", max_results=limit))
            
            for res in search_results:
                results.append({
                    'title': res['title'],
                    'link': res['url'],
                    'source': res['source'],
                    'date': res['date']
                })
    except Exception as e:
        print(f"⚠️ 뉴스 검색 실패 ({keyword}): {e}")
    
    return results

def scrape_article(url):
    """기사 내용 스크래핑"""
    try:
        article = Article(url, language='ko')
        article.download()
        article.parse()
        return article.text[:1000] # 너무 길면 자름
    except Exception:
        return ""

def analyze_with_gemini(stock_name, news_data):
    """Gemini로 뉴스 분석"""
    try:
        model = genai.GenerativeModel('gemini-3-pro-preview')
        
        news_context = ""
        for idx, news in enumerate(news_data, 1):
            news_context += f"기사 {idx}: {news['title']}\n내용: {news['content']}\n출처: {news['source']}\n\n"
            
        prompt = f"""
        당신은 전문 주식 애널리스트입니다. 아래는 '{stock_name}' 주식과 관련된 최신 뉴스 기사들입니다.
        이 기사들을 바탕으로 다음 항목을 분석하여 요약해 주세요.
        
        [뉴스 데이터]
        {news_context}
        
        [분석 요청 사항]
        1. 핵심 이슈 요약 (3줄 이내)
        2. 호재(긍정적 요인) 및 악재(부정적 요인) 구분
        3. 향후 주가에 미칠 영향 (단기/중장기)
        4. 투자 매력도 평가 (5점 만점)
        
        답변은 한국어로 명확하고 전문적인 어조로 작성해 주세요.
        """
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"AI 분석 실패: {e}"

def main():
    print("============================================================")
    print("🤖 Top 5 종목 AI 심층 분석 (Powered by Gemini)")
    print("============================================================")
    
    if not setup_gemini():
        return

    top_stocks = get_top_stocks()
    if not top_stocks:
        print("❌ 분석할 종목이 없습니다.")
        return
    
    print(f"🔍 분석 대상: {', '.join([s['name'] for s in top_stocks])}")
    print("-" * 60)
    
    report_content = f"# 🤖 AI 주식 심층 분석 리포트\n작성일: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
    
    for stock in tqdm(top_stocks, desc="종목 분석 중"):
        name = stock['name']
        ticker = stock['ticker']
        score = stock['final_investment_score']
        
        print(f"\n📈 [{name}] ({ticker}) - 점수: {score}점 분석 중...")
        
        # 1. 뉴스 검색
        news_list = search_news(name)
        
        # 2. 기사 내용 수집
        valid_news = []
        for news in news_list:
            content = scrape_article(news['link'])
            if content:
                news['content'] = content
                valid_news.append(news)
        
        if not valid_news:
            print(f"   ⚠️ 관련 뉴스를 찾을 수 없거나 내용을 가져올 수 없습니다.")
            continue
            
        # 3. AI 분석
        analysis = analyze_with_gemini(name, valid_news)
        
        # 결과 출력
        print(f"\n[AI 분석 결과]")
        print(analysis)
        print("-" * 60)
        
        # 리포트 저장용
        report_content += f"## 📌 {name} ({ticker})\n"
        report_content += f"**투자 점수**: {score}점\n\n"
        report_content += f"### 📰 관련 뉴스\n"
        for news in valid_news:
            report_content += f"- [{news['title']}]({news['link']}) ({news['source']})\n"
        report_content += f"\n### 🧠 Gemini 분석\n{analysis}\n\n---\n\n"
        
        time.sleep(2) # API 제한 고려
        
    # 리포트 파일 저장
    data_dir = os.getenv('DATA_DIR', '.')
    filename = os.path.join(data_dir, f"ai_analysis_report_{datetime.now().strftime('%Y%m%d')}.md")
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(report_content)
        
    print(f"\n✅ 분석 완료! 리포트가 저장되었습니다: {filename}")

if __name__ == "__main__":
    main()

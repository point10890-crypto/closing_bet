"""
🤖 LLM 뉴스 분석 시스템 (Perplexity + Gemini)
실시간 웹 검색과 고도화된 AI 분석을 결합하여 종목별 호재 점수를 산출합니다.
"""

import os
import json
import re
import asyncio
import httpx
import google.generativeai as genai
from typing import List, Dict, Optional
from datetime import datetime
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# API 상태 추적 (Rate Limit 관리)
API_STATUS = {
    'perplexity': {'available': True, 'last_error': None, 'error_count': 0},
    'gemini': {'available': True, 'last_error': None, 'error_count': 0},
    'openai': {'available': True, 'last_error': None, 'error_count': 0}
}

def reset_api_status():
    """API 상태 초기화 (세션 시작 시 호출)"""
    global API_STATUS
    for key in API_STATUS:
        API_STATUS[key] = {'available': True, 'last_error': None, 'error_count': 0}

class PerplexityClient:
    """Perplexity Sonar API를 이용한 실시간 뉴스 검색"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("PERPLEXITY_API_KEY")
        self.base_url = "https://api.perplexity.ai/chat/completions"
        self.model = "sonar"
        
    async def search_stock_news(self, stock_name: str) -> Dict:
        """최근 24시간 이내의 종목 관련 뉴스 검색 및 요약"""
        global API_STATUS

        if not self.api_key:
            return {"news_summary": "", "citations": [], "error": "No API Key"}

        if not API_STATUS['perplexity']['available']:
            return {"news_summary": "", "citations": [], "error": f"Rate Limited: {API_STATUS['perplexity']['last_error']}"}
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        query = f"'{stock_name}' 종목에 대한 최신 뉴스와 시장 동향을 검색해주세요. 1. 최근 24시간 이내의 주요 뉴스(호재/악재), 2. 실적/수주/계약 정보, 3. 관련 테마 및 산업 동향을 포함해 답변해주세요."
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "당신은 한국 주식 시장 전문 리서치 애널리스트입니다. 사실을 기반으로 명확하고 간결하게 답변하세요."},
                {"role": "user", "content": query}
            ],
            "temperature": 0.2,
            "max_tokens": 1024,
            "return_citations": True,
            "search_recency_filter": "day"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.base_url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                return {
                    "news_summary": data["choices"][0]["message"]["content"],
                    "citations": data.get("citations", []),
                    "source": "perplexity"
                }
        except Exception as e:
            error_msg = str(e).lower()
            print(f"[ERROR] Perplexity Search Failed: {e}")

            # Rate Limit 감지
            if 'rate' in error_msg or 'limit' in error_msg or '429' in error_msg or 'quota' in error_msg:
                API_STATUS['perplexity']['available'] = False
                API_STATUS['perplexity']['last_error'] = 'Rate Limit'
                API_STATUS['perplexity']['error_count'] += 1
                print("[WARN] Perplexity Rate Limit - 임시 비활성화")

            return {"news_summary": "", "citations": [], "error": str(e)}

class OpenAIAnalyzer:
    """OpenAI GPT를 이용한 뉴스 종합 분석 (Gemini Fallback)"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if self.api_key:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=self.api_key)
            self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini") # 가성비 모델 기본값
        else:
            self.client = None
            
    async def analyze_news(self, stock_name: str, perplexity_news: str, traditional_news: List[Dict] = None) -> Dict:
        global API_STATUS

        if not self.client:
            return {"score": 0, "reason": "No OpenAI Client", "themes": []}

        if not API_STATUS['openai']['available']:
            return {"score": 0, "reason": f"Rate Limited: {API_STATUS['openai']['last_error']}", "themes": []}
            
        trad_text = ""
        if traditional_news:
            for i, item in enumerate(traditional_news[:5], 1):
                trad_text += f"[{i}] {item.get('title')} - {item.get('summary', '')[:100]}\n"
        
        prompt = f"""
        당신은 주식 투자 전문가입니다. 다음 '{stock_name}' 종목의 정보를 분석하여 호재 강도와 테마를 추출하세요.

        [Perplexity 실시간 검색 결과]
        {perplexity_news}

        [기존 뉴스 정보]
        {trad_text}

        위 정보를 종합 분석하여 아래 형식을 따르는 JSON 객체로만 출력하세요. 
        - score: 0~3점 (3:확실한 호재/수주/실적, 2:긍정 기대감, 1:중립, 0:악재/무소식)
        - reason: 분석 핵심 이유 (한 문장)
        - themes: 핵심 투자 테마 1~3개 (리스트 형식)

        JSON Format: {{"score": 2, "reason": "...", "themes": ["...", "..."]}}
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful financial analyst. Respond only in JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            error_msg = str(e).lower()
            print(f"[ERROR] OpenAI Analysis Failed: {e}")

            # Rate Limit 감지
            if 'rate' in error_msg or 'limit' in error_msg or '429' in error_msg or 'quota' in error_msg:
                API_STATUS['openai']['available'] = False
                API_STATUS['openai']['last_error'] = 'Rate Limit'
                API_STATUS['openai']['error_count'] += 1
                print("[WARN] OpenAI Rate Limit - 임시 비활성화")

            return {"score": 0, "reason": f"OpenAI Error: {e}", "themes": []}

class GeminiAnalyzer:
    """Gemini를 이용한 뉴스 종합 분석 및 점수 산출"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
            self.model = genai.GenerativeModel(model_name)
        else:
            self.model = None
            
    async def analyze_news(self, stock_name: str, perplexity_news: str, traditional_news: List[Dict] = None) -> Dict:
        """Perplexity 결과와 네이버 뉴스를 통합 분석하여 점수화"""
        global API_STATUS

        if not self.model:
            return {"score": 0, "reason": "No Gemini Model", "themes": []}

        if not API_STATUS['gemini']['available']:
            return {"score": 0, "reason": f"Rate Limited: {API_STATUS['gemini']['last_error']}", "themes": []}
            
        trad_text = ""
        if traditional_news:
            for i, item in enumerate(traditional_news[:5], 1):
                trad_text += f"[{i}] {item.get('title')} - {item.get('summary', '')[:100]}\n"
        
        prompt = f"""
        당신은 주식 투자 전문가입니다. 다음 '{stock_name}' 종목의 정보를 분석하여 호재 강도와 테마를 추출하세요.

        [Perplexity 실시간 검색 결과]
        {perplexity_news}

        [기존 뉴스 정보]
        {trad_text}

        위 정보를 종합 분석하여 아래 형식을 따르는 JSON 객체로만 출력하세요. 
        - score: 0~3점 (3:확실한 호재/수주/실적, 2:긍정 기대감, 1:중립, 0:악재/무소식)
        - reason: 분석 핵심 이유 (한 문장)
        - themes: 핵심 투자 테마 1~3개 (리스트 형식)

        JSON Format: {{"score": 2, "reason": "...", "themes": ["...", "..."]}}
        """
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            text = response.text.strip()
            # JSON 파싱 및 예외 처리
            try:
                data = json.loads(text)
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                return data if isinstance(data, dict) else {"score": 0, "reason": "Invalid JSON format", "themes": []}
            except json.JSONDecodeError:
                # 텍스트에서 JSON 부분만 추출 시도
                match = re.search(r"\{.*\}", text, re.DOTALL)
                if match:
                    return json.loads(match.group())
                return {"score": 0, "reason": f"JSON Decode Failed: {text[:50]}", "themes": []}
        except Exception as e:
            error_msg = str(e).lower()
            print(f"[ERROR] Gemini Analysis Failed: {e}")

            # Rate Limit 감지
            if 'rate' in error_msg or 'limit' in error_msg or '429' in error_msg or 'quota' in error_msg or 'resource' in error_msg:
                API_STATUS['gemini']['available'] = False
                API_STATUS['gemini']['last_error'] = 'Rate Limit'
                API_STATUS['gemini']['error_count'] += 1
                print("[WARN] Gemini Rate Limit - 임시 비활성화")

            return {"score": 0, "reason": f"Analysis Error: {e}", "themes": []}

class LLMAnalyzer:
    """통합 뉴스 분석 오케스트레이터 (Perplexity -> Gemini -> OpenAI -> Fallback)

    3중 API 폴백 시스템:
    1. Perplexity (실시간 검색) - Rate Limit 시 스킵
    2. Gemini (분석) - Rate Limit 시 OpenAI로 폴백
    3. OpenAI (분석) - Rate Limit 시 키워드 분석으로 폴백
    """

    def __init__(self):
        self.perplexity = PerplexityClient()
        self.gemini = GeminiAnalyzer()
        self.openai = OpenAIAnalyzer()
        # model 속성 추가 (generator.py 호환성)
        self.model = self.gemini.model or self.openai.client

    def get_api_status(self) -> Dict:
        """현재 API 상태 반환"""
        return {
            'perplexity': 'active' if API_STATUS['perplexity']['available'] else 'rate_limited',
            'gemini': 'active' if API_STATUS['gemini']['available'] else 'rate_limited',
            'openai': 'active' if API_STATUS['openai']['available'] else 'rate_limited',
            'errors': {k: v['error_count'] for k, v in API_STATUS.items()}
        }

    async def analyze_news_sentiment(self, stock_name: str, news_items: List[Dict] = None) -> Dict:
        """뉴스 감성 분석 통합 프로세스 (3중 폴백 시스템)"""
        news_summary = ""
        citations = []
        analysis_source = "none"

        # 1. Perplexity 검색 (실시간 정보) - Rate Limit 시 스킵
        if API_STATUS['perplexity']['available']:
            p_res = await self.perplexity.search_stock_news(stock_name)
            news_summary = p_res.get("news_summary", "")
            citations = p_res.get("citations", [])

            # Rate Limit 방지
            if news_summary:
                await asyncio.sleep(1)
                analysis_source = "perplexity"
        else:
            print(f"[SKIP] Perplexity Rate Limited - {stock_name}")

        # 분석 대상 데이터가 없으면 빠른 종료
        if not news_summary and not news_items:
            return self._keyword_fallback(stock_name, [])

        analysis = None

        # 2. Main Analysis (Gemini Attempt) - Rate Limit 시 스킵
        if API_STATUS['gemini']['available']:
            analysis = await self.gemini.analyze_news(stock_name, news_summary, news_items)
            if analysis.get("score") > 0 or "Error" not in analysis.get("reason", ""):
                analysis["source"] = f"{analysis_source}+gemini" if analysis_source else "gemini_only"
            else:
                analysis = None  # Gemini 실패 - OpenAI로 폴백
        else:
            print(f"[SKIP] Gemini Rate Limited - {stock_name}")

        # 3. Fallback Analysis (OpenAI Attempt) - Rate Limit 시 스킵
        if analysis is None and API_STATUS['openai']['available']:
            print(f"[FALLBACK] Gemini Failed for {stock_name}, trying OpenAI...")
            analysis = await self.openai.analyze_news(stock_name, news_summary, news_items)
            if analysis.get("score") > 0 or "Error" not in analysis.get("reason", ""):
                analysis["source"] = f"{analysis_source}+openai" if analysis_source else "openai_only"
            else:
                analysis = None  # OpenAI도 실패
        elif analysis is None:
            print(f"[SKIP] OpenAI Rate Limited - {stock_name}")

        # 4. Final Fallback (Keyword) - 모든 LLM 실패 시
        if analysis is None or (analysis.get("score") == 0 and ("Error" in analysis.get("reason", "") or "Rate" in analysis.get("reason", ""))):
            print(f"[FALLBACK] All LLMs failed for {stock_name}, using keywords...")
            return self._keyword_fallback(stock_name, news_items)

        # 성공 시 결과 반환
        if not isinstance(analysis, dict):
            return self._keyword_fallback(stock_name, news_items)

        analysis["citations"] = citations
        analysis["api_status"] = self.get_api_status()
        return analysis

    def _keyword_fallback(self, stock_name: str, news_items: List[Dict]) -> Dict:
        """API 실패 시 키워드 기반 단순 분석"""
        score = 0
        reason = "No news data available"
        themes = []
        
        if news_items:
            positive = ["수주", "계약", "흑자", "성공", "급등", "어닝", "FDA", "M&A", "특허", "공급", "개발"]
            negative = ["영업정지", "배임", "횡령", "적자", "상장폐지", "급락", "수사", "불성실"]
            
            all_text = " ".join([n.get("title", "") + n.get("summary", "") for n in news_items])
            
            if any(w in all_text for w in negative):
                score = 0
                reason = "부정적 키워드 감지됨"
            else:
                matches = [w for w in positive if w in all_text]
                # 매칭된 키워드 수에 따라 점수 부여 (최대 2점 - LLM보다는 보수적)
                if len(matches) >= 2:
                    score = 2
                elif len(matches) == 1:
                    score = 1
                else:
                    score = 0
                    
                reason = f"키워드 분석 ({', '.join(matches[:3])})" if matches else "호재 키워드 없음"
            
        return {
            "score": score,
            "reason": reason,
            "themes": themes,
            "source": "keyword_fallback"
        }

if __name__ == "__main__":
    # 간단한 테스트
    async def test():
        analyzer = LLMAnalyzer()
        print("🔍 분석 테스트 시작: 삼성전자")
        result = await analyzer.analyze_news_sentiment("삼성전자", [])
        print(json.dumps(result, indent=2, ensure_ascii=False))

    asyncio.run(test())

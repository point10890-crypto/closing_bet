# 미국 시장 야간 프리뷰 - Vibe 코딩 사양

**이것은 전문가급 미국 시장 분석 플랫폼의 간소화된 "맛보기" 버전입니다.**
이 파일을 Claude Code, Cursor 등의 AI 코딩 도구에 입력하면 작동하는 미리보기 대시보드를 생성할 수 있습니다.

---

## 받게 될 것

Next.js와 Python을 사용한 대시보드에서 보여주는 내용:
1. 미국 시장 실시간 개요 (SPY, QQQ, VIX, 채권, 금, 비트코인)
2. 공포 및 탐욕 측정기
3. 스마트머니 추천 종목 (점수 포함)
4. 간단한 머신러닝 기반 방향 예측 (SPY 상승/하락)
5. AI 시장 브리핑 (Perplexity)
6. 섹터 히트맵

---

## 기술 스택

- **프런트엔드**: Next.js 14+ (앱 라우터), TypeScript, Tailwind CSS
- **백엔드**: Flask (Python 3.11 이상)
- **데이터**: yfinance (무료, API 키 필요 없음)
- **AI**: Perplexity API (선택 사항, 시장 브리핑용)
- **데이터베이스 필요 없음** - 모든 데이터는 JSON 파일로 저장됩니다.

---

## 프로젝트 구조

```
미국 시장 미리보기/
백엔드/
app.py # Flask 서버
스크립트/
market_data.py # 실시간 시장 데이터 가져오기
screener.py # 간단한 스마트 머니 스크리너
predictor.py # ML 방향 예측기
briefing.py # AI 시장 브리핑 (선택 사항)
    쒋    출력/ # JSON 출력 파일
requirements.txt
프런트엔드/
    쒋    src/app/
레이아웃.tsx
page.tsx # 메인 대시보드 (단일 페이지)
    쒋    src/components/
MarketOverview.tsx
       쒋    FearGreedGauge.tsx
TopPicks.tsx
       쒋    예측.tsx
브리핑.tsx
       붴    SectorHeatmap.tsx
package.json
tailwind.config.ts
 붴    README.md
```

---

## 1. 백엔드: Flask API

### `requirements.txt`

```
플라스크
플라스크-코르스
yfinance
판다
넘파이
스키트런
요청
```

### `app.py` - 메인 Flask 서버

```파이썬
Flask와 jsonify를 임포트합니다.
flask_cors에서 CORS를 가져옵니다.
json, os를 가져옵니다.

앱 = Flask(__name__)
CORS(앱)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')

def load_json(filename):
    경로 = os.path.join(OUTPUT_DIR, 파일 이름)
    os.path.exists(path)가 존재하는 경우:
        open(path, 'r', encoding='utf-8')를 f로 지정:
            json.load(f)를 반환합니다.
    반품 {}

@app.route('/api/market-data')
def market_data():
    jsonify(load_json('market_data.json'))를 반환합니다.

@app.route('/api/top-picks')
def top_picks():
    jsonify(load_json('top_picks.json'))를 반환합니다.

@app.route('/api/prediction')
def prediction():
    jsonify(load_json('prediction.json'))를 반환합니다.

@app.route('/api/briefing')
def briefing():
    jsonify(load_json('briefing.json'))를 반환합니다.

@app.route('/api/sector-heatmap')
def sector_heatmap():
    jsonify(load_json('sector_heatmap.json'))를 반환합니다.

만약 __name__이 '__main__'과 같다면:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    앱 실행(포트=5001, 디버그=True)
```

---

## 2. 백엔드 스크립트

### `scripts/market_data.py` - 실시간 시장 데이터

```파이썬
"""
주요 지수, 채권, 통화, 상품에 대한 실시간 데이터를 가져옵니다.
VIX 지수를 이용하여 간단한 공포 및 탐욕 점수를 계산합니다.
출력: output/market_data.json
"""
yfinance를 yf로 가져옵니다.
json, os를 가져옵니다.
datetime에서 datetime을 가져옵니다.

티커 = {
    '지수': {'SPY': 'S&P 500', 'QQQ': 'NASDAQ 100', 'DIA': 'Dow Jones', 'IWM': 'Russell 2000'},
    '변동성': {'^VIX': 'VIX'},
    '채권': {'^TNX': '10년 만기 국채'},
    '통화': {'DX-Y.NYB': '달러 지수', 'USDKRW=X': 'USD/KRW'},
    '상품': {'GC=F': '금', 'BTC-USD': '비트코인'},
}

def fetch_market_data():
    결과 = {'타임스탬프': datetime.now().isoformat()}

    카테고리의 경우, TICKERS.items()의 티커:
        결과[카테고리] = {}
        tickers.items()의 심볼과 이름에 대해:
            노력하다:
                hist = yf.Ticker(symbol).history(period='5d')
                hist.empty이면 계속합니다.
                current = float(hist['닫기'].iloc[-1])
                prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
                결과[카테고리][심볼] = {
                    '이름': 이름,
                    '가격': round(현재, 2),
                    '변경': round(((현재 / 이전) - 1) * 100, 2),
                }
            예외 e를 제외하고:
                print(f" {symbol} 건너뛰기: {e}")

    # 공포와 탐욕 (간단히 설명하면: VIX 지수 기반)
    vix = result.get('volatility', {}).get('^VIX', {}).get('price', 20)
    vix 값이 12 이하이면 점수와 레벨을 85로 설정하고 '극도의 탐욕'으로 지정합니다.
    만약 vix가 17 이하이면, 점수와 레벨을 70으로 설정하고 '탐욕'을 부여합니다.
    만약 vix가 22 이하이면, 점수와 레벨을 50으로 설정하고 '중립'으로 지정합니다.
    elif vix <= 30: 점수, 레벨 = 30, '공포'
    그렇지 않으면 점수, 레벨 = 10, '극도의 공포'
    result['fear_greed'] = {'score': score, 'level': level, 'vix': round(vix, 1)}

    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'market_data.json')
    f를 사용하여 출력 경로('w', 인코딩='utf-8')를 엽니다.
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"저장된 시장 데이터")

만약 __name__이 '__main__'과 같다면:
    fetch_market_data()
```

### `scripts/screener.py` - 스마트 머니 스크리너

```파이썬
"""
기본 요소를 사용하여 S&P 500 상위 50개 종목을 선별합니다.
  - RSI 모멘텀
  - 기관 투자자 지분율
  - 매출 성장
  - 가격 추세와 이동 평균 비교

점수와 순위는 상위 10위입니다.
출력: output/top_picks.json
"""
yfinance를 yf로 가져옵니다.
pandas를 pd로 가져옵니다.
numpy를 np로 가져옵니다.
json, os를 가져옵니다.
datetime에서 datetime을 가져옵니다.

def calc_rsi(prices, period=14):
    델타 = 가격 차이()
    gain = delta.clip(lower=0).rolling(period).mean()
    손실 = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    100 - (100 / (1 + rs))를 반환합니다.

def screen_stocks():
    # 위키피디아에서 S&P 500 종목 코드를 가져오세요
    노력하다:
        테이블 = pd.read_html(' https://en.wikipedia.org/wiki/List_of_S%26P_500_companies')[0]
        tickers = table['Symbol'].str.replace('.', '-', regex=False).tolist()[:50]
        sectors = dict(zip(table['Symbol'].str.replace('.', '-', regex=False), table['GICS Sector']))
    제외하고:
        티커 = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','UNH','JNJ',
                    'V', 'PG', 'MA', 'HD', 'MRK', 'ABBV', 'PEP', 'KO', 'COST', 'AVGO', 'WMT', 'MCD',
                    'CSCO','ACN','LIN','TMO','ABT','CRM','DHR','NKE','AMD','TXN','NEE',
                    'PM','UNP','RTX','HON','LOW','SPGI','INTU','ISRG','BLK','AMAT','GS',
                    'ELV','MDLZ','ADP','VRTX','REGN','BRK-B']
        부문 = {}

    결과 = []
    for i, ticker in enumerate(tickers):
        노력하다:
            tk = yf.Ticker(ticker)
            hist = tk.history(period='1y')
            히스토리 길이가 60보다 작으면 계속 진행합니다.
            정보 = tk.info
            닫기 = hist['닫기']
            가격 = float(close.iloc[-1])

            # 요인 점수 계산 (각 0-100)
            rsi = float(calc_rsi(close).iloc[-1])
            inst_pct = info.get('heldPercentInstitutions', 0) 또는 0
            rev_growth = info.get('revenueGrowth', 0) 또는 0
            ma50 = float(close.rolling(50).mean().iloc[-1])

            # 단순 합성     먯꽭   媛 以묒튂     踰꾩쟾 먯꽌  쒓났
            composite = np.mean([
                40 <= rsi <= 65이면 80, 그렇지 않으면 40,
                min(100, inst_pct * 100),
                min(100, max(0, 50 + rev_growth * 200)),
                가격이 ma50보다 크면 85, 그렇지 않으면 35,
            ])

            결과.append({
                '티커': 티커, '이름': info.get('shortName', 티커),
                '섹터': sectors.get(ticker, info.get('섹터', '알 수 없음')),
                '가격': round(price, 2), '복합점수': round(composite, 1),
                'rsi': round(rsi, 1),
            })
            (i + 1) % 10 == 0이면 "{i+1}/{len(tickers)}"를 출력합니다.
        제외하고:
            통과하다

    results.sort(key=lambda x: x['composite_score'], reverse=True)
    for i, p in enumerate(results[:10]):
        p['rank'] = i + 1
        p['grade'] = 'A' (p['composite_score'] >= 75인 경우) 또는 ('B' (p['composite_score'] >= 65인 경우) 또는 'C')
        p['signal'] = 'Strong Buy' if p['grade'] == 'A' else ('Buy' if p['grade'] == 'B' else 'Hold')

    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'top_picks.json')
    f를 사용하여 출력 경로('w', 인코딩='utf-8')를 엽니다.
        json.dump({'timestamp': datetime.now().isoformat(), 'top_picks': results[:10]}, f, indent=2)
    print(f"상위 10개 저장됨")

만약 __name__이 '__main__'과 같다면:
    스크린_스톡스()
```

### `scripts/predictor.py` - 머신러닝 방향 예측기

```파이썬
"""
그래디언트부스팅을 사용하여 SPY의 5일 방향성을 예측합니다.
RSI, MACD, 거래량, VIX와 같은 기본적인 기술적 지표를 사용합니다.
출력: output/prediction.json
"""
yfinance를 yf로 가져옵니다.
pandas를 pd로 가져옵니다.
numpy를 np로 가져옵니다.
sklearn.ensemble에서 GradientBoostingClassifier를 가져옵니다.
json, os를 가져옵니다.
datetime에서 datetime을 가져옵니다.

def predict_direction():
    spy = yf.Ticker('SPY').history(period='2y')
    vix = yf.Ticker('^VIX').history(period='2y')

    df = pd.DataFrame({'close': spy['Close'], 'volume': spy['Volume']})
    df['vix'] = vix['Close'].reindex(spy.index, method='ffill')

    # 기본 기술적 특징
    delta = df['close'].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    손실 = (-delta.clip(upper=0)).rolling(14).mean()
    df['rsi'] = 100 - (100 / (1 + gain / loss.replace(0, np.nan)))
    ema12 = df['close'].ewm(span=12).mean()
    ema26 = df['close'].ewm(span=26).mean()
    df['macd_hist'] = (ema12 - ema26) - (ema12 - ema26).ewm(span=9).mean()
    df['ret_5d'] = df['close'].pct_change(5) * 100
    df['vol_ratio'] = df['volume'] / df['volume'].rolling(20).mean()
    df['target'] = (df['close'].shift(-5) > df['close']).astype(int)

    features = ['rsi', 'macd_hist', 'ret_5d', 'vol_ratio', 'vix']
    df = df.dropna()

    X_train, X_pred = df[features].iloc[:-30], df[features].iloc[-1:]
    모델 = GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=42)
    model.fit(X_train, df['target'].iloc[:-30])

    prob = round(float(model.predict_proba(X_pred)[0][1]) * 100, 1)

    결과 = {
        '타임스탬프': datetime.now().isoformat(),
        '스파이': {
            '강세 확률': 확률,
            '방향': 확률이 55 이상이면 '상승세', 그렇지 않으면 '하락세', 그렇지 않으면 '중립세'.
        }
    }
    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'prediction.json')
    f로 open(output_path, 'w')를 사용합니다.
        json.dump(result, f, indent=2)
    print(f"예측: {prob}% 상승세")

만약 __name__이 '__main__'과 같다면:
    예측 방향()
```

### `scripts/briefing.py` - AI 시장 브리핑 (선택 사항)

```파이썬
"""
Perplexity API를 사용하여 AI 시장 브리핑을 생성합니다.
필수 사항: PERPLEXITY_API_KEY 환경 변수. 이 변수가 없으면 템플릿이 사용됩니다.
출력: output/briefing.json
"""
os, json, requests를 임포트합니다.
datetime에서 datetime을 가져옵니다.

def generate_briefing():
    api_key = os.environ.get('PERPLEXITY_API_KEY', '')
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'output')
    시장 = {}
    market_path = os.path.join(output_dir, 'market_data.json')
    os.path.exists(market_path)인 경우:
        open(market_path, 'r') as f: market = json.load(f)

    spy = market.get('indices', {}).get('SPY', {})
    vix = market.get('volatility', {}).get('^VIX', {})

    api_key인 경우:
        프롬프트 = f"[검색: 오늘 미국 주식 시장 S&P 500 Fed] SPY: {spy.get('price','N/A')} ({spy.get('change',0):+.2f}%), VIX: {vix.get('price','N/A')}.  ㅻ뒛 誘멸뎅 二쇱떇 쒖옣   媛꾧 놔 섍쾶 遺꾩꽍 댁< 군슂.
        노력하다:
            resp = requests.post(' https://api.perplexity.ai/chat/completions',
                헤더={'인증': f'베어러 {api_key}', '콘텐츠 유형': 'application/json'},
                json={'model': 'sonar', 'messages': [
                    {'role': 'system', 'content': '당신은 월스트리트 애널리스트입니다. 한국어로 답변하세요.'},
                    {'역할': '사용자', '콘텐츠': 프롬프트}],
                    '온도': 0.2, '최대 토큰': 2000, '인용 반환': True,
                    '검색 최근성 필터': '주',
                    'search_domain_filter': ['reuters.com','bloomberg.com','cnbc.com','wsj.com']},
                타임아웃=60)
            데이터 = resp.json()
            content = data.get('choices',[{}])[0].get('message',{}).get('content','')
            인용문 = data.get('citations',[])
        예외 e를 제외하고:
            콘텐츠, 인용 = f"오류: {e}", []
    또 다른:
        content = f"# 시장 브리핑\nSPY: {spy.get('price','N/A')} ({spy.get('change',0):+.2f}%)\nVIX: {vix.get('price','N/A')}\n\n`export PERPLEXITY_API_KEY=...`  ㅼ젙    AI 遺꾩꽍  쒖꽦  "
        인용문 = []

    f:를 열고(os.path.join(output_dir, 'briefing.json'), 'w')를 추가합니다.
        json.dump({'timestamp': datetime.now().isoformat(), 'content': content, 'citations': citations}, f, indent=2)

만약 __name__이 '__main__'과 같다면:
    generate_briefing()
```

---

## 3. 프런트엔드: Next.js 대시보드

### 디자인 시스템 (다크 테마)

```
배경: #0a0a0a (페이지), #1c1c1e (카드)
카드 테두리: border-white/10
텍스트: 텍스트-흰색(기본), 텍스트-회색-400(보조)
긍정적: 텍스트-에메랄드-400, 배경-에메랄드-500/10
부정적: 텍스트-빨간색-400, 배경-빨간색-500/10
강조: 텍스트-파란색-400, 텍스트-황색-400
카드: rounded-2xl, 배지: rounded-full
```

### `page.tsx` - 단일 페이지 대시보드

```tsx
export default function Dashboard() {
    반품 (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-6 space-y-6">
            <헤더 />
            <시장개요 />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <두려움과탐욕 게이지 />
                <예측 />
                <섹터 히트맵 />
            </div>
            <TopPicks />
            <브리핑 />
        </div>
    );
}
```

### 구성 요소 사양

| 구성 요소 | 설명 | 데이터 소스 |
|-----------|-------------|------------|
| `시장개요` | 가격, 변화율, 색상 화살표가 있는 2x5 인덱스 카드 | `/api/market-data` |
| `FearGreedGauge` | 반원형 게이지(빨간색/녹색), 애니메이션 바늘, 점수 | `/api/market-data`    fear_greed |
| `TopPicks` | 표: 순위, 티커, 섹터, 점수, RSI, 시그널, 등급 배지 | `/api/top-picks` |
| `예측` | 상승률(%) 및 방향 레이블과 함께 진행 상황을 원형으로 표시 | `/api/prediction` |
| `섹터 히트맵` | 일일 실적에 따라 색상이 지정된 그리드 타일 | `/api/sector-heatmap` |
| `브리핑` | ReactMarkdown + remark-gfm, 하단에 인용문 표시 | `/api/briefing` |

---

## 4. 실행 방법

```bash
# 백엔드
cd backend && pip install -r requirements.txt
python scripts/market_data.py && python scripts/screener.py && python scripts/predictor.py
파이썬 앱.py # :5001에서 시작

# 프런트엔드
cd frontend && npm install && npm run dev # 3000번 포트에서 열립니다
```

---

## 5. 미리보기 버전 vs 정식 버전

| | 미리보기 | 전체 보기 |
|---|---|---|
| 주식 | 50媛  | S&P 500 + 나스닥 100 |
| 점수 산정 | 4가지 요소 | 8가지 이상 요소 |
| 머신러닝 | 기본 | 앙상블 + 워크포워드 |
| 위험 | 없음 | VaR/CVaR/드로우다운 |
페이지 수 | 1페이지 | 12페이지 이상 |
| AI | 단일 호출 | 다중 소스 + 양적 합성 |

---

*yfinance, Next.js, Flask로 구축되었습니다. 유료 데이터는 필요하지 않습니다.*
*본 자료는 교육 목적으로만 제공되며 투자 조언이 아닙니다.*
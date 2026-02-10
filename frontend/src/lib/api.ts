// API utility functions

// Use Next.js rewrites proxy (works for both local and external access)
const API_BASE = '';

export async function fetchAPI<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
}

// KR Market API Types
export interface KRSignal {
    ticker: string;
    name: string;
    market: 'KOSPI' | 'KOSDAQ';
    signal_date: string;
    entry_price: number;
    current_price: number;
    return_pct: number;
    foreign_5d: number;
    inst_5d: number;
    score: number;
    contraction_ratio: number;
}

export interface KRSignalsResponse {
    signals: KRSignal[];
    error?: string;
}

export interface KRMarketGate {
    score: number;
    label: string;
    kospi_close: number;
    kospi_change_pct: number;
    kosdaq_close: number;
    kosdaq_change_pct: number;
    sectors: KRSector[];
}

export interface KRSector {
    name: string;
    change_pct: number;
    signal: 'bullish' | 'neutral' | 'bearish';
}

export interface AIRecommendation {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reason: string;
}

export interface KRAIAnalysis {
    signals: Array<{
        ticker: string;
        gpt_recommendation?: AIRecommendation;
        gemini_recommendation?: AIRecommendation;
    }>;
    market_indices?: {
        kospi?: { value: number; change_pct: number };
        kosdaq?: { value: number; change_pct: number };
    };
}

// KR Market API functions
export const krAPI = {
    getSignals: () => fetchAPI<KRSignalsResponse>('/api/kr/signals'),
    getMarketGate: () => fetchAPI<KRMarketGate>('/api/kr/market-gate'),
    getAIAnalysis: () => fetchAPI<KRAIAnalysis>('/api/kr/ai-analysis'),
    getStockChart: (ticker: string, period = '6mo') =>
        fetchAPI<{ candles: any[] }>(`/api/kr/stock-chart/${ticker}?period=${period}`),
    getHistoryDates: () => fetchAPI<{ dates: string[] }>('/api/kr/ai-history-dates'),
    getHistory: (date: string) => fetchAPI<KRAIAnalysis>(`/api/kr/ai-history/${date}`),
};

// Closing Bet API
export interface ClosingBetCandidate {
    rank: number;
    ticker: string;
    name: string;
    market: string;
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
    price: number;
    change_pct: number;
    total_score: number;
    scores: {
        volume: number;
        institutional: number;
        news: number;
        chart: number;
        candle: number;
        consolidation: number;
    };
}

export interface ClosingBetResponse {
    candidates: ClosingBetCandidate[];
}

export interface ClosingBetTiming {
    phase: string;
    time_remaining: string;
    urgency_score: number;
    is_entry_allowed: boolean;
    recommended_action: string;
}

export const closingBetAPI = {
    getCandidates: (limit = 25) =>
        fetchAPI<ClosingBetResponse>(`/api/kr/closing-bet/candidates?limit=${limit}`),
    getTiming: () => fetchAPI<ClosingBetTiming>('/api/kr/closing-bet/timing'),
    getBacktestStats: () => fetchAPI<any>('/api/kr/closing-bet/backtest-stats'),
};

// US Market API Types
export interface USMarketIndex {
    name: string;
    ticker: string;
    price: number;
    change: number;
    change_pct: number;
}

export interface USMarketGate {
    gate: 'GREEN' | 'YELLOW' | 'RED';
    score: number;
    status: 'RISK_ON' | 'NEUTRAL' | 'RISK_OFF';
    reasons: string[];
    spy: {
        price: number;
        ma50: number;
        ma200: number;
        rsi: number;
        change_1d: number;
        change_5d: number;
    };
}

export interface USSector {
    ticker: string;
    name: string;
    price: number;
    change_pct: number;
}

// US Market API functions
export const usAPI = {
    getPortfolio: () => fetchAPI<{ market_indices: USMarketIndex[]; timestamp: string }>('/api/us/portfolio'),
    getMarketGate: () => fetchAPI<USMarketGate>('/api/us/market-gate'),
    getSectorHeatmap: () => fetchAPI<{ sectors: USSector[]; timestamp: string }>('/api/us/sector-heatmap'),
    getStockChart: (ticker: string, period = '6mo') =>
        fetchAPI<{ ticker: string; data: any[]; period: string }>(`/api/us/stock-chart/${ticker}?period=${period}`),
};

// Crypto API Types
export interface CryptoAsset {
    name: string;
    ticker: string;
    price: number;
    change: number;
    change_pct: number;
    volume_24h: number;
}

export interface CryptoDominance {
    btc_price: number;
    eth_price: number;
    btc_rsi: number;
    btc_30d_change: number;
    sentiment: string;
}

export const cryptoAPI = {
    getOverview: () => fetchAPI<{ cryptos: CryptoAsset[]; timestamp: string }>('/api/crypto/overview'),
    getDominance: () => fetchAPI<CryptoDominance>('/api/crypto/dominance'),
    getChart: (ticker: string, period = '3mo') =>
        fetchAPI<{ ticker: string; data: any[]; period: string }>(`/api/crypto/chart/${ticker}?period=${period}`),
};

// Economy API Types
export interface EconIndicator {
    ticker: string;
    name: string;
    unit: string;
    value: number;
    change: number;
    change_pct: number;
}

export interface YieldPoint {
    tenor: string;
    months: number;
    yield_pct: number;
}

export interface FearGreed {
    vix: number;
    vix_change: number;
    vix_30d_avg: number;
    score: number;
    sentiment: string;
}

export const econAPI = {
    getOverview: () => fetchAPI<{ indicators: EconIndicator[]; timestamp: string }>('/api/econ/overview'),
    getYieldCurve: () => fetchAPI<{ yields: YieldPoint[]; inverted: boolean; timestamp: string }>('/api/econ/yield-curve'),
    getFearGreed: () => fetchAPI<FearGreed>('/api/econ/fear-greed'),
};

// Dividend API Types
export interface DividendStock {
    ticker: string;
    name: string;
    type: string;
    price: number;
    change_pct: number;
    dividend_yield: number;
}

export const dividendAPI = {
    getTop: () => fetchAPI<{ dividends: DividendStock[]; timestamp: string }>('/api/dividend/top'),
    getKRTop: () => fetchAPI<{ kr_dividends: any[]; timestamp: string }>('/api/dividend/kr-top'),
};

// Chatbot API
export const chatbotAPI = {
    sendMessage: (message: string) =>
        fetch(`${API_BASE}/api/kr/chatbot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        }).then(r => r.json()),
    getWelcome: () => fetchAPI<{ message: string }>('/api/kr/chatbot/welcome'),
    getStatus: () => fetchAPI<any>('/api/kr/chatbot/status'),
};

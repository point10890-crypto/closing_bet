// API utility functions

// Direct Flask backend (bypass Next.js proxy issues)
const API_BASE = 'http://localhost:5001';

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

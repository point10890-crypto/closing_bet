'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

/* ── 타입 정의 ── */
interface Stock {
    name: string;
    ticker: string;
    code: string;
    market: string;
    type: string;
}

interface PriceTargets {
    current: number | null;
    high: number | null;
    low: number | null;
    mean: number | null;
    median: number | null;
}

interface RecommendationDetail {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

interface KeyStats {
    name: string;
    sector: string;
    industry: string;
    market_cap: number | null;
    pe_ratio: number | null;
    forward_pe: number | null;
    dividend_yield: number | null;
    beta: number | null;
    fifty_two_week_high: number | null;
    fifty_two_week_low: number | null;
    currency: string;
}

interface AnalyzeResult {
    name: string;
    ticker: string;
    result: string;
    date: string;
    elapsed: number;
    consensus_score: number | null;
    analyst_count: number;
    recommendation_detail: RecommendationDetail | null;
    price_targets: PriceTargets | null;
    current_price: number | null;
    upside_potential: number | null;
    key_stats: KeyStats | null;
}

interface HistoryEntry {
    name: string;
    ticker: string;
    result: string;
    date: string;
    consensus_score: number | null;
    analyst_count: number;
}

/* ── 유틸리티 ── */
function getResultColor(text: string) {
    if (text.includes('적극 매수')) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (text.includes('매수')) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    if (text.includes('적극 매도')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (text.includes('매도')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    if (text.includes('중립')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-gray-400 bg-white/5 border-white/10';
}

function getResultEmoji(text: string) {
    if (text.includes('적극 매수')) return '🔥';
    if (text.includes('매수')) return '📈';
    if (text.includes('적극 매도')) return '🧊';
    if (text.includes('매도')) return '📉';
    if (text.includes('중립')) return '⚖️';
    return '📊';
}

function formatNumber(n: number | null | undefined, currency = 'KRW'): string {
    if (n == null) return '--';
    if (currency === 'KRW') {
        if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}조`;
        if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(0)}억`;
        return n.toLocaleString('ko-KR');
    }
    if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    return `$${n.toLocaleString('en-US')}`;
}

function formatPrice(n: number | null | undefined, currency = 'KRW'): string {
    if (n == null) return '--';
    if (currency === 'KRW') return `₩${n.toLocaleString('ko-KR')}`;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── 추천 게이지 바 ── */
function RecommendationBar({ detail }: { detail: RecommendationDetail }) {
    const total = detail.strongBuy + detail.buy + detail.hold + detail.sell + detail.strongSell;
    if (total === 0) return null;

    const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;

    const segments = [
        { label: '적극매수', value: detail.strongBuy, color: 'bg-red-500' },
        { label: '매수', value: detail.buy, color: 'bg-orange-500' },
        { label: '중립', value: detail.hold, color: 'bg-yellow-500' },
        { label: '매도', value: detail.sell, color: 'bg-cyan-500' },
        { label: '적극매도', value: detail.strongSell, color: 'bg-blue-500' },
    ];

    return (
        <div>
            {/* Bar */}
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {segments.map((s) => (
                    s.value > 0 ? (
                        <div key={s.label} className={`${s.color} transition-all`}
                            style={{ width: pct(s.value) }} title={`${s.label}: ${s.value}`} />
                    ) : null
                ))}
            </div>
            {/* Labels */}
            <div className="flex justify-between mt-2 text-[10px]">
                {segments.map((s) => (
                    <div key={s.label} className="text-center">
                        <div className={`font-bold ${s.value > 0 ? 'text-gray-300' : 'text-gray-700'}`}>{s.value}</div>
                        <div className="text-gray-600">{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── 목표가 게이지 ── */
function PriceTargetGauge({ targets, currentPrice, currency }: {
    targets: PriceTargets; currentPrice: number | null; currency: string
}) {
    if (!targets.low || !targets.high || !currentPrice) return null;

    const range = targets.high - targets.low;
    const currentPct = range > 0 ? Math.max(0, Math.min(100, ((currentPrice - targets.low) / range) * 100)) : 50;
    const meanPct = targets.mean && range > 0 ? Math.max(0, Math.min(100, ((targets.mean - targets.low) / range) * 100)) : null;

    return (
        <div className="space-y-2">
            <div className="relative h-2 bg-white/10 rounded-full">
                {/* Mean target marker */}
                {meanPct != null && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full border-2 border-black z-10"
                        style={{ left: `${meanPct}%` }} title={`평균 목표가: ${formatPrice(targets.mean, currency)}`} />
                )}
                {/* Current price marker */}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-black z-20"
                    style={{ left: `${currentPct}%` }} title={`현재가: ${formatPrice(currentPrice, currency)}`} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
                <span>{formatPrice(targets.low, currency)}</span>
                <span className="text-orange-400">평균 {formatPrice(targets.mean, currency)}</span>
                <span>{formatPrice(targets.high, currency)}</span>
            </div>
        </div>
    );
}


/* ── 메인 컴포넌트 ── */
function StockAnalyzerContent() {
    const searchParams = useSearchParams();

    // Search state
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Stock[]>([]);
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);

    // Analysis state
    const [loading, setLoading] = useState(false);
    const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
    const [error, setError] = useState('');

    // History state
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // Toast state
    const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

    // Refs
    const debounceRef = useRef<NodeJS.Timeout>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const autoAnalyzed = useRef(false);

    const showToast = useCallback((message: string, isError: boolean) => {
        setToast({ message, isError });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Analyze stock
    const analyzeStock = useCallback(async (stock: Stock) => {
        setLoading(true);
        setAnalyzeResult(null);
        setError('');

        try {
            const res = await fetch('/api/stock-analyzer/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: stock.ticker, name: stock.name })
            });
            const data = await res.json();

            if (res.ok) {
                setAnalyzeResult(data);
                const entry: HistoryEntry = {
                    name: data.name,
                    ticker: data.ticker,
                    result: data.result,
                    date: data.date,
                    consensus_score: data.consensus_score,
                    analyst_count: data.analyst_count || 0,
                };
                setHistory(prev => [entry, ...prev]);
                showToast(`${data.name}: ${data.result}`, false);
            } else {
                setError(data.error || '분석 실패');
                showToast(data.error || '분석 실패', true);
            }
        } catch {
            setError('네트워크 오류');
            showToast('네트워크 오류', true);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    // Auto-analyze from URL params (CommandPalette redirect)
    useEffect(() => {
        if (autoAnalyzed.current) return;
        const name = searchParams.get('name');
        const ticker = searchParams.get('ticker') || searchParams.get('url');
        if (name && ticker) {
            autoAnalyzed.current = true;
            const stock: Stock = { name, ticker, code: ticker, market: '', type: '' };
            setSelectedStock(stock);
            setQuery(name);
            analyzeStock(stock);
        }
    }, [searchParams, analyzeStock]);

    // Search stocks with debounce
    const searchStocks = useCallback(async (q: string) => {
        if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
        try {
            const res = await fetch(`/api/stock-analyzer/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
                setSelectedIndex(0);
                setShowDropdown(data.length > 0);
            }
        } catch { setSearchResults([]); setShowDropdown(false); }
    }, []);

    const handleInput = (val: string) => {
        setQuery(val);
        setSelectedStock(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchStocks(val), 300);
    };

    const selectStock = (stock: Stock) => {
        setSelectedStock(stock);
        setQuery(stock.name);
        setSearchResults([]);
        setShowDropdown(false);
        setError('');
    };

    const clearSelection = () => {
        setSelectedStock(null);
        setQuery('');
        setAnalyzeResult(null);
        setError('');
        inputRef.current?.focus();
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showDropdown && searchResults.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                selectStock(searchResults[selectedIndex]);
            }
        } else if (e.key === 'Enter' && selectedStock) {
            e.preventDefault();
            analyzeStock(selectedStock);
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = () => setShowDropdown(false);
        if (showDropdown) {
            setTimeout(() => document.addEventListener('click', handleClick), 0);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [showDropdown]);

    // Excel export
    const exportExcel = async () => {
        if (history.length === 0) return;
        const records = history.map(h => ({
            '종목': h.name,
            '티커': h.ticker,
            '추천': h.result,
            '컨센서스': h.consensus_score,
            '애널리스트': h.analyst_count,
            '조회시간': h.date
        }));
        try {
            const res = await fetch('/api/stock-analyzer/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records })
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const now = new Date();
                a.download = `${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_analyst_consensus.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(`${history.length}건 Excel 다운로드 완료`, false);
            }
        } catch { showToast('Excel 내보내기 실패', true); }
    };

    const currency = analyzeResult?.key_stats?.currency || (analyzeResult?.ticker?.includes('.K') ? 'KRW' : 'USD');

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/5 text-xs text-orange-400 font-medium mb-3 md:mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                    Analyst Consensus
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-2xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-1 md:mb-2">
                            Stock <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">Analyzer</span>
                        </h2>
                        <p className="text-gray-400 text-sm md:text-lg">애널리스트 컨센서스 기반 종목 분석 (KR + US)</p>
                    </div>
                    {history.length > 0 && (
                        <button onClick={exportExcel}
                            className="self-start px-4 md:px-5 py-2 md:py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs md:text-sm font-bold rounded-xl hover:bg-emerald-500/20 transition-colors">
                            <i className="fas fa-file-excel mr-2"></i>Excel 내보내기
                        </button>
                    )}
                </div>
            </div>

            {/* Search Card */}
            <div className="p-4 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">종목 검색</h3>
                <div className="relative">
                    <div className="flex items-center">
                        <i className="fas fa-search text-gray-500 text-sm mr-3"></i>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => handleInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full py-3 bg-transparent text-sm text-white placeholder-gray-500 outline-none border-b border-white/10 focus:border-orange-500/50 transition-colors"
                            placeholder="종목명 또는 티커 입력 (예: 삼성전자, SK하이닉스, AAPL, NVDA...)"
                            disabled={loading}
                        />
                        {query && !loading && (
                            <button onClick={clearSelection} className="text-gray-500 hover:text-white ml-2">
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        )}
                    </div>

                    {/* Dropdown results */}
                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0c] border border-white/10 rounded-xl max-h-64 overflow-y-auto z-50 shadow-2xl">
                            {searchResults.map((stock, i) => (
                                <button
                                    key={`${stock.ticker}-${i}`}
                                    onClick={(e) => { e.stopPropagation(); selectStock(stock); }}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                                        i === selectedIndex ? 'bg-orange-500/10 text-white' : 'text-gray-300 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                            stock.type === 'KR' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                                        }`}>
                                            {stock.market || 'US'}
                                        </span>
                                        <span className="text-sm truncate">{stock.name}</span>
                                        <span className="text-[10px] text-gray-600 shrink-0">{stock.ticker}</span>
                                    </div>
                                    <i className="fas fa-chevron-right text-[10px] text-gray-600"></i>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Stock Bar */}
                {selectedStock && !loading && (
                    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="min-w-0 flex-1 flex items-center gap-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                selectedStock.type === 'KR' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                            }`}>
                                {selectedStock.market || 'US'}
                            </span>
                            <div className="min-w-0">
                                <div className="text-white font-bold">{selectedStock.name}</div>
                                <div className="text-xs text-gray-600 mt-0.5">{selectedStock.ticker}</div>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button onClick={() => analyzeStock(selectedStock)}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-lg transition-colors active:scale-95">
                                <i className="fas fa-chart-line mr-2"></i>분석 조회
                            </button>
                            <button onClick={clearSelection}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 text-sm rounded-lg border border-white/10 transition-colors">
                                취소
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="p-6 md:p-8 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="w-10 h-10 border-[3px] border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 text-sm">애널리스트 컨센서스 분석 중...</p>
                    <p className="text-gray-600 text-xs mt-2">{selectedStock?.name} ({selectedStock?.ticker})</p>
                </div>
            )}

            {/* Analysis Result — Rich View */}
            {analyzeResult && !loading && (
                <div className="space-y-4">
                    {/* Main Result Card */}
                    <div className="p-4 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg md:text-xl font-bold text-white">
                                    {analyzeResult.name}
                                    <span className="text-xs text-gray-500 ml-2 font-normal">{analyzeResult.ticker}</span>
                                </h3>
                                {analyzeResult.key_stats?.sector && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {analyzeResult.key_stats.sector} · {analyzeResult.key_stats.industry}
                                    </p>
                                )}
                            </div>
                            <span className="text-[10px] text-gray-600">{analyzeResult.date} ({analyzeResult.elapsed}s)</span>
                        </div>

                        {/* Score + Recommendation */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 py-4">
                            <div className="text-center">
                                <span className="text-4xl md:text-5xl">{getResultEmoji(analyzeResult.result)}</span>
                            </div>
                            <div className="text-center sm:text-left flex-1">
                                <div className={`inline-block px-5 md:px-8 py-2.5 md:py-3 rounded-xl text-xl md:text-2xl font-bold border ${getResultColor(analyzeResult.result)}`}>
                                    {analyzeResult.result}
                                </div>
                                {analyzeResult.consensus_score && (
                                    <div className="mt-2 text-sm text-gray-400">
                                        컨센서스 <span className="text-white font-bold">{analyzeResult.consensus_score}</span>/5.0
                                        <span className="text-gray-600 ml-2">({analyzeResult.analyst_count}명 애널리스트)</span>
                                    </div>
                                )}
                            </div>
                            {/* Price + Upside */}
                            <div className="text-center sm:text-right shrink-0">
                                <div className="text-2xl md:text-3xl font-bold text-white">
                                    {formatPrice(analyzeResult.current_price, currency)}
                                </div>
                                {analyzeResult.upside_potential != null && (
                                    <div className={`text-sm font-bold mt-1 ${
                                        analyzeResult.upside_potential >= 0 ? 'text-red-400' : 'text-blue-400'
                                    }`}>
                                        목표 대비 {analyzeResult.upside_potential > 0 ? '+' : ''}{analyzeResult.upside_potential}%
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Analyst Recommendations Bar */}
                        {analyzeResult.recommendation_detail && (
                            <div className="p-4 md:p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                    <i className="fas fa-users mr-2 text-orange-400"></i>애널리스트 의견
                                </h4>
                                <RecommendationBar detail={analyzeResult.recommendation_detail} />
                            </div>
                        )}

                        {/* Price Target Gauge */}
                        {analyzeResult.price_targets && (
                            <div className="p-4 md:p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                    <i className="fas fa-bullseye mr-2 text-orange-400"></i>목표가 범위
                                </h4>
                                <PriceTargetGauge
                                    targets={analyzeResult.price_targets}
                                    currentPrice={analyzeResult.current_price}
                                    currency={currency}
                                />
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    <div className="text-center p-2 bg-white/5 rounded-lg">
                                        <div className="text-[10px] text-gray-500">최저</div>
                                        <div className="text-xs text-white font-bold">{formatPrice(analyzeResult.price_targets.low, currency)}</div>
                                    </div>
                                    <div className="text-center p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                        <div className="text-[10px] text-orange-400">평균 목표</div>
                                        <div className="text-xs text-orange-300 font-bold">{formatPrice(analyzeResult.price_targets.mean, currency)}</div>
                                    </div>
                                    <div className="text-center p-2 bg-white/5 rounded-lg">
                                        <div className="text-[10px] text-gray-500">최고</div>
                                        <div className="text-xs text-white font-bold">{formatPrice(analyzeResult.price_targets.high, currency)}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Key Stats */}
                        {analyzeResult.key_stats && (
                            <div className="p-4 md:p-5 rounded-2xl bg-[#1c1c1e] border border-white/10 md:col-span-2">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                    <i className="fas fa-chart-bar mr-2 text-orange-400"></i>주요 지표
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: '시가총액', value: formatNumber(analyzeResult.key_stats.market_cap, currency) },
                                        { label: 'PER', value: analyzeResult.key_stats.pe_ratio?.toFixed(1) ?? '--' },
                                        { label: 'Forward PE', value: analyzeResult.key_stats.forward_pe?.toFixed(1) ?? '--' },
                                        { label: '배당수익률', value: analyzeResult.key_stats.dividend_yield != null ? `${analyzeResult.key_stats.dividend_yield.toFixed(2)}%` : '--' },
                                        { label: '52주 최고', value: formatPrice(analyzeResult.key_stats.fifty_two_week_high, currency) },
                                        { label: '52주 최저', value: formatPrice(analyzeResult.key_stats.fifty_two_week_low, currency) },
                                        { label: '베타', value: analyzeResult.key_stats.beta?.toFixed(2) ?? '--' },
                                        { label: '현재가', value: formatPrice(analyzeResult.current_price, currency) },
                                    ].map((stat) => (
                                        <div key={stat.label} className="p-3 bg-white/5 rounded-lg">
                                            <div className="text-[10px] text-gray-500 mb-1">{stat.label}</div>
                                            <div className="text-sm text-white font-bold truncate">{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="p-4 md:p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
                    <i className="fas fa-exclamation-triangle text-red-400 text-xl md:text-2xl mb-3 block"></i>
                    <p className="text-red-400 text-xs md:text-sm">{error}</p>
                </div>
            )}

            {/* History Table */}
            {history.length > 0 && (
                <div className="p-4 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wider">
                            조회 기록 ({history.length}건)
                        </h3>
                        <button onClick={exportExcel}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] md:text-xs font-bold rounded-lg hover:bg-emerald-500/20 transition-colors">
                            <i className="fas fa-file-excel mr-1 md:mr-2"></i>Excel 저장
                        </button>
                    </div>

                    {/* Mobile: Card layout */}
                    <div className="md:hidden space-y-2">
                        {history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xs text-gray-600 shrink-0">#{history.length - i}</span>
                                    <div className="min-w-0">
                                        <div className="text-sm text-white font-medium truncate">{h.name}</div>
                                        <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                                            {h.ticker} · {h.analyst_count}명
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2 text-right">
                                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getResultColor(h.result)}`}>
                                        {h.result}
                                    </span>
                                    {h.consensus_score && (
                                        <div className="text-[10px] text-gray-600 mt-1">{h.consensus_score}/5.0</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop: Table layout */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">#</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">종목</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">티커</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">컨센서스</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">스코어</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">애널리스트</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">조회 시간</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 text-sm text-gray-400">{history.length - i}</td>
                                        <td className="px-4 py-3 text-sm text-white font-medium">{h.name}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{h.ticker}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-3 py-1 rounded text-xs font-bold border ${getResultColor(h.result)}`}>
                                                {h.result}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white font-bold">{h.consensus_score ?? '--'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{h.analyst_count}명</td>
                                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">{h.date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && !analyzeResult && !error && !selectedStock && history.length === 0 && (
                <div className="text-center py-12 md:py-20">
                    <i className="fas fa-chart-line text-3xl md:text-4xl text-gray-700 mb-4 block"></i>
                    <p className="text-gray-500 text-xs md:text-sm">
                        종목을 검색하고 &quot;분석 조회&quot; 버튼을 클릭하면<br />
                        애널리스트 컨센서스 분석 결과를 가져옵니다.
                    </p>
                    <p className="text-gray-600 text-[10px] mt-3">
                        KR: 삼성전자, SK하이닉스 등 2,760종목 | US: AAPL, NVDA 등 50+ 종목
                    </p>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 left-4 md:left-auto z-[100] px-5 py-3 rounded-xl text-sm font-medium text-white shadow-2xl transition-all text-center md:text-left ${
                    toast.isError ? 'bg-red-600' : 'bg-emerald-600'
                }`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}

export default function StockAnalyzerPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
        }>
            <StockAnalyzerContent />
        </Suspense>
    );
}

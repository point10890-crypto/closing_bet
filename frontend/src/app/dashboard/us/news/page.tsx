'use client';

import { useEffect, useState } from 'react';
import ErrorBanner from '@/components/ui/ErrorBanner';

interface NewsAnalysis {
    ticker: string;
    news_score: number;
    sentiment: string;
    reason: string;
    action: string;
    catalysts: string[];
    risk: string;
    citations: string[];
    analyzed_at: string;
}

type ActionFilter = 'ALL' | 'BUY' | 'HOLD' | 'AVOID';

export function NewsView() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newsData, setNewsData] = useState<NewsAnalysis[]>([]);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/us/news-analysis');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setNewsData(data.analysis || []);
        } catch {
            setError('Failed to load news analysis.');
        } finally {
            setLoading(false);
        }
    };

    const filtered = newsData.filter(item =>
        actionFilter === 'ALL' || item.action === actionFilter
    );

    const selectedItem = newsData.find(n => n.ticker === selectedTicker);

    const getScoreColor = (score: number) => {
        if (score >= 3) return 'text-green-400';
        if (score >= 2) return 'text-blue-400';
        if (score >= 1) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'BUY': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'AVOID': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const filterButtons: ActionFilter[] = ['ALL', 'BUY', 'HOLD', 'AVOID'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/5 text-xs text-purple-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
                    Perplexity + Gemini
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                            News <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Analysis</span>
                        </h2>
                        <p className="text-gray-400">AI 기반 실시간 뉴스 분석</p>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <i className={`fas fa-sync-alt mr-2 ${loading ? 'animate-spin' : ''}`}></i>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && <ErrorBanner message={error} onRetry={loadData} />}

            {/* Action Filter */}
            {!loading && newsData.length > 0 && (
                <div className="flex items-center gap-2">
                    {filterButtons.map(f => (
                        <button
                            key={f}
                            onClick={() => setActionFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${actionFilter === f
                                    ? f === 'BUY' ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                        : f === 'AVOID' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                            : f === 'HOLD' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                                : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            )}

            {/* News Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse"></div>
                    ))}
                </div>
            ) : newsData.length === 0 ? (
                !error && (
                    <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <i className="fas fa-newspaper text-2xl text-purple-500"></i>
                        </div>
                        <div className="text-gray-500 text-lg mb-2">No news analysis available</div>
                        <div className="text-xs text-gray-600">Run: python3 us_market/us_news_analyzer.py --batch</div>
                    </div>
                )
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((item) => (
                        <div
                            key={item.ticker}
                            onClick={() => setSelectedTicker(item.ticker)}
                            className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="text-xl font-black text-white group-hover:text-purple-400 transition-colors">{item.ticker}</div>
                                    <div className="text-xs text-gray-500">{new Date(item.analyzed_at).toLocaleString('ko-KR')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`text-2xl font-black ${getScoreColor(item.news_score)}`}>
                                        {item.news_score}/3
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getActionBadge(item.action)}`}>
                                        {item.action}
                                    </span>
                                </div>
                            </div>

                            {/* Reason */}
                            <p className="text-sm text-gray-300 mb-3 line-clamp-2">{item.reason}</p>

                            {/* Catalysts */}
                            {item.catalysts && item.catalysts.length > 0 && (
                                <div className="mb-3">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">Catalysts</div>
                                    <div className="flex flex-wrap gap-1">
                                        {item.catalysts.map((c, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px]">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Citations */}
                            {item.citations && item.citations.length > 0 && (
                                <div className="text-[10px] text-gray-500">
                                    <i className="fas fa-link mr-1"></i>
                                    {item.citations.length} sources — click for details
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTicker(null)}>
                    <div
                        className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black text-white">{selectedItem.ticker}</h3>
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${getActionBadge(selectedItem.action)}`}>
                                    {selectedItem.action}
                                </span>
                                <span className={`text-lg font-black ${getScoreColor(selectedItem.news_score)}`}>
                                    {selectedItem.news_score}/3
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedTicker(null)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto max-h-[65vh] p-6 space-y-4">
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Analysis</div>
                                <p className="text-sm text-gray-300 leading-relaxed">{selectedItem.reason}</p>
                            </div>

                            {selectedItem.risk && (
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Risk</div>
                                    <p className="text-sm text-red-400/80 leading-relaxed">{selectedItem.risk}</p>
                                </div>
                            )}

                            {selectedItem.catalysts?.length > 0 && (
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Catalysts</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedItem.catalysts.map((c, i) => (
                                            <span key={i} className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedItem.citations?.length > 0 && (
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Sources</div>
                                    <div className="space-y-1.5">
                                        {selectedItem.citations.map((url, i) => {
                                            let host = url;
                                            try { host = new URL(url).hostname; } catch { /* keep raw */ }
                                            return (
                                                <a
                                                    key={i}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                                >
                                                    <i className="fas fa-external-link-alt text-[10px]"></i>
                                                    {host}
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="text-[10px] text-gray-600 pt-2 border-t border-white/5">
                                Analyzed: {new Date(selectedItem.analyzed_at).toLocaleString('ko-KR')}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NewsPage() {
    return <NewsView />;
}

'use client';

import { useEffect, useState } from 'react';
import { krAPI, KRSignal, KRAIAnalysis } from '@/lib/api';

export default function VCPSignalsPage() {
    const [signals, setSignals] = useState<KRSignal[]>([]);
    const [aiData, setAiData] = useState<KRAIAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [signalDate, setSignalDate] = useState<string>('');

    useEffect(() => {
        loadSignals();
    }, []);

    // Real-time price updates (every 60s)
    useEffect(() => {
        if (loading || signals.length === 0) return;

        const updatePrices = async () => {
            try {
                const tickers = signals.map(s => s.ticker);
                if (tickers.length === 0) return;

                const res = await fetch('/api/kr/realtime-prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tickers })
                });
                const prices = await res.json();

                if (Object.keys(prices).length > 0) {
                    setSignals(prev => prev.map(s => {
                        if (prices[s.ticker]) {
                            const current = prices[s.ticker];
                            const entry = s.entry_price || 0;
                            let ret = s.return_pct || 0;
                            if (entry > 0) {
                                ret = ((current - entry) / entry) * 100;
                            }
                            return { ...s, current_price: current, return_pct: ret };
                        }
                        return s;
                    }));
                    setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
                }
            } catch (e) {
                console.error('Price update failed:', e);
            }
        };

        const interval = setInterval(updatePrices, 60000);
        return () => clearInterval(interval);
    }, [signals.length, loading]); // Only re-run if signal count changes (initial load)

    const loadSignals = async () => {
        setLoading(true);
        try {
            const [signalsRes, aiRes] = await Promise.all([
                krAPI.getSignals(),
                krAPI.getAIAnalysis(),
            ]);
            setSignals(signalsRes.signals || []);
            setAiData(aiRes);
            // Extract signal date from generated_at
            const genAt = (signalsRes as any).generated_at;
            if (genAt) {
                const d = new Date(genAt);
                setSignalDate(d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }));
            }
            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch (error) {
            console.error('Failed to load signals:', error);
        } finally {
            setLoading(false);
        }
    };

    // 수급 데이터를 억/만 단위로 포맷
    const formatFlow = (value: number | undefined) => {
        if (value === undefined || value === null) return '-';
        const absValue = Math.abs(value);
        if (absValue >= 100000000) {
            return `${(value / 100000000).toFixed(1)}억`;
        } else if (absValue >= 10000) {
            return `${(value / 10000).toFixed(0)}만`;
        }
        return value.toLocaleString();
    };

    const getAIBadge = (ticker: string, model: 'gpt' | 'gemini') => {
        if (!aiData) return null;
        const stock = aiData.signals?.find((s) => s.ticker === ticker);
        if (!stock) return null;

        const rec = model === 'gpt' ? stock.gpt_recommendation : stock.gemini_recommendation;
        if (!rec) return <span className="text-gray-500 text-[10px]">-</span>;

        const action = rec.action?.toUpperCase();
        let bgClass = 'bg-yellow-500/20 text-yellow-400';
        let icon = '■';
        let label = '관망';

        if (action === 'BUY') {
            bgClass = 'bg-green-500/20 text-green-400';
            icon = '▲';
            label = '매수';
        } else if (action === 'SELL') {
            bgClass = 'bg-red-500/20 text-red-400';
            icon = '▼';
            label = '매도';
        }

        return (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${bgClass} border border-current/30`} title={rec.reason}>
                {icon} {label}
            </span>
        );
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-xs text-blue-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                    VCP Pattern Scanner
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                    VCP <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Signals</span>
                </h2>
                <p className="text-gray-400 text-lg">Volatility Contraction Pattern + 기관/외국인 수급</p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                        Live VCP Signals
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full">
                        {signals.length}
                    </span>
                </div>

                <button
                    onClick={loadSignals}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
                    Refresh
                </button>
            </div>

            {/* Signals Table */}
            <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-black/20">
                            <tr className="text-[10px] text-gray-500 border-b border-white/5 uppercase tracking-wider">
                                <th className="px-4 py-3 font-semibold">Stock</th>
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold text-right">외국인 5D</th>
                                <th className="px-4 py-3 font-semibold text-right">기관 5D</th>
                                <th className="px-4 py-3 font-semibold text-center">Score</th>
                                <th className="px-4 py-3 font-semibold text-center">Cont.</th>
                                <th className="px-4 py-3 font-semibold text-right">Entry</th>
                                <th className="px-4 py-3 font-semibold text-right">Current</th>
                                <th className="px-4 py-3 font-semibold text-right">Return</th>
                                <th className="px-4 py-3 font-semibold text-center">GPT</th>
                                <th className="px-4 py-3 font-semibold text-center">Gemini</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="p-8 text-center text-gray-500">
                                        <i className="fas fa-spinner fa-spin text-2xl text-blue-500/50 mb-3"></i>
                                        <p className="text-xs">Loading signals...</p>
                                    </td>
                                </tr>
                            ) : signals.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="p-8 text-center text-gray-500">
                                        <i className="fas fa-inbox text-2xl opacity-30 mb-3"></i>
                                        <p className="text-xs">오늘 시그널이 없습니다</p>
                                    </td>
                                </tr>
                            ) : (
                                signals.map((signal, idx) => (
                                    <tr
                                        key={`${signal.ticker}-${idx}`}
                                        onClick={() => setSelectedTicker(signal.ticker)}
                                        className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedTicker === signal.ticker ? 'bg-white/10' : ''
                                            }`}
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {/* Stock Icon */}
                                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                                                    {signal.name?.charAt(0) || signal.ticker?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-bold">{signal.name || signal.ticker}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${signal.market === 'KOSPI' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>
                                                            {signal.market}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-mono">{signal.ticker}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs">{signal.signal_date || signalDate || '-'}</td>
                                        <td className={`px-4 py-3 text-right font-mono text-xs ${signal.foreign_5d > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            <div className="flex items-center justify-end gap-1">
                                                {signal.foreign_5d > 0 ? <i className="fas fa-arrow-up text-[8px]"></i> : signal.foreign_5d < 0 ? <i className="fas fa-arrow-down text-[8px]"></i> : null}
                                                {formatFlow(signal.foreign_5d)}
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono text-xs ${signal.inst_5d > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            <div className="flex items-center justify-end gap-1">
                                                {signal.inst_5d > 0 ? <i className="fas fa-arrow-up text-[8px]"></i> : signal.inst_5d < 0 ? <i className="fas fa-arrow-down text-[8px]"></i> : null}
                                                {formatFlow(signal.inst_5d)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                {signal.score ? Math.round(signal.score) : '-'}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-center font-mono text-xs ${signal.contraction_ratio && signal.contraction_ratio <= 0.6 ? 'text-emerald-400' : 'text-purple-400'
                                            }`}>
                                            {signal.contraction_ratio?.toFixed(2) ?? '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">
                                            ₩{signal.entry_price?.toLocaleString() ?? '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-white">
                                            ₩{signal.current_price?.toLocaleString() ?? '-'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${signal.return_pct >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {signal.return_pct !== undefined ? `${signal.return_pct >= 0 ? '+' : ''}${signal.return_pct.toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">{getAIBadge(signal.ticker, 'gpt')}</td>
                                        <td className="px-4 py-3 text-center">{getAIBadge(signal.ticker, 'gemini')}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Last Updated */}
            <div className="text-center text-xs text-gray-500">
                Last updated: {lastUpdated || '-'}
            </div>
        </div>
    );
}

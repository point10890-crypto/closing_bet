'use client';

import { useEffect, useState } from 'react';
import { usAPI } from '@/lib/api';
import StockDetailModal from '@/components/us/StockDetailModal';
import { PerformanceView } from '../cumulative-performance/page';

interface SmartPick {
    ticker: string;
    name: string;
    rank: number;
    final_score: number;
    quant_score: number;
    ai_bonus: number;
    ai_recommendation: string;
    price_at_analysis: number;
    target_upside: number;
    sd_stage: string;
    inst_pct: number;
    rsi: number;
    ai_summary?: string;
}

type PageTab = 'picks' | 'performance';
type SortKey = 'final_score' | 'quant_score' | 'ai_bonus' | 'inst_pct' | 'rsi' | 'target_upside' | 'ticker';

export default function SmartMoneyPage() {
    const [pageTab, setPageTab] = useState<PageTab>('picks');
    const [loading, setLoading] = useState(true);
    const [stocks, setStocks] = useState<SmartPick[]>([]);
    const [sortBy, setSortBy] = useState<SortKey>('final_score');
    const [sortAsc, setSortAsc] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await usAPI.getSmartMoney();
            setStocks((res.picks || []) as unknown as SmartPick[]);
            setLastUpdated(res.updated_at || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch { /* ignore */ }
        setLoading(false);
    };

    const handleSort = (key: SortKey) => {
        if (sortBy === key) setSortAsc(!sortAsc);
        else { setSortBy(key); setSortAsc(false); }
    };

    const sorted = [...stocks].sort((a, b) => {
        const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0;
        if (typeof av === 'string') return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    const avgScore = stocks.length > 0 ? stocks.reduce((s, p) => s + (p.final_score || 0), 0) / stocks.length : 0;
    const topStage = stocks.filter(s => s.sd_stage?.includes('Strong')).length;

    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-emerald-400';
        if (score >= 65) return 'text-blue-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-gray-400';
    };

    const getScoreBar = (score: number) => {
        if (score >= 75) return 'bg-emerald-500';
        if (score >= 65) return 'bg-blue-500';
        if (score >= 50) return 'bg-amber-500';
        return 'bg-gray-500';
    };

    const getStageBadge = (stage: string) => {
        if (stage?.includes('Strong Acc')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        if (stage?.includes('Acc')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        if (stage?.includes('Dist')) return 'bg-red-500/15 text-red-400 border-red-500/30';
        return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    };

    const getRecBadge = (rec: string) => {
        const r = rec?.toLowerCase() || '';
        if (r.includes('적극') || r.includes('strong')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
        if (r.includes('매수') || r.includes('buy')) return 'bg-green-500/15 text-green-400 border-green-500/30';
        if (r.includes('중립') || r.includes('hold')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    };

    const getRsiColor = (rsi: number) => {
        if (rsi >= 70) return 'text-red-400';
        if (rsi <= 30) return 'text-green-400';
        return 'text-gray-300';
    };

    const parseAiThesis = (summary: string | undefined): string => {
        if (!summary) return '';
        try {
            const cleaned = summary.replace(/```json\n?/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return parsed.thesis || '';
        } catch {
            return summary.slice(0, 200);
        }
    };

    const SortTh = ({ col, label, align = 'right' }: { col: SortKey; label: string; align?: string }) => (
        <th
            onClick={() => handleSort(col)}
            className={`px-3 py-3.5 text-[10px] uppercase tracking-wider font-semibold cursor-pointer hover:text-white transition-colors whitespace-nowrap ${align === 'left' ? 'text-left' : 'text-right'} ${sortBy === col ? 'text-blue-400' : 'text-gray-500'}`}
        >
            {label}
            <span className="ml-1">{sortBy === col ? (sortAsc ? '▲' : '▼') : ''}</span>
        </th>
    );

    if (pageTab === 'performance') {
        return (
            <div className="space-y-6">
                <div className="flex gap-2">
                    <button onClick={() => setPageTab('picks')} className="px-4 py-2 rounded-lg text-sm font-bold bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10">Current Picks</button>
                    <button className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Track Record</button>
                </div>
                <PerformanceView />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tab Toggle */}
            <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Current Picks</button>
                <button onClick={() => setPageTab('performance')} className="px-4 py-2 rounded-lg text-sm font-bold bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10">Track Record</button>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1">
                        Smart Money <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">Top Picks</span>
                    </h2>
                    <p className="text-sm text-gray-500">S&P 500 + NASDAQ 100 — Institutional Accumulation Screener</p>
                </div>
                <button onClick={loadData} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50">
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Picks', value: stocks.length.toString(), sub: 'screened stocks', color: 'text-white' },
                    { label: 'Avg Score', value: avgScore.toFixed(1), sub: '/ 100', color: getScoreColor(avgScore) },
                    { label: 'Strong Accumulation', value: topStage.toString(), sub: `of ${stocks.length} picks`, color: 'text-emerald-400' },
                    { label: 'Updated', value: lastUpdated ? new Date(lastUpdated).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) || lastUpdated : '--', sub: lastUpdated ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '', color: 'text-gray-300' },
                ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] backdrop-blur">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">{stat.label}</div>
                        <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
                        <div className="text-[11px] text-gray-600 mt-0.5">{stat.sub}</div>
                    </div>
                ))}
            </div>

            {/* Loading Skeleton */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
                    ))}
                </div>
            ) : stocks.length === 0 ? (
                <div className="p-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
                    <div className="text-gray-500 text-lg">No Smart Money data available</div>
                    <div className="text-xs text-gray-600 mt-2">Run the screener to generate picks</div>
                </div>
            ) : (
                /* Table */
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    <th className="px-3 py-3.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold text-center w-10">#</th>
                                    <SortTh col="ticker" label="Ticker" align="left" />
                                    <th className="px-3 py-3.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold text-left">Name</th>
                                    <SortTh col="final_score" label="Score" />
                                    <th className="px-3 py-3.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold text-left">S/D Stage</th>
                                    <SortTh col="rsi" label="RSI" />
                                    <SortTh col="inst_pct" label="Inst %" />
                                    <SortTh col="target_upside" label="Upside" />
                                    <th className="px-3 py-3.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold text-center">AI Rec</th>
                                    <th className="px-3 py-3.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((s, idx) => (
                                    <>
                                        <tr
                                            key={s.ticker}
                                            onClick={() => setExpandedRow(expandedRow === s.ticker ? null : s.ticker)}
                                            className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-all group"
                                        >
                                            {/* Rank */}
                                            <td className="px-3 py-4 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${idx < 3 ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-amber-300 border border-amber-500/30' : 'text-gray-600'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>

                                            {/* Ticker */}
                                            <td className="px-3 py-4">
                                                <button onClick={(e) => { e.stopPropagation(); setSelectedTicker(s.ticker); }}
                                                    className="text-sm font-black text-white hover:text-blue-400 transition-colors">
                                                    {s.ticker}
                                                </button>
                                            </td>

                                            {/* Name */}
                                            <td className="px-3 py-4 text-xs text-gray-400 max-w-[180px] truncate">{s.name}</td>

                                            {/* Score */}
                                            <td className="px-3 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                                        <div className={`h-full rounded-full ${getScoreBar(s.final_score)} transition-all`}
                                                            style={{ width: `${Math.min(s.final_score, 100)}%` }} />
                                                    </div>
                                                    <span className={`text-sm font-black tabular-nums ${getScoreColor(s.final_score)}`}>
                                                        {s.final_score?.toFixed(1)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* SD Stage */}
                                            <td className="px-3 py-4">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getStageBadge(s.sd_stage)}`}>
                                                    {s.sd_stage?.replace('Strong ', '⚡ ') || 'N/A'}
                                                </span>
                                            </td>

                                            {/* RSI */}
                                            <td className={`px-3 py-4 text-sm font-mono text-right ${getRsiColor(s.rsi)}`}>
                                                {s.rsi?.toFixed(1)}
                                            </td>

                                            {/* Inst % */}
                                            <td className="px-3 py-4 text-sm text-gray-300 text-right font-mono">
                                                {s.inst_pct?.toFixed(1)}%
                                            </td>

                                            {/* Target Upside */}
                                            <td className="px-3 py-4 text-right">
                                                <span className={`text-sm font-bold ${(s.target_upside || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {s.target_upside > 0 ? '+' : ''}{s.target_upside?.toFixed(1)}%
                                                </span>
                                            </td>

                                            {/* AI Recommendation */}
                                            <td className="px-3 py-4 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getRecBadge(s.ai_recommendation)}`}>
                                                    {s.ai_recommendation || 'N/A'}
                                                </span>
                                            </td>

                                            {/* Price */}
                                            <td className="px-3 py-4 text-sm font-bold text-gray-300 text-right tabular-nums">
                                                ${s.price_at_analysis?.toFixed(2)}
                                            </td>
                                        </tr>

                                        {/* Expanded AI Summary Row */}
                                        {expandedRow === s.ticker && s.ai_summary && (
                                            <tr key={`${s.ticker}-detail`} className="bg-white/[0.02]">
                                                <td colSpan={10} className="px-6 py-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-5 h-5 mt-0.5 rounded-md bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" /></svg>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-purple-400 uppercase tracking-wider font-bold mb-1">AI Analysis</div>
                                                            <p className="text-xs text-gray-400 leading-relaxed max-w-3xl">
                                                                {parseAiThesis(s.ai_summary)}
                                                            </p>
                                                            <div className="flex gap-4 mt-2 text-[10px] text-gray-600">
                                                                <span>Quant: <span className="text-gray-400 font-bold">{s.quant_score?.toFixed(1)}</span></span>
                                                                <span>AI Bonus: <span className="text-purple-400 font-bold">+{s.ai_bonus}</span></span>
                                                                <span>Final: <span className={`font-bold ${getScoreColor(s.final_score)}`}>{s.final_score?.toFixed(1)}</span></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Legend */}
                    <div className="px-4 py-3 border-t border-white/[0.04] flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-gray-600">
                        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>Score 75+</span>
                        <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>Score 65+</span>
                        <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1"></span>Score 50+</span>
                        <span className="ml-auto">Click row to expand AI analysis</span>
                    </div>
                </div>
            )}

            {/* Stock Detail Modal */}
            {selectedTicker && <StockDetailModal ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />}
        </div>
    );
}

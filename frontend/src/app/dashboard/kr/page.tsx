'use client';

import { useEffect, useState } from 'react';
import { krAPI, KRMarketGate, KRSignalsResponse } from '@/lib/api';

interface BacktestStats {
    status: string;
    count: number;
    win_rate: number;
    avg_return: number;
    profit_factor?: number;
    message?: string;
}

interface BacktestSummary {
    vcp: BacktestStats;
    closing_bet: BacktestStats;
}

export default function KRMarketOverview() {
    const [gateData, setGateData] = useState<KRMarketGate | null>(null);
    const [signalsData, setSignalsData] = useState<KRSignalsResponse | null>(null);
    const [backtestData, setBacktestData] = useState<BacktestSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setIsRefreshing(true);
        try {
            // Load core data
            const [gate, signals] = await Promise.all([
                krAPI.getMarketGate(),
                krAPI.getSignals(),
            ]);
            setGateData(gate);
            setSignalsData(signals);

            // Load Backtest Summary
            const btRes = await fetch('/api/kr/backtest-summary');
            if (btRes.ok) {
                setBacktestData(await btRes.json());
            }

            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch (error) {
            console.error('Failed to load KR Market data:', error);
        } finally {
            setLoading(false);
            setTimeout(() => setIsRefreshing(false), 500); // Animation delay
        }
    };

    // Color Helpers (Korean Market Standard: Red=Up/Good, Blue=Down/Bad)
    const getSentimentColor = (score: number) => {
        if (score >= 60) return 'text-rose-500'; // Bullish
        if (score >= 40) return 'text-amber-500'; // Neutral
        return 'text-blue-500'; // Bearish/Risk
    };

    const getSectorStyle = (signal: string) => {
        const s = signal?.toLowerCase();
        if (s === 'bullish') return 'bg-rose-500/5 border-rose-500/10 text-rose-400';
        if (s === 'bearish') return 'bg-blue-500/5 border-blue-500/10 text-blue-400';
        return 'bg-amber-500/5 border-amber-500/10 text-amber-400';
    };

    const getChangeColor = (val: number) => val >= 0 ? 'text-rose-400' : 'text-blue-400';
    const getChangeIcon = (val: number) => val >= 0 ? 'fa-caret-up' : 'fa-caret-down';

    return (
        <div className="space-y-6 animate-fade-in font-sans text-zinc-200">
            {/* Header Section */}
            <div className="relative flex flex-col md:flex-row justify-between items-end gap-6 mb-8 p-1">
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-400 font-bold tracking-wider mb-3 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]"></span>
                        SOUTH KOREA ALPHA
                    </div>
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                        Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400 animate-gradient-x">Overview</span>
                    </h2>
                    <p className="text-sm text-zinc-400 mt-2 font-medium">
                        Institutional smart money flow & VCP Analysis
                    </p>
                </div>

                {/* Refresh Action */}
                <div className="flex items-end gap-3 z-10">
                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Last Updated</div>
                        <div className="text-xs font-mono text-zinc-300">{lastUpdated || '--:--'}</div>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={isRefreshing}
                        className={`w-10 h-10 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg hover:shadow-rose-500/20 group relative overflow-hidden`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/0 to-blue-500/0 group-hover:from-rose-500/10 group-hover:to-blue-500/10 transition-all duration-500"></div>
                        <i className={`fas fa-sync-alt text-sm group-hover:rotate-180 transition-transform duration-700 ${isRefreshing ? 'animate-spin text-rose-400' : 'text-zinc-400 group-hover:text-white'}`}></i>
                    </button>
                </div>

                {/* Background Glow */}
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none opacity-50 mix-blend-screen"></div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 relative z-10">

                {/* 1. Market Gate (Gauge) - 3 Cols */}
                <div className="lg:col-span-3 p-6 rounded-3xl bg-zinc-900/50 backdrop-blur-md border border-white/5 shadow-xl relative group overflow-hidden flex flex-col items-center justify-center">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                        <i className={`fas fa-tachometer-alt text-5xl ${getSentimentColor(gateData?.score ?? 0)}`}></i>
                    </div>

                    <h3 className="text-xs font-bold text-zinc-500 tracking-wider mb-6 w-full text-center uppercase">Market Sentiment</h3>

                    <div className="relative w-40 h-40 flex items-center justify-center mb-4">
                        {/* Gauge BG */}
                        <svg className="w-full h-full -rotate-90 drop-shadow-2xl">
                            <circle cx="80" cy="80" r="70" stroke="#27272a" strokeWidth="8" fill="transparent" />
                            <circle
                                cx="80" cy="80" r="70"
                                stroke="url(#gateGradient)"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray="439.8"
                                strokeDashoffset={439.8 - (439.8 * (gateData?.score ?? 0) / 100)}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                            <defs>
                                <linearGradient id="gateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#3b82f6" />
                                    <stop offset="50%" stopColor="#f59e0b" />
                                    <stop offset="100%" stopColor="#f43f5e" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-4xl font-bold tracking-tight ${getSentimentColor(gateData?.score ?? 0)} drop-shadow-lg`}>
                                {loading ? '--' : gateData?.score ?? 0}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">Score</span>
                        </div>
                    </div>

                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-zinc-950 ${getSentimentColor(gateData?.score ?? 0).replace('text-', 'border-')}`}>
                        {loading ? 'Analyzing...' : gateData?.label ?? 'NEUTRAL'}
                    </div>
                </div>

                {/* 2. Sector Index - 9 Cols */}
                <div className="lg:col-span-9 p-6 rounded-3xl bg-zinc-900/50 backdrop-blur-md border border-white/5 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <i className="fas fa-layer-group text-zinc-500"></i>
                            Sector Performance
                        </h3>
                        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span> Bullish</span>
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Neutral</span>
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Bearish</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse"></div>
                            ))
                        ) : (
                            gateData?.sectors?.map((sector) => (
                                <div
                                    key={sector.name}
                                    className={`relative p-3 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group ${getSectorStyle(sector.signal)}`}
                                >
                                    <div className="flex flex-col justify-between h-full">
                                        <div className="text-[11px] font-bold opacity-70 mb-1 truncate">{sector.name}</div>
                                        <div className="flex items-end justify-between">
                                            <span className={`text-lg font-bold ${getChangeColor(sector.change_pct)}`}>
                                                {sector.change_pct > 0 ? '+' : ''}{sector.change_pct.toFixed(2)}<span className="text-[10px] opacity-70 ml-0.5">%</span>
                                            </span>
                                            <i className={`fas ${getChangeIcon(sector.change_pct)} ${getChangeColor(sector.change_pct)} text-xs opacity-50 group-hover:opacity-100 transition-opacity`}></i>
                                        </div>
                                    </div>
                                    {/* Decoration */}
                                    <div className={`absolute top-0 right-0 w-12 h-12 rounded-full blur-xl opacity-10 pointer-events-none ${sector.change_pct >= 0 ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 relative z-10">

                {/* A. Today's Signals */}
                <div className="group p-3 md:p-5 rounded-2xl md:rounded-3xl bg-zinc-900/50 backdrop-blur-md border border-white/5 shadow-xl hover:border-rose-500/20 transition-all duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                            Today&apos;s Signals
                            <i className="fas fa-bolt text-rose-500/50 group-hover:text-rose-500 transition-colors"></i>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                            <div className="text-2xl md:text-4xl font-bold text-white group-hover:text-rose-400 transition-colors drop-shadow-lg">
                                {loading ? '-' : signalsData?.signals?.length ?? 0}
                            </div>
                            <div className="text-xs font-bold text-zinc-500">ea</div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400">Target VCP + Foreign</span>
                            <i className="fas fa-arrow-right text-[10px] text-zinc-600 group-hover:text-rose-400 transition-colors -rotate-45 group-hover:rotate-0 transform duration-300"></i>
                        </div>
                    </div>
                </div>

                {/* B. VCP Strategy */}
                <div className="group p-3 md:p-5 rounded-2xl md:rounded-3xl bg-zinc-900/50 backdrop-blur-md border border-white/5 shadow-xl hover:border-amber-500/20 transition-all duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                            VCP Strategy
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold">WIN RATE</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <div className="text-2xl md:text-4xl font-bold text-white group-hover:text-amber-400 transition-colors drop-shadow-lg">
                                {loading ? '-' : backtestData?.vcp?.win_rate ?? 0}<span className="text-lg text-zinc-600">%</span>
                            </div>
                            <div className={`text-xs font-bold ${getChangeColor(backtestData?.vcp?.avg_return ?? 0)} px-1.5 py-0.5 rounded bg-zinc-950 border border-white/5`}>
                                {(backtestData?.vcp?.avg_return ?? 0) > 0 ? '+' : ''}{backtestData?.vcp?.avg_return ?? 0}%
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400">Total {backtestData?.vcp?.count ?? 0} trades</span>
                            {backtestData?.vcp?.status === 'OK' && <i className="fas fa-check-circle text-emerald-500/50 group-hover:text-emerald-500 transition-colors text-xs"></i>}
                        </div>
                    </div>
                </div>

                {/* C. Closing Bet */}
                <div className="group p-3 md:p-5 rounded-2xl md:rounded-3xl bg-zinc-900/50 backdrop-blur-md border border-white/5 shadow-xl hover:border-emerald-500/20 transition-all duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                            Closing Bet
                            {backtestData?.closing_bet?.status === 'Accumulating' ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold animate-pulse">ACCUMULATING</span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold">WIN RATE</span>
                            )}
                        </div>

                        {backtestData?.closing_bet?.status === 'Accumulating' ? (
                            <div className="py-1">
                                <div className="text-xl font-bold text-amber-400 mb-0.5 flex items-center gap-2">
                                    <i className="fas fa-database animate-pulse text-sm"></i> Collecting...
                                </div>
                                <div className="text-[11px] text-zinc-500 font-medium">
                                    Need 2+ days of data
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-baseline gap-2 mt-1">
                                <div className="text-2xl md:text-4xl font-bold text-white group-hover:text-emerald-400 transition-colors drop-shadow-lg">
                                    {loading ? '-' : backtestData?.closing_bet?.win_rate ?? 0}<span className="text-lg text-zinc-600">%</span>
                                </div>
                                <div className={`text-xs font-bold ${getChangeColor(backtestData?.closing_bet?.avg_return ?? 0)} px-1.5 py-0.5 rounded bg-zinc-950 border border-white/5`}>
                                    {(backtestData?.closing_bet?.avg_return ?? 0) > 0 ? '+' : ''}{backtestData?.closing_bet?.avg_return ?? 0}%
                                </div>
                            </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                            {backtestData?.closing_bet?.status === 'Accumulating' ? (
                                <span className="text-[11px] text-amber-500/70">Wait for updates</span>
                            ) : (
                                <span className="text-[11px] text-zinc-400">Total {backtestData?.closing_bet?.count ?? 0} trades</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* D. Market Indices (Merged) */}
                <div className="p-3 md:p-5 rounded-2xl md:rounded-3xl bg-zinc-900/50 backdrop-blur-md border border-white/5 shadow-xl hover:border-white/10 transition-all duration-500 flex flex-col justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Market Indices</div>

                        {/* KOSPI */}
                        <div className="mb-3">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-bold text-zinc-300">KOSPI</span>
                                <span className={`text-[10px] font-bold ${getChangeColor(gateData?.kospi_change_pct ?? 0)}`}>
                                    {gateData?.kospi_change_pct ? (gateData.kospi_change_pct >= 0 ? '+' : '') + gateData.kospi_change_pct.toFixed(2) + '%' : '--'}
                                </span>
                            </div>
                            <div className="text-xl font-bold text-white tracking-tight">
                                {loading ? '--' : gateData?.kospi_close?.toLocaleString() ?? '--'}
                            </div>
                            {/* Progess bar style indicator */}
                            <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${gateData?.kospi_change_pct && gateData.kospi_change_pct >= 0 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: '60%' }}></div>
                            </div>
                        </div>

                        {/* KOSDAQ */}
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-bold text-zinc-300">KOSDAQ</span>
                                <span className={`text-[10px] font-bold ${getChangeColor(gateData?.kosdaq_change_pct ?? 0)}`}>
                                    {gateData?.kosdaq_change_pct ? (gateData.kosdaq_change_pct >= 0 ? '+' : '') + gateData.kosdaq_change_pct.toFixed(2) + '%' : '--'}
                                </span>
                            </div>
                            <div className="text-xl font-bold text-white tracking-tight">
                                {loading ? '--' : gateData?.kosdaq_close?.toLocaleString() ?? '--'}
                            </div>
                            <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${gateData?.kosdaq_change_pct && gateData.kosdaq_change_pct >= 0 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: '40%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

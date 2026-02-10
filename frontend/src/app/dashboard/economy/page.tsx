'use client';

import { useEffect, useState } from 'react';
import { econAPI, EconIndicator, YieldPoint, FearGreed } from '@/lib/api';

export default function EconomyPage() {
    const [indicators, setIndicators] = useState<EconIndicator[]>([]);
    const [yields, setYields] = useState<YieldPoint[]>([]);
    const [inverted, setInverted] = useState(false);
    const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [overviewRes, yieldRes, fgRes] = await Promise.allSettled([
                econAPI.getOverview(),
                econAPI.getYieldCurve(),
                econAPI.getFearGreed(),
            ]);
            if (overviewRes.status === 'fulfilled') setIndicators(overviewRes.value.indicators);
            if (yieldRes.status === 'fulfilled') {
                setYields(yieldRes.value.yields);
                setInverted(yieldRes.value.inverted);
            }
            if (fgRes.status === 'fulfilled') setFearGreed(fgRes.value);
            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            console.error('Failed to load economy data:', e);
        } finally {
            setLoading(false);
        }
    };

    const getChangeColor = (val: number) => val >= 0 ? 'text-emerald-400' : 'text-red-400';
    const formatChange = (val: number) => val >= 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`;

    const getSentimentInfo = (s: string) => {
        if (s === 'EXTREME_GREED') return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Extreme Greed' };
        if (s === 'GREED') return { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Greed' };
        if (s === 'FEAR') return { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Fear' };
        if (s === 'EXTREME_FEAR') return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Extreme Fear' };
        return { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Neutral' };
    };

    const getScoreBarColor = (score: number) => {
        if (score >= 75) return 'bg-emerald-500';
        if (score >= 50) return 'bg-green-500';
        if (score >= 25) return 'bg-orange-500';
        return 'bg-red-500';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Economy Data...</p>
                </div>
            </div>
        );
    }

    const fgInfo = fearGreed ? getSentimentInfo(fearGreed.sentiment) : getSentimentInfo('NEUTRAL');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Economy</h1>
                    <p className="text-gray-500 text-sm mt-1">Indicators &middot; Yield Curve &middot; Fear & Greed</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && <span className="text-xs text-gray-500">{lastUpdated}</span>}
                    <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i>Refresh
                    </button>
                </div>
            </div>

            {/* Top Row: Fear & Greed + Yield Curve */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fear & Greed */}
                {fearGreed && (
                    <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-6">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Fear & Greed (VIX)</h3>
                        <div className="flex items-center gap-6">
                            <div className="flex-shrink-0">
                                <div className={`w-20 h-20 rounded-full ${fgInfo.bg} flex items-center justify-center border-2 border-gray-600/30`}>
                                    <span className={`text-2xl font-black ${fgInfo.color}`}>{fearGreed.score}</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className={`text-lg font-bold ${fgInfo.color}`}>{fgInfo.label}</div>
                                <div className="text-xs text-gray-500 mt-1">VIX {fearGreed.vix} ({fearGreed.vix_change >= 0 ? '+' : ''}{fearGreed.vix_change.toFixed(2)})</div>
                                <div className="text-xs text-gray-500">30D Avg: {fearGreed.vix_30d_avg}</div>
                                <div className="w-full h-2 bg-gray-700 rounded-full mt-3">
                                    <div className={`h-full rounded-full ${getScoreBarColor(fearGreed.score)} transition-all`} style={{ width: `${fearGreed.score}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Yield Curve */}
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">US Yield Curve</h3>
                        {inverted && (
                            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">INVERTED</span>
                        )}
                    </div>
                    <div className="flex items-end gap-4 h-32">
                        {yields.map((y) => {
                            const maxYield = Math.max(...yields.map(d => d.yield_pct), 1);
                            const height = (y.yield_pct / maxYield) * 100;
                            return (
                                <div key={y.tenor} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-gray-300 font-bold">{y.yield_pct.toFixed(2)}%</span>
                                    <div className="w-full rounded-t" style={{ height: `${height}%`, background: inverted ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)', border: `1px solid ${inverted ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.5)'}` }} />
                                    <span className="text-xs text-gray-500">{y.tenor}</span>
                                </div>
                            );
                        })}
                        {yields.length === 0 && (
                            <div className="w-full text-center text-gray-500 text-sm">No yield data</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Economic Indicators Grid */}
            <div>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Economic Indicators</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {indicators.map((ind) => (
                        <div key={ind.ticker} className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4 hover:border-gray-600/50 transition-colors">
                            <div className="text-xs text-gray-500 mb-1 truncate">{ind.name}</div>
                            <div className="text-lg font-bold text-white">
                                {ind.unit === '$' && '$'}{ind.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{ind.unit === '%' && '%'}{ind.unit === 'KRW' && ' KRW'}{ind.unit === 'JPY' && ' JPY'}
                            </div>
                            <div className={`text-sm font-semibold mt-1 ${getChangeColor(ind.change_pct)}`}>
                                {formatChange(ind.change_pct)}
                            </div>
                        </div>
                    ))}
                    {indicators.length === 0 && (
                        <div className="col-span-full text-center text-gray-500 text-sm py-8">No indicator data available</div>
                    )}
                </div>
            </div>
        </div>
    );
}

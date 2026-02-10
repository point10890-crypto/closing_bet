'use client';

import { useEffect, useState } from 'react';
import { usAPI, USMarketIndex, USMarketGate, USSector } from '@/lib/api';

export default function USMarketPage() {
    const [indices, setIndices] = useState<USMarketIndex[]>([]);
    const [gate, setGate] = useState<USMarketGate | null>(null);
    const [sectors, setSectors] = useState<USSector[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [portfolioRes, gateRes, sectorRes] = await Promise.allSettled([
                usAPI.getPortfolio(),
                usAPI.getMarketGate(),
                usAPI.getSectorHeatmap(),
            ]);
            if (portfolioRes.status === 'fulfilled') setIndices(portfolioRes.value.market_indices);
            if (gateRes.status === 'fulfilled') setGate(gateRes.value);
            if (sectorRes.status === 'fulfilled') setSectors(sectorRes.value.sectors);
            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            console.error('Failed to load US data:', e);
        } finally {
            setLoading(false);
        }
    };

    const getGateColor = (g: string) => {
        if (g === 'GREEN') return { bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', text: 'text-emerald-400' };
        if (g === 'RED') return { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/30', text: 'text-red-400' };
        return { bg: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', text: 'text-amber-400' };
    };

    const getChangeColor = (val: number) => val >= 0 ? 'text-emerald-400' : 'text-red-400';
    const formatChange = (val: number) => val >= 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading US Market Data...</p>
                </div>
            </div>
        );
    }

    const gateStyle = gate ? getGateColor(gate.gate) : getGateColor('YELLOW');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">US Market</h1>
                    <p className="text-gray-500 text-sm mt-1">Market Indices &middot; Sector Heatmap &middot; Market Gate</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && <span className="text-xs text-gray-500">{lastUpdated}</span>}
                    <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i>Refresh
                    </button>
                </div>
            </div>

            {/* Market Gate */}
            {gate && (
                <div className={`rounded-xl bg-gradient-to-r ${gateStyle.bg} border ${gateStyle.border} p-6`}>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${gateStyle.border} border-2`}>
                                <span className={`text-2xl font-black ${gateStyle.text}`}>{gate.score}</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg font-bold ${gateStyle.text}`}>{gate.gate}</span>
                                    <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">{gate.status}</span>
                                </div>
                                <p className="text-gray-400 text-sm mt-1">SPY ${gate.spy.price} &middot; RSI {gate.spy.rsi}</p>
                            </div>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="text-xs text-gray-500">
                                50MA <span className="text-gray-300">${gate.spy.ma50}</span> &middot; 200MA <span className="text-gray-300">${gate.spy.ma200}</span>
                            </div>
                            <div className="flex gap-3 text-xs">
                                <span className={getChangeColor(gate.spy.change_1d)}>1D {formatChange(gate.spy.change_1d)}</span>
                                <span className={getChangeColor(gate.spy.change_5d)}>5D {formatChange(gate.spy.change_5d)}</span>
                            </div>
                        </div>
                    </div>
                    {gate.reasons.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {gate.reasons.map((r, i) => (
                                <span key={i} className="text-xs px-2 py-1 rounded bg-gray-800/60 text-gray-300 border border-gray-700/50">{r}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Market Indices Grid */}
            <div>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Market Indices</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {indices.map((idx) => (
                        <div key={idx.ticker} className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4 hover:border-gray-600/50 transition-colors">
                            <div className="text-xs text-gray-500 mb-1">{idx.name}</div>
                            <div className="text-lg font-bold text-white">{idx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className={`text-sm font-semibold mt-1 ${getChangeColor(idx.change_pct)}`}>
                                {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)} ({formatChange(idx.change_pct)})
                            </div>
                        </div>
                    ))}
                    {indices.length === 0 && (
                        <div className="col-span-full text-center text-gray-500 text-sm py-8">No index data available</div>
                    )}
                </div>
            </div>

            {/* Sector Heatmap */}
            <div>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Sector Performance</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {sectors.map((s) => {
                        const pct = s.change_pct;
                        const intensity = Math.min(Math.abs(pct) * 30, 100);
                        const bgColor = pct >= 0
                            ? `rgba(16, 185, 129, ${intensity / 100 * 0.3})`
                            : `rgba(239, 68, 68, ${intensity / 100 * 0.3})`;
                        const borderColor = pct >= 0
                            ? `rgba(16, 185, 129, ${intensity / 100 * 0.4})`
                            : `rgba(239, 68, 68, ${intensity / 100 * 0.4})`;

                        return (
                            <div key={s.ticker} className="rounded-xl p-4 transition-all hover:scale-[1.02]"
                                style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-400 font-medium">{s.ticker}</span>
                                    <span className={`text-sm font-bold ${getChangeColor(pct)}`}>{formatChange(pct)}</span>
                                </div>
                                <div className="text-sm font-semibold text-white">{s.name}</div>
                                <div className="text-xs text-gray-400 mt-1">${s.price}</div>
                            </div>
                        );
                    })}
                    {sectors.length === 0 && (
                        <div className="col-span-full text-center text-gray-500 text-sm py-8">No sector data available</div>
                    )}
                </div>
            </div>
        </div>
    );
}

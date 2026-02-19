'use client';

import { useEffect, useState } from 'react';
import { usAPI, SectorRotationData } from '@/lib/api';

const SECTOR_NAMES: Record<string, string> = {
    XLK: 'Technology', XLF: 'Financials', XLV: 'Healthcare',
    XLY: 'Consumer Disc.', XLP: 'Consumer Staples', XLE: 'Energy',
    XLI: 'Industrials', XLB: 'Materials', XLRE: 'Real Estate',
    XLU: 'Utilities', XLC: 'Comm. Services',
};

const PHASE_COLORS: Record<string, string> = {
    'Early Cycle': 'text-green-400',
    'Mid Cycle': 'text-blue-400',
    'Late Cycle': 'text-yellow-400',
    'Recession': 'text-red-400',
};

const PHASE_BG: Record<string, string> = {
    'Early Cycle': 'bg-green-500/20 border-green-500/30',
    'Mid Cycle': 'bg-blue-500/20 border-blue-500/30',
    'Late Cycle': 'bg-yellow-500/20 border-yellow-500/30',
    'Recession': 'bg-red-500/20 border-red-500/30',
};

export function RotationView() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SectorRotationData | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await usAPI.getSectorRotation();
            setData(res);
        } catch (error) {
            console.error('Failed to load sector rotation:', error);
        } finally {
            setLoading(false);
        }
    };

    const getChangeColor = (val: number) => {
        if (val >= 3) return 'text-green-400';
        if (val >= 0) return 'text-green-300';
        if (val >= -3) return 'text-red-300';
        return 'text-red-400';
    };

    const getChangeBg = (val: number) => {
        if (val >= 5) return 'bg-green-500/30';
        if (val >= 2) return 'bg-green-500/20';
        if (val >= 0) return 'bg-green-500/10';
        if (val >= -2) return 'bg-red-500/10';
        if (val >= -5) return 'bg-red-500/20';
        return 'bg-red-500/30';
    };

    const signals = data?.rotation_signals;
    const perf = data?.performance_matrix;
    const moneyFlow = data?.money_flow;
    const clock = data?.rotation_clock;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/5 text-xs text-orange-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
                    Sector Rotation
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                            Sector <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">Rotation</span>
                        </h2>
                        <p className="text-gray-400">Business cycle phase detection & sector momentum tracking</p>
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

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse"></div>
                    ))}
                </div>
            ) : !data ? (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="text-gray-500 text-lg">No rotation data available</div>
                    <div className="text-xs text-gray-600 mt-2">Run: python3 us_market/sector_rotation.py</div>
                </div>
            ) : (
                <>
                    {/* Regime Change Alert */}
                    {moneyFlow?.regime_change_alert && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <i className="fas fa-exclamation-triangle text-red-400"></i>
                            </div>
                            <div>
                                <div className="text-red-400 font-bold text-sm">Regime Change Detected</div>
                                <div className="text-gray-400 text-xs">Business cycle phase has shifted - review positions</div>
                            </div>
                        </div>
                    )}

                    {/* Phase & Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Current Phase */}
                        <div className={`p-5 rounded-2xl border ${PHASE_BG[signals?.current_phase || ''] || 'bg-white/5 border-white/10'}`}>
                            <div className="text-xs text-gray-400 mb-1">Current Phase</div>
                            <div className={`text-2xl font-black ${PHASE_COLORS[signals?.current_phase || ''] || 'text-white'}`}>
                                {signals?.current_phase || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Confidence: {signals?.phase_confidence}%</div>
                        </div>

                        {/* Leading Sectors */}
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                            <div className="text-xs text-gray-400 mb-2">Leading Sectors</div>
                            <div className="space-y-1">
                                {signals?.leading_sectors?.map(ticker => (
                                    <div key={ticker} className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        <span className="text-sm text-green-400 font-bold">{ticker}</span>
                                        <span className="text-xs text-gray-500">{SECTOR_NAMES[ticker]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lagging Sectors */}
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                            <div className="text-xs text-gray-400 mb-2">Lagging Sectors</div>
                            <div className="space-y-1">
                                {signals?.lagging_sectors?.map(ticker => (
                                    <div key={ticker} className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                        <span className="text-sm text-red-400 font-bold">{ticker}</span>
                                        <span className="text-xs text-gray-500">{SECTOR_NAMES[ticker]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rotation Velocity */}
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                            <div className="text-xs text-gray-400 mb-1">Rotation Velocity</div>
                            <div className="text-2xl font-black text-white">{signals?.rotation_velocity?.toFixed(1)}</div>
                            <div className="text-xs text-gray-500 mt-1">Higher = faster rotation</div>
                        </div>
                    </div>

                    {/* Rotation Clock */}
                    {clock && (
                        <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                            <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                                <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                                Rotation Clock
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(clock.phases).map(([phase, info]) => {
                                    const isActive = signals?.current_phase === phase;
                                    return (
                                        <div
                                            key={phase}
                                            className={`p-4 rounded-xl border transition-all ${isActive
                                                ? `${PHASE_BG[phase]} ring-2 ring-offset-1 ring-offset-black ${phase === 'Early Cycle' ? 'ring-green-500/50' : phase === 'Mid Cycle' ? 'ring-blue-500/50' : phase === 'Late Cycle' ? 'ring-yellow-500/50' : 'ring-red-500/50'}`
                                                : 'bg-white/5 border-white/10'}`}
                                        >
                                            <div className={`text-sm font-bold mb-2 ${isActive ? PHASE_COLORS[phase] : 'text-gray-400'}`}>
                                                {isActive && <i className="fas fa-arrow-right mr-1"></i>}
                                                {phase}
                                            </div>
                                            <div className="text-xs text-gray-500 mb-2">Score: {info.score.toFixed(1)}</div>
                                            <div className="space-y-1">
                                                {info.sectors.map((s: any) => (
                                                    <div key={s.ticker} className="flex justify-between text-xs">
                                                        <span className="text-gray-400">{s.ticker}</span>
                                                        <span className={getChangeColor(s.return_1m)}>
                                                            {s.return_1m >= 0 ? '+' : ''}{s.return_1m.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Performance Heatmap */}
                    {perf && (
                        <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-x-auto">
                            <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                                <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                                Performance Matrix
                            </h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500 text-xs">
                                        <th className="text-left py-2 px-3">Sector</th>
                                        <th className="text-right py-2 px-2">1W</th>
                                        <th className="text-right py-2 px-2">1M</th>
                                        <th className="text-right py-2 px-2">3M</th>
                                        <th className="text-right py-2 px-2">6M</th>
                                        <th className="text-right py-2 px-2">12M</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(perf)
                                        .sort(([, a], [, b]) => (b['1m'] || 0) - (a['1m'] || 0))
                                        .map(([ticker, p]) => (
                                            <tr key={ticker} className="border-t border-white/5">
                                                <td className="py-2 px-3">
                                                    <span className="text-white font-bold">{ticker}</span>
                                                    <span className="text-gray-500 text-xs ml-2">{p.name}</span>
                                                </td>
                                                {(['1w', '1m', '3m', '6m', '12m'] as const).map(period => {
                                                    const val = p[period] || 0;
                                                    return (
                                                        <td key={period} className={`text-right py-2 px-2 rounded ${getChangeBg(val)}`}>
                                                            <span className={`font-mono text-xs ${getChangeColor(val)}`}>
                                                                {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Money Flow */}
                    {moneyFlow && (moneyFlow.inflows.length > 0 || moneyFlow.outflows.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                                <h3 className="text-sm font-bold text-green-400 mb-3">
                                    <i className="fas fa-arrow-up mr-2"></i>Money Inflows
                                </h3>
                                <div className="space-y-2">
                                    {moneyFlow.inflows.map(item => (
                                        <div key={item.ticker} className="flex justify-between items-center">
                                            <div>
                                                <span className="text-white font-bold text-sm">{item.ticker}</span>
                                                <span className="text-gray-500 text-xs ml-2">{item.name}</span>
                                            </div>
                                            <span className="text-green-400 text-sm font-mono">+{item.rs_change.toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {moneyFlow.inflows.length === 0 && (
                                        <div className="text-gray-600 text-xs">No significant inflows</div>
                                    )}
                                </div>
                            </div>
                            <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                                <h3 className="text-sm font-bold text-red-400 mb-3">
                                    <i className="fas fa-arrow-down mr-2"></i>Money Outflows
                                </h3>
                                <div className="space-y-2">
                                    {moneyFlow.outflows.map(item => (
                                        <div key={item.ticker} className="flex justify-between items-center">
                                            <div>
                                                <span className="text-white font-bold text-sm">{item.ticker}</span>
                                                <span className="text-gray-500 text-xs ml-2">{item.name}</span>
                                            </div>
                                            <span className="text-red-400 text-sm font-mono">{item.rs_change.toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {moneyFlow.outflows.length === 0 && (
                                        <div className="text-gray-600 text-xs">No significant outflows</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function SectorRotationPage() {
    return <RotationView />;
}

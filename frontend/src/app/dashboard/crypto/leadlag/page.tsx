'use client';

import { useEffect, useState } from 'react';
import { cryptoAPI, CryptoLeadLagData } from '@/lib/api';

export default function CryptoLeadLagPage() {
    const [data, setData] = useState<CryptoLeadLagData | null>(null);
    const [charts, setCharts] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [running, setRunning] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [res, chartRes] = await Promise.all([
                cryptoAPI.getLeadLag(),
                cryptoAPI.getLeadLagChartList(),
            ]);
            setData(res);
            setCharts(chartRes.charts || []);
        } catch (e: any) {
            setError(e.message || 'Failed to load lead-lag data');
        } finally {
            setLoading(false);
        }
    };

    const handleRunAnalysis = async () => {
        setRunning(true);
        try {
            await cryptoAPI.runLeadLag();
        } catch {
            // ignore
        }
        // Poll for completion
        const poll = setInterval(async () => {
            try {
                const status = await cryptoAPI.getTaskStatus();
                const tasks = (status as any).tasks || {};
                const latest = Object.entries(tasks).find(([k]) => k.startsWith('leadlag_'));
                if (latest && (latest[1] as any).status !== 'running') {
                    clearInterval(poll);
                    setRunning(false);
                    loadData();
                }
            } catch {
                clearInterval(poll);
                setRunning(false);
            }
        }, 3000);
    };

    const corrColor = (val: number) => {
        if (val >= 0.7) return 'text-emerald-400';
        if (val >= 0.4) return 'text-blue-400';
        if (val <= -0.4) return 'text-red-400';
        return 'text-gray-300';
    };

    const lagLabel = (lag: number) => {
        if (lag < 0) return `BTC leads by ${Math.abs(lag)} period${Math.abs(lag) > 1 ? 's' : ''}`;
        if (lag > 0) return `Lags BTC by ${lag} period${lag > 1 ? 's' : ''}`;
        return 'Synchronous';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Lead-Lag Analysis...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <p className="text-yellow-400 text-sm mb-3">{error || 'No lead-lag data available.'}</p>
                    <button onClick={loadData} className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Lead-Lag Analysis</h1>
                    <p className="text-gray-500 text-sm mt-1">Cross-Correlation &middot; Granger Causality &middot; Macro Indicators</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleRunAnalysis} disabled={running}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                        {running ? (
                            <><i className="fas fa-spinner fa-spin mr-1"></i>Running...</>
                        ) : (
                            <><i className="fas fa-play mr-1"></i>Run Analysis</>
                        )}
                    </button>
                    <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i>Refresh
                    </button>
                </div>
            </div>

            {/* Metadata */}
            {data.metadata && (
                <div className="text-xs text-gray-500">
                    Target: <span className="text-white font-semibold">{data.metadata.target}</span>
                    {data.metadata.generated_at && <> &middot; Generated: {new Date(data.metadata.generated_at).toLocaleString()}</>}
                </div>
            )}

            {/* Leading Indicators Summary Cards */}
            {data.lead_lag && data.lead_lag.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Cross-Correlation Results</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {data.lead_lag.map((item, i) => {
                            const absCorr = Math.abs(item.optimal_correlation);
                            const strengthLabel = absCorr >= 0.8 ? 'Very Strong' : absCorr >= 0.6 ? 'Strong' : absCorr >= 0.4 ? 'Moderate' : 'Weak';
                            const strengthColor = absCorr >= 0.8 ? 'text-emerald-400' : absCorr >= 0.6 ? 'text-blue-400' : absCorr >= 0.4 ? 'text-yellow-400' : 'text-gray-400';
                            return (
                                <div key={i} className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-white font-bold">{item.var1}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${absCorr >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700/50 text-gray-400'}`}>
                                            {strengthLabel}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <div className="text-xs text-gray-500">Optimal Lag</div>
                                            <div className="text-white font-semibold">{item.optimal_lag}</div>
                                            <div className="text-[10px] text-gray-500">{lagLabel(item.optimal_lag)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Correlation</div>
                                            <div className={`font-bold ${corrColor(item.optimal_correlation)}`}>
                                                {item.optimal_correlation.toFixed(4)}
                                            </div>
                                        </div>
                                    </div>
                                    {item.p_value !== undefined && (
                                        <div className="mt-2 text-xs text-gray-500">
                                            p-value: <span className={item.p_value < 0.05 ? 'text-emerald-400' : 'text-yellow-400'}>{item.p_value.toFixed(4)}</span>
                                            {item.p_value < 0.05 && <span className="text-emerald-400 ml-1">***</span>}
                                        </div>
                                    )}
                                    {item.interpretation && (
                                        <div className="mt-2 text-xs text-gray-400 leading-relaxed">{item.interpretation}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Granger Causality Table */}
            {data.granger && data.granger.length > 0 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">Granger Causality Tests</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase">
                                    <th className="text-left px-3 py-2">Cause</th>
                                    <th className="text-left px-3 py-2">Effect</th>
                                    <th className="text-right px-3 py-2">Best Lag</th>
                                    <th className="text-right px-3 py-2">p-value</th>
                                    <th className="text-center px-3 py-2">Significant</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.granger.map((g, i) => (
                                    <tr key={i} className="border-b border-gray-700/30 hover:bg-white/5">
                                        <td className="px-3 py-2 font-bold text-white">{g.cause}</td>
                                        <td className="px-3 py-2 text-gray-300">{g.effect}</td>
                                        <td className="px-3 py-2 text-right text-cyan-400">{g.best_lag}</td>
                                        <td className="px-3 py-2 text-right">
                                            <span className={g.best_p_value < 0.05 ? 'text-emerald-400' : 'text-yellow-400'}>
                                                {g.best_p_value.toFixed(4)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {g.is_significant ? (
                                                <span className="text-emerald-400 font-bold">***</span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Chart Gallery */}
            {charts.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Analysis Charts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {charts.map((fname) => {
                            const label = fname.replace(/\.png$/, '').replace(/_\d{8}_\d{6}$/, '').replace(/_/g, ' ');
                            return (
                                <div key={fname} className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
                                    <div className="text-xs text-gray-400 mb-2 capitalize">{label}</div>
                                    <img
                                        src={`/api/crypto/lead-lag/charts/${fname}`}
                                        alt={label}
                                        className="w-full rounded-lg"
                                        loading="lazy"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Data Summary */}
            {data.data_summary && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-2">Data Summary</h3>
                    <div className="text-xs text-gray-500 space-y-1">
                        {data.data_summary.date_range && (
                            <p>Period: {data.data_summary.date_range.start} ~ {data.data_summary.date_range.end} ({data.data_summary.date_range.periods} periods)</p>
                        )}
                        {data.data_summary.columns && (
                            <p>Variables: {data.data_summary.columns.filter((c: string) => !c.includes('_')).join(', ')}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

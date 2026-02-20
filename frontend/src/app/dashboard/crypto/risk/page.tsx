'use client';

import { useEffect, useState } from 'react';
import { cryptoAPI, CryptoRiskData } from '@/lib/api';

export default function CryptoRiskPage() {
    const [data, setData] = useState<CryptoRiskData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await cryptoAPI.getRisk();
            setData(res);
        } catch (e: any) {
            setError(e.message || 'Failed to load risk data');
        } finally {
            setLoading(false);
        }
    };

    const riskColor = (level: string) => {
        const map: Record<string, { bg: string; border: string; text: string }> = {
            'LOW': { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
            'MEDIUM': { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
            'HIGH': { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
            'EXTREME': { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
            'CRITICAL': { bg: 'bg-red-600/20', border: 'border-red-600/30', text: 'text-red-500' },
        };
        return map[level] || map['MEDIUM'];
    };

    const severityColor = (severity: string) => {
        if (severity === 'critical' || severity === 'high') return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (severity === 'medium' || severity === 'warning') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Risk Analysis...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <p className="text-yellow-400 text-sm mb-3">{error || 'No risk data available. Run crypto_risk.py first.'}</p>
                    <button onClick={loadData} className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20">Retry</button>
                </div>
            </div>
        );
    }

    const risk = riskColor(data.portfolio_summary.risk_level);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Crypto Risk</h1>
                    <p className="text-gray-500 text-sm mt-1">Portfolio Risk Analysis &middot; VaR &middot; Correlation &middot; Concentration</p>
                </div>
                <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-colors">
                    <i className="fas fa-sync-alt mr-1"></i>Refresh
                </button>
            </div>

            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`rounded-xl ${risk.bg} border ${risk.border} p-5`}>
                    <div className="text-xs text-gray-400 mb-1">Risk Level</div>
                    <div className={`text-2xl font-black ${risk.text}`}>{data.portfolio_summary.risk_level}</div>
                    <div className="text-xs text-gray-500 mt-1">{data.portfolio_summary.total_coins} coins tracked</div>
                </div>
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <div className="text-xs text-gray-400 mb-1">VaR (95%, 1D)</div>
                    <div className="text-xl font-bold text-red-400">{data.portfolio_summary.portfolio_var_95_1d.toFixed(2)}%</div>
                    <div className="text-xs text-gray-500 mt-1">Max daily loss (95% conf.)</div>
                </div>
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <div className="text-xs text-gray-400 mb-1">CVaR (95%, 1D)</div>
                    <div className="text-xl font-bold text-red-400">{data.portfolio_summary.portfolio_cvar_95_1d.toFixed(2)}%</div>
                    <div className="text-xs text-gray-500 mt-1">Expected loss beyond VaR</div>
                </div>
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <div className="text-xs text-gray-400 mb-1">BTC Weight</div>
                    <div className="text-xl font-bold text-yellow-400">{data.concentration.btc_weight_pct.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">Top 3: {data.concentration.top3_weight_pct.toFixed(1)}%</div>
                </div>
            </div>

            {/* Alerts */}
            {data.alerts && data.alerts.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Risk Alerts</h2>
                    {data.alerts.map((a, i) => (
                        <div key={i} className={`rounded-lg border px-4 py-3 text-sm ${severityColor(a.severity)}`}>
                            <span className="font-bold mr-2">[{a.severity.toUpperCase()}]</span>
                            <span className="font-semibold mr-1">{a.coin}:</span>
                            {a.message}
                        </div>
                    ))}
                </div>
            )}

            {/* Individual Risk */}
            {Object.keys(data.individual_risk).length > 0 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">Individual Coin Risk</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase">
                                    <th className="text-left px-3 py-2">Coin</th>
                                    <th className="text-right px-3 py-2">VaR 95% (1D)</th>
                                    <th className="text-right px-3 py-2">Max DD (30D)</th>
                                    <th className="text-right px-3 py-2">Volatility (30D)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(data.individual_risk).map(([coin, r]) => (
                                    <tr key={coin} className="border-b border-gray-700/30 hover:bg-white/5">
                                        <td className="px-3 py-2 font-bold text-white">{coin}</td>
                                        <td className="px-3 py-2 text-right text-red-400">{r.var_95_1d.toFixed(2)}%</td>
                                        <td className="px-3 py-2 text-right text-orange-400">{r.max_dd_30d.toFixed(2)}%</td>
                                        <td className="px-3 py-2 text-right text-yellow-400">{r.volatility_30d.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Correlation Matrix */}
            {data.correlation_matrix && data.correlation_matrix.coins.length > 0 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">Correlation Matrix</h3>
                    <div className="overflow-x-auto">
                        <table className="text-xs">
                            <thead>
                                <tr>
                                    <th className="px-2 py-1"></th>
                                    {data.correlation_matrix.coins.map(c => (
                                        <th key={c} className="px-2 py-1 text-gray-400 font-semibold">{c}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.correlation_matrix.coins.map((coin, i) => (
                                    <tr key={coin}>
                                        <td className="px-2 py-1 text-gray-400 font-semibold">{coin}</td>
                                        {data.correlation_matrix.values[i].map((val, j) => {
                                            const abs = Math.abs(val);
                                            let bg = 'bg-gray-700/30';
                                            if (i === j) bg = 'bg-gray-600/50';
                                            else if (val >= 0.7) bg = 'bg-emerald-500/30';
                                            else if (val >= 0.4) bg = 'bg-emerald-500/15';
                                            else if (val <= -0.4) bg = 'bg-red-500/20';
                                            return (
                                                <td key={j} className={`px-2 py-1 text-center ${bg} ${val >= 0.7 ? 'text-emerald-400' : val <= -0.4 ? 'text-red-400' : 'text-gray-300'}`}>
                                                    {val.toFixed(2)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Concentration Warnings */}
            {data.concentration.warnings && data.concentration.warnings.length > 0 && (
                <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-5">
                    <h3 className="text-sm font-bold text-yellow-400 mb-2">Concentration Warnings</h3>
                    <ul className="space-y-1">
                        {data.concentration.warnings.map((w, i) => (
                            <li key={i} className="text-sm text-gray-300"><i className="fas fa-exclamation-triangle text-yellow-500 mr-2 text-xs"></i>{w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

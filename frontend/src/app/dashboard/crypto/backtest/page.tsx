'use client';

import { useEffect, useState } from 'react';
import { cryptoAPI, CryptoBacktestResult } from '@/lib/api';

export default function CryptoBacktestPage() {
    const [data, setData] = useState<CryptoBacktestResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showTrades, setShowTrades] = useState(false);
    const [tradePage, setTradePage] = useState(0);
    const [sortField, setSortField] = useState<string>('entry_time');
    const [sortAsc, setSortAsc] = useState(false);
    const TRADES_PER_PAGE = 50;

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            // Load summary first (lighter), then full if user wants trades
            const res = await cryptoAPI.getBacktestSummary();
            setData(res);
        } catch (e: any) {
            setError(e.message || 'Failed to load backtest data');
        } finally {
            setLoading(false);
        }
    };

    const loadFullData = async () => {
        try {
            const res = await cryptoAPI.getBacktestResults();
            setData(res);
            setShowTrades(true);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const statCard = (label: string, value: string | number, color: string, sub?: string) => (
        <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Backtest Results...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <p className="text-yellow-400 text-sm mb-3">{error || 'No backtest data. Run VCP backtest first.'}</p>
                    <button onClick={loadData} className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20">Retry</button>
                </div>
            </div>
        );
    }

    const perf = data.performance;
    const config = data.config;
    const regimes = data.regime_breakdown;
    const trades = data.trades || [];

    // Sort trades
    const sortedTrades = [...trades].sort((a: any, b: any) => {
        const va = a[sortField];
        const vb = b[sortField];
        if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

    const pagedTrades = sortedTrades.slice(tradePage * TRADES_PER_PAGE, (tradePage + 1) * TRADES_PER_PAGE);
    const totalPages = Math.ceil(sortedTrades.length / TRADES_PER_PAGE);

    const handleSort = (field: string) => {
        if (sortField === field) setSortAsc(!sortAsc);
        else { setSortField(field); setSortAsc(false); }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">VCP Backtest</h1>
                    <p className="text-gray-500 text-sm mt-1">Historical Performance &middot; Regime Analysis &middot; Trade Log</p>
                </div>
                <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-colors">
                    <i className="fas fa-sync-alt mr-1"></i>Refresh
                </button>
            </div>

            {/* Performance Summary */}
            {perf && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    {statCard('Total Trades', perf.total_trades.toLocaleString(), 'text-white')}
                    {statCard('Win Rate', `${perf.win_rate.toFixed(1)}%`, perf.win_rate >= 40 ? 'text-emerald-400' : perf.win_rate >= 30 ? 'text-yellow-400' : 'text-red-400')}
                    {statCard('Profit Factor', perf.profit_factor.toFixed(2), perf.profit_factor >= 1 ? 'text-emerald-400' : 'text-red-400')}
                    {statCard('Sharpe Ratio', perf.sharpe_ratio.toFixed(2), perf.sharpe_ratio >= 0 ? 'text-emerald-400' : 'text-red-400')}
                    {statCard('Max Drawdown', `${perf.max_drawdown_pct.toFixed(1)}%`, 'text-red-400')}
                    {statCard('Total PnL', `$${perf.total_pnl_net.toLocaleString(undefined, { minimumFractionDigits: 0 })}`, perf.total_pnl_net >= 0 ? 'text-emerald-400' : 'text-red-400', `Fees: $${perf.total_fees.toLocaleString(undefined, { minimumFractionDigits: 0 })}`)}
                </div>
            )}

            {/* Additional Metrics */}
            {perf && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {statCard('Avg R-Multiple', perf.avg_r_multiple.toFixed(2), perf.avg_r_multiple >= 0 ? 'text-emerald-400' : 'text-red-400')}
                    {statCard('Max Consec. Losses', perf.max_consecutive_losses, 'text-orange-400')}
                    {data.trades_summary && statCard('Winners', data.trades_summary.winners, 'text-emerald-400', `Losers: ${data.trades_summary.losers}`)}
                    {data.trades_summary && statCard('Gross PnL', `$${data.trades_summary.gross_pnl.toLocaleString(undefined, { minimumFractionDigits: 0 })}`, data.trades_summary.gross_pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}
                </div>
            )}

            {/* Configuration */}
            {config && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">Backtest Configuration</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-gray-500">Entry Trigger:</span> <span className="text-white font-semibold ml-1">{config.entry_trigger}</span></div>
                        <div><span className="text-gray-500">Stop Loss:</span> <span className="text-white font-semibold ml-1">{config.stop_loss_type} ({config.stop_loss_value}%)</span></div>
                        <div><span className="text-gray-500">Take Profit:</span> <span className="text-white font-semibold ml-1">{config.take_profit_pct}%</span></div>
                        <div><span className="text-gray-500">Trailing Stop:</span> <span className="text-white font-semibold ml-1">{config.trailing_stop_pct}%</span></div>
                        <div><span className="text-gray-500">Commission:</span> <span className="text-white font-semibold ml-1">{config.commission_pct}%</span></div>
                        <div><span className="text-gray-500">Slippage:</span> <span className="text-white font-semibold ml-1">{config.slippage_pct}%</span></div>
                    </div>
                </div>
            )}

            {/* Regime Breakdown */}
            {regimes && Object.keys(regimes).length > 0 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">Performance by Market Regime</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(regimes).map(([regime, stats]) => {
                            const regColor = regime === 'BTC_UP' ? 'border-emerald-500/30' : regime === 'BTC_DOWN' ? 'border-red-500/30' : 'border-yellow-500/30';
                            const regBg = regime === 'BTC_UP' ? 'bg-emerald-500/5' : regime === 'BTC_DOWN' ? 'bg-red-500/5' : 'bg-yellow-500/5';
                            const regLabel = regime === 'BTC_UP' ? 'BTC Uptrend' : regime === 'BTC_DOWN' ? 'BTC Downtrend' : 'BTC Sideways';
                            return (
                                <div key={regime} className={`rounded-lg ${regBg} border ${regColor} p-4`}>
                                    <div className="text-xs text-gray-400 mb-2">{regLabel}</div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Trades</span>
                                            <span className="text-white font-bold">{stats.trades}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Win Rate</span>
                                            <span className={stats.win_rate >= 35 ? 'text-emerald-400' : 'text-yellow-400'}>{stats.win_rate.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Avg PnL</span>
                                            <span className={stats.avg_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>${stats.avg_pnl.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Trade History */}
            {!showTrades && trades.length === 0 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5 text-center">
                    <button onClick={loadFullData} className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold hover:bg-indigo-500/20 transition-colors">
                        <i className="fas fa-list mr-2"></i>Load Trade History ({perf?.total_trades.toLocaleString()} trades)
                    </button>
                    <p className="text-xs text-gray-500 mt-2">Large dataset - may take a moment</p>
                </div>
            )}

            {trades.length > 0 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-400">Trade History</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Page {tradePage + 1}/{totalPages}</span>
                            <button onClick={() => setTradePage(p => Math.max(0, p - 1))} disabled={tradePage === 0}
                                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30">Prev</button>
                            <button onClick={() => setTradePage(p => Math.min(totalPages - 1, p + 1))} disabled={tradePage >= totalPages - 1}
                                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30">Next</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-gray-700/50 text-gray-400 uppercase">
                                    {[
                                        ['symbol', 'Symbol'],
                                        ['entry_time', 'Date'],
                                        ['entry_type', 'Type'],
                                        ['entry_price', 'Entry'],
                                        ['exit_price', 'Exit'],
                                        ['exit_reason', 'Reason'],
                                        ['return_pct', 'Return %'],
                                        ['r_multiple', 'R-Mult'],
                                        ['score', 'Score'],
                                        ['market_regime', 'Regime'],
                                    ].map(([field, label]) => (
                                        <th key={field} className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => handleSort(field)}>
                                            {label} {sortField === field && (sortAsc ? '▲' : '▼')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pagedTrades.map((t: any, i: number) => (
                                    <tr key={i} className={`border-b border-gray-700/20 hover:bg-white/5 ${t.is_winner ? '' : 'opacity-80'}`}>
                                        <td className="px-2 py-1.5 font-bold text-white">{t.symbol}</td>
                                        <td className="px-2 py-1.5 text-gray-400">{new Date(t.entry_time).toLocaleDateString()}</td>
                                        <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.entry_type === 'BREAKOUT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>{t.entry_type}</span></td>
                                        <td className="px-2 py-1.5 text-right text-gray-300">${t.entry_price.toFixed(4)}</td>
                                        <td className="px-2 py-1.5 text-right text-gray-300">${t.exit_price.toFixed(4)}</td>
                                        <td className="px-2 py-1.5 text-center"><span className="text-[10px] text-gray-400">{t.exit_reason}</span></td>
                                        <td className={`px-2 py-1.5 text-right font-bold ${t.return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.return_pct >= 0 ? '+' : ''}{t.return_pct.toFixed(2)}%</td>
                                        <td className={`px-2 py-1.5 text-right ${t.r_multiple >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.r_multiple.toFixed(2)}</td>
                                        <td className="px-2 py-1.5 text-center text-yellow-400">{t.score}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                t.market_regime === 'BTC_UP' ? 'bg-emerald-500/20 text-emerald-400' :
                                                t.market_regime === 'BTC_DOWN' ? 'bg-red-500/20 text-red-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }`}>{t.market_regime}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

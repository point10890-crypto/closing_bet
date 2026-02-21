'use client';

import { useEffect, useState } from 'react';
import { usAPI, RiskAlertData, BacktestData } from '@/lib/api';
import HelpButton from '@/components/ui/HelpButton';

export default function RiskDashboard() {
    const [loading, setLoading] = useState(true);
    const [riskData, setRiskData] = useState<RiskAlertData | null>(null);
    const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
    const [sortKey, setSortKey] = useState<'current_dd' | 'max_dd' | 'from_peak_days'>('current_dd');
    const [sortAsc, setSortAsc] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [risk, backtest] = await Promise.all([
                usAPI.getRiskAlerts().catch(() => null),
                usAPI.getBacktest().catch(() => null),
            ]);
            setRiskData(risk);
            setBacktestData(backtest);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (level: string) => {
        if (level === 'Low') return 'text-green-400 bg-green-500/10 border-green-500/20';
        if (level === 'High' || level === 'Critical') return 'text-red-400 bg-red-500/10 border-red-500/20';
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    };

    const getDDColor = (dd: number) => {
        if (dd >= 0) return 'text-green-400';
        if (dd > -5) return 'text-yellow-400';
        if (dd > -10) return 'text-orange-400';
        return 'text-red-400';
    };

    const getSeverityStyle = (severity: string) => {
        if (severity === 'critical') return 'border-red-500/30 bg-red-500/5';
        if (severity === 'warning') return 'border-yellow-500/30 bg-yellow-500/5';
        return 'border-blue-500/30 bg-blue-500/5';
    };

    const drawdowns = riskData?.drawdowns
        ? Object.entries(riskData.drawdowns)
            .map(([ticker, d]) => ({ ticker, ...d }))
            .sort((a, b) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];
                return sortAsc ? aVal - bVal : bVal - aVal;
            })
        : [];

    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(true); }
    };

    const summary = riskData?.portfolio_summary;
    const varDetails = (summary as Record<string, unknown>)?.var_details as { var_pct?: number; cvar_pct?: number; confidence?: number; horizon_days?: number } | undefined;

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/5 text-xs text-orange-400 font-medium mb-4">
                    <i className="fas fa-shield-alt"></i>
                    Risk Management
                </div>
                <div className="flex items-center gap-3">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                        Risk <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">Dashboard</span>
                    </h2>
                    <HelpButton title="Risk Dashboard 가이드" sections={[
                        { heading: '주요 지표', body: '• VaR (95%, 5일): 95% 확률로 5거래일 내 예상되는 최대 손실률. 예: -3.2%이면 100만원 투자 시 최대 3.2만원 손실 예상\n• CVaR (95%, 5일): VaR를 초과하는 극단적 손실의 평균. VaR보다 항상 크며, 꼬리 위험(tail risk)을 측정\n• Risk Level: Low/Moderate/High/Critical — VaR 크기에 따른 종합 판단' },
                        { heading: 'Drawdown 해석', body: '• Current DD: 현재 가격이 최근 고점 대비 얼마나 하락했는지 (%)\n• Max DD: 추적 기간 중 최대 하락폭\n• From Peak Days: 고점으로부터 경과일수 — 길수록 회복이 느린 것\n\n-10% 이상 하락 종목은 손절 검토, -20% 이상은 즉시 점검 필요' },
                        { heading: '집중도 위험', body: '특정 섹터에 포트폴리오가 집중되면 상관관계로 인해 동반 하락 위험이 커집니다. High Correlation Pairs는 함께 움직이는 종목 쌍으로, 분산 효과가 제한적임을 나타냅니다.' },
                    ]} />
                </div>
                <p className="text-gray-400 text-lg">VaR/CVaR, 드로다운 추적, 포트폴리오 리스크 분석</p>
            </div>

            {/* Risk Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* VaR Card */}
                <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Value at Risk (5D, 95%)</div>
                    <div className="text-3xl font-black text-orange-400">
                        ${Math.abs(summary?.portfolio_var_95_5d ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    {varDetails && (
                        <div className="text-xs text-gray-500 mt-1">{varDetails.var_pct?.toFixed(2)}% of portfolio</div>
                    )}
                    <div className="mt-3 text-[10px] text-gray-600">
                        {varDetails?.confidence ? `${(varDetails.confidence * 100).toFixed(0)}% confidence` : ''} | {varDetails?.horizon_days ?? 5}-day horizon
                    </div>
                </div>

                {/* CVaR Card */}
                <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Conditional VaR (CVaR)</div>
                    <div className="text-3xl font-black text-red-400">
                        ${Math.abs(summary?.portfolio_cvar_95_5d ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    {varDetails && (
                        <div className="text-xs text-gray-500 mt-1">{(varDetails as Record<string, number>).cvar_pct?.toFixed(2)}% of portfolio</div>
                    )}
                    <div className="mt-3 text-[10px] text-gray-600">Expected loss beyond VaR threshold</div>
                </div>

                {/* Risk Level Card */}
                <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Portfolio Risk Level</div>
                    <div className="flex items-center gap-3 mt-2">
                        <span className={`text-3xl font-black px-4 py-1 rounded-xl border ${getRiskColor(summary?.risk_level ?? 'Moderate')}`}>
                            {summary?.risk_level ?? 'N/A'}
                        </span>
                    </div>
                    <div className="mt-3 text-[10px] text-gray-600">{summary?.total_picks ?? 0} positions tracked</div>
                </div>
            </div>

            {/* Drawdown Table */}
            <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                    <i className="fas fa-chart-bar text-orange-500"></i>
                    Position Drawdowns
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-2 px-3 text-gray-500 font-medium">Ticker</th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium">Current</th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium">Peak</th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('current_dd')}>
                                    Current DD {sortKey === 'current_dd' ? (sortAsc ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('max_dd')}>
                                    Max DD {sortKey === 'max_dd' ? (sortAsc ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('from_peak_days')}>
                                    Days {sortKey === 'from_peak_days' ? (sortAsc ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-right py-2 px-3 text-gray-500 font-medium w-32">Severity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {drawdowns.map((d) => (
                                <tr key={d.ticker} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="py-2 px-3 font-bold text-white">{d.ticker}</td>
                                    <td className="py-2 px-3 text-right text-gray-300">${(d.current_price ?? 0).toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right text-gray-500">${(d.peak_price ?? 0).toFixed(2)}</td>
                                    <td className={`py-2 px-3 text-right font-bold ${getDDColor(d.current_dd ?? 0)}`}>
                                        {(d.current_dd ?? 0).toFixed(2)}%
                                    </td>
                                    <td className={`py-2 px-3 text-right font-bold ${getDDColor(d.max_dd ?? 0)}`}>
                                        {(d.max_dd ?? 0).toFixed(2)}%
                                    </td>
                                    <td className="py-2 px-3 text-right text-gray-400">{d.from_peak_days ?? 0}d</td>
                                    <td className="py-2 px-3 text-right">
                                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${d.current_dd > -2 ? 'bg-green-500' : d.current_dd > -5 ? 'bg-yellow-500' : d.current_dd > -10 ? 'bg-orange-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.min(Math.abs(d.current_dd) * 5, 100)}%` }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Alerts */}
            {riskData?.alerts && riskData.alerts.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                        <i className="fas fa-bell text-yellow-500"></i>
                        Active Alerts
                    </h3>
                    {riskData.alerts.map((alert, i) => (
                        <div key={i} className={`p-4 rounded-xl border ${getSeverityStyle(alert.severity)}`}>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' : alert.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {alert.severity}
                                </span>
                                <span className="text-xs text-gray-500 uppercase">{alert.alert_type}</span>
                                {alert.ticker && <span className="text-xs font-bold text-white">{alert.ticker}</span>}
                            </div>
                            <p className="text-sm text-gray-300 mt-2">{alert.message}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Concentration */}
            {riskData?.concentration && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                        <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                            <i className="fas fa-chart-pie text-teal-500"></i>
                            Sector Concentration
                        </h3>
                        {Object.entries(riskData.concentration.sector_concentration ?? {}).map(([sector, data]) => {
                            const d = data as { count: number; weight_pct: number };
                            return (
                                <div key={sector} className="flex items-center gap-3 mb-2">
                                    <span className="text-xs text-gray-400 w-24 truncate">{sector}</span>
                                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${d.weight_pct}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-500 w-16 text-right">{(d.weight_pct ?? 0).toFixed(1)}%</span>
                                    <span className="text-xs text-gray-600 w-8 text-right">{d.count}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                        <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                            <i className="fas fa-link text-purple-500"></i>
                            High Correlation Pairs
                        </h3>
                        {(riskData.concentration.high_correlation_pairs ?? []).length === 0 ? (
                            <p className="text-sm text-gray-500">No high correlation pairs detected.</p>
                        ) : (
                            (riskData.concentration.high_correlation_pairs as Array<{ pair: string[]; correlation: number }>).map((p, i) => (
                                <div key={i} className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-white/5">
                                    <span className="text-sm font-bold text-white">{p.pair[0]}</span>
                                    <span className="text-xs text-gray-500">↔</span>
                                    <span className="text-sm font-bold text-white">{p.pair[1]}</span>
                                    <span className="ml-auto text-sm font-bold text-purple-400">{p.correlation.toFixed(2)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Backtest Results */}
            {backtestData?.returns && (
                <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-emerald-500/20">
                    <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                        <i className="fas fa-flask text-emerald-500"></i>
                        Backtest Results
                        <span className="text-[10px] text-gray-600 font-normal">
                            {backtestData.period?.start ?? '--'} ~ {backtestData.period?.end ?? '--'} ({backtestData.period?.trading_days ?? 0} days)
                        </span>
                    </h3>

                    {/* Hero Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                            <div className="text-xs text-gray-500 mb-1">Total Return</div>
                            <div className="text-2xl font-black text-emerald-400">+{backtestData.returns?.total_return?.toFixed(1) ?? '--'}%</div>
                        </div>
                        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                            <div className="text-xs text-gray-500 mb-1">Alpha vs SPY</div>
                            <div className="text-2xl font-black text-blue-400">+{backtestData.benchmarks?.SPY?.alpha?.toFixed(1) ?? '--'}%</div>
                        </div>
                        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                            <div className="text-xs text-gray-500 mb-1">Sharpe Ratio</div>
                            <div className="text-2xl font-black text-purple-400">{backtestData.returns?.sharpe_ratio?.toFixed(1) ?? '--'}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                            <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                            <div className="text-2xl font-black text-yellow-400">{backtestData.returns?.win_rate?.toFixed(1) ?? '--'}%</div>
                        </div>
                    </div>

                    {/* Detail Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="text-[10px] text-gray-500">Annualized</div>
                            <div className="text-sm font-bold text-emerald-400">+{backtestData.returns?.annualized_return?.toFixed(1) ?? '--'}%</div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="text-[10px] text-gray-500">Volatility</div>
                            <div className="text-sm font-bold text-gray-300">{backtestData.returns?.volatility?.toFixed(1) ?? '--'}%</div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="text-[10px] text-gray-500">Max Drawdown</div>
                            <div className="text-sm font-bold text-red-400">{backtestData.returns?.max_drawdown?.toFixed(2) ?? '--'}%</div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="text-[10px] text-gray-500">Best Day</div>
                            <div className="text-sm font-bold text-green-400">+{backtestData.returns?.best_day?.toFixed(2) ?? '--'}%</div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="text-[10px] text-gray-500">Worst Day</div>
                            <div className="text-sm font-bold text-red-400">{backtestData.returns?.worst_day?.toFixed(2) ?? '--'}%</div>
                        </div>
                    </div>

                    {/* Portfolio */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="text-xs text-gray-500">Portfolio:</span>
                        {(backtestData.portfolio?.stocks ?? []).map(ticker => (
                            <span key={ticker} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 font-mono">
                                {ticker}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    usAPI, SmartMoneyStock, USMarketGate, CumulativePerformanceSummary,
    MacroAnalysisResponse, PortfolioIndex, DecisionSignalData,
    MarketRegimeData, IndexPredictionData, RiskAlertData, SectorRotationData,
    BacktestData, TopPicksReportData
} from '@/lib/api';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import ErrorBanner from '@/components/ui/ErrorBanner';
import HelpButton from '@/components/ui/HelpButton';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

// lightweight-charts는 window/DOM 필수 → SSR 비활성화
const StockDetailModal = dynamic(() => import('@/components/us/StockDetailModal'), { ssr: false });

export default function USMarketDashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [indices, setIndices] = useState<PortfolioIndex[]>([]);
    const [smartMoney, setSmartMoney] = useState<SmartMoneyStock[]>([]);
    const [macroData, setMacroData] = useState<MacroAnalysisResponse | null>(null);
    const [gateData, setGateData] = useState<USMarketGate | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [perfData, setPerfData] = useState<CumulativePerformanceSummary | null>(null);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [decisionSignal, setDecisionSignal] = useState<DecisionSignalData | null>(null);
    const [regimeData, setRegimeData] = useState<MarketRegimeData | null>(null);
    const [predictionData, setPredictionData] = useState<IndexPredictionData | null>(null);
    const [riskData, setRiskData] = useState<RiskAlertData | null>(null);
    const [sectorData, setSectorData] = useState<SectorRotationData | null>(null);
    const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
    const [topPicksData, setTopPicksData] = useState<TopPicksReportData | null>(null);

    const fetchAllData = useCallback(async (silent = false) => {
        if (!silent) { setLoading(true); setError(null); }
        try {
            const [portfolioRes, smartMoneyRes, macroRes, gateRes, perfRes, dsRes, regimeRes, predRes, riskRes, sectorRes, btRes, tpRes] = await Promise.all([
                usAPI.getPortfolio().catch(() => null),
                usAPI.getSmartMoney().catch(() => null),
                usAPI.getMacroAnalysis().catch(() => null),
                usAPI.getMarketGate().catch(() => null),
                usAPI.getCumulativePerformance().catch(() => null),
                usAPI.getDecisionSignal().catch(() => null),
                usAPI.getMarketRegime().catch(() => null),
                usAPI.getIndexPrediction().catch(() => null),
                usAPI.getRiskAlerts().catch(() => null),
                usAPI.getSectorRotation().catch(() => null),
                usAPI.getBacktest().catch(() => null),
                usAPI.getTopPicksReport().catch(() => null),
            ]);

            if (!portfolioRes && !smartMoneyRes) {
                if (!silent) setError('Failed to load market data. Check server connection.');
            }

            setIndices(portfolioRes?.market_indices ?? []);
            setSmartMoney(smartMoneyRes?.picks ?? []);
            setMacroData(macroRes);
            setGateData(gateRes);
            if (perfRes?.summary) setPerfData(perfRes.summary);
            setDecisionSignal(dsRes);
            setRegimeData(regimeRes);
            setPredictionData(predRes);
            setRiskData(riskRes);
            setSectorData(sectorRes);
            setBacktestData(btRes);
            setTopPicksData(tpRes);
            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
            console.error('Failed to load US Market data:', err);
            if (!silent) setError('Failed to load market data.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    const loadData = useCallback(() => fetchAllData(false), [fetchAllData]);
    const silentRefresh = useCallback(() => fetchAllData(true), [fetchAllData]);

    useEffect(() => { loadData(); }, [loadData]);
    useAutoRefresh(silentRefresh, 60000);

    const getGateColor = (score: number) => {
        if (score >= 70) return 'text-green-500';
        if (score >= 40) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getChangeColor = (change: number) => {
        if (change > 0) return 'text-green-400';
        if (change < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    const getActionGradient = (action: string) => {
        switch (action) {
            case 'STRONG_BUY': return 'from-emerald-600/20 to-green-600/10 border-emerald-500/30';
            case 'BUY': return 'from-green-600/15 to-emerald-600/5 border-green-500/25';
            case 'NEUTRAL': return 'from-yellow-600/15 to-amber-600/5 border-yellow-500/25';
            case 'CAUTIOUS': return 'from-orange-600/15 to-red-600/5 border-orange-500/25';
            case 'DEFENSIVE': return 'from-red-600/20 to-rose-600/10 border-red-500/30';
            default: return 'from-gray-600/15 to-gray-600/5 border-gray-500/25';
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'STRONG_BUY': return 'text-emerald-400';
            case 'BUY': return 'text-green-400';
            case 'NEUTRAL': return 'text-yellow-400';
            case 'CAUTIOUS': return 'text-orange-400';
            case 'DEFENSIVE': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'STRONG_BUY': return 'STRONG BUY';
            case 'BUY': return 'BUY';
            case 'NEUTRAL': return 'NEUTRAL';
            case 'CAUTIOUS': return 'CAUTIOUS';
            case 'DEFENSIVE': return 'DEFENSIVE';
            default: return action;
        }
    };

    const getTimingColor = (timing: string) => {
        if (timing === 'NOW') return 'bg-green-500/20 text-green-400 border-green-500/30';
        if (timing === 'WAIT') return 'bg-red-500/20 text-red-400 border-red-500/30';
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    };

    const spyPred = predictionData?.predictions?.spy ?? predictionData?.predictions?.SPY;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-xs text-blue-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                    Investment Decision Center
                </div>
                <div className="flex items-center gap-3">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                        One-Stop <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Dashboard</span>
                    </h2>
                    <HelpButton title="US Overview 가이드" sections={[
                        { heading: '작동 원리', body: 'Decision Signal은 5개 데이터 소스를 종합하여 0~100점의 투자 신호를 생성합니다.\n\n기본 점수 50에서 시작하여:\n• Market Gate (±15): RSI, VIX, 추세 기반 시장 진입 가능 여부\n• Regime (±15): VIX+추세+breadth+yield 기반 시장 국면\n• ML Prediction (±10): GradientBoosting 모델의 방향 예측\n• Risk Level (±10): VaR/CVaR 기반 포트폴리오 위험도\n• Sector Phase (±10): 업종 순환 사이클 위치' },
                        { heading: '점수 해석', body: '• 75~100 STRONG BUY: 모든 신호 긍정적, 적극 매수 구간\n• 60~74 BUY: 대부분 긍정적, 선별적 매수\n• 40~59 NEUTRAL: 혼조 신호, 관망 또는 포지션 유지\n• 25~39 CAUTIOUS: 부정적 신호 우세, 신규 매수 자제\n• 0~24 DEFENSIVE: 강한 하락 신호, 방어적 포지션' },
                        { heading: '활용 팁', body: 'Top 5 AI Picks는 퀀트 점수 + AI 분석 보너스를 합산한 종합 순위입니다. Quick Signal Grid의 4개 카드를 클릭하면 각 상세 분석 페이지로 이동합니다. Backtest Proof에서 과거 성과를 확인하되, 과거 수익률이 미래를 보장하지 않습니다.' },
                    ]} />
                </div>
                <p className="text-gray-400 text-lg">종합 투자 신호 & 추천 종목 & 리스크 관리</p>
            </div>

            {/* Error Banner */}
            {error && <ErrorBanner message={error} onRetry={loadData} />}

            {/* Decision Signal Hero */}
            {decisionSignal && !loading && (
                <div className={`p-6 rounded-2xl bg-gradient-to-r ${getActionGradient(decisionSignal.action)} border relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-48 h-48 opacity-5">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" className="text-white" />
                            <path d="M50 10 L50 50 L80 50" fill="none" stroke="currentColor" strokeWidth="2" className="text-white" />
                        </svg>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        {/* Action + Score */}
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <div className={`text-4xl font-black ${getActionColor(decisionSignal.action)}`}>
                                    {getActionLabel(decisionSignal.action)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Investment Signal</div>
                            </div>
                            <div className="relative w-20 h-20">
                                <svg className="w-full h-full -rotate-90">
                                    <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                                    <circle
                                        cx="40" cy="40" r="35"
                                        stroke="currentColor" strokeWidth="6" fill="transparent"
                                        strokeDasharray="220"
                                        strokeDashoffset={220 - (220 * (decisionSignal.score || 0) / 100)}
                                        className={`${getActionColor(decisionSignal.action)} transition-all duration-1000`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`text-xl font-black ${getActionColor(decisionSignal.action)}`}>{decisionSignal.score}</span>
                                </div>
                            </div>
                        </div>

                        {/* Component Pills */}
                        <div className="flex-1 flex flex-wrap gap-2">
                            {[
                                { label: 'Gate', value: `${decisionSignal.components?.market_gate?.score ?? '--'}`, contrib: decisionSignal.components?.market_gate?.contribution ?? 0 },
                                { label: 'Regime', value: (decisionSignal.components?.regime?.regime ?? 'N/A').replace('_', ' '), contrib: decisionSignal.components?.regime?.contribution ?? 0 },
                                { label: 'ML Pred', value: `${decisionSignal.components?.prediction?.spy_bullish?.toFixed(0) ?? '--'}%`, contrib: decisionSignal.components?.prediction?.contribution ?? 0 },
                                { label: 'Risk', value: decisionSignal.components?.risk?.level ?? 'N/A', contrib: decisionSignal.components?.risk?.contribution ?? 0 },
                                { label: 'Sector', value: decisionSignal.components?.sector_phase?.phase ?? 'N/A', contrib: decisionSignal.components?.sector_phase?.contribution ?? 0 },
                            ].map(comp => (
                                <div key={comp.label} className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10">
                                    <div className="text-[10px] text-gray-500">{comp.label}</div>
                                    <div className="text-xs font-bold text-white">{comp.value}</div>
                                    <div className={`text-[10px] font-bold ${(comp.contrib ?? 0) > 0 ? 'text-green-400' : (comp.contrib ?? 0) < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                        {(comp.contrib ?? 0) > 0 ? '+' : ''}{(comp.contrib ?? 0).toFixed(1)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Timing */}
                        <div className="flex flex-col items-center gap-2">
                            <span className={`px-4 py-1.5 rounded-full text-sm font-black border ${getTimingColor(decisionSignal.timing)}`}>
                                {decisionSignal.timing}
                            </span>
                            <span className="text-[10px] text-gray-500">Timing</span>
                        </div>
                    </div>

                    {/* Warnings */}
                    {(decisionSignal.warnings?.length ?? 0) > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                            {(decisionSignal.warnings ?? []).map((w, i) => (
                                <span key={i} className="text-xs text-yellow-400/80 bg-yellow-500/10 px-2 py-0.5 rounded">
                                    <i className="fas fa-exclamation-triangle mr-1"></i>{w}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Market Gate + Indices */}
            <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Gate Score */}
                <div className="lg:col-span-1 p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-blue-500">
                        <i className="fas fa-flag-usa text-4xl"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                        US Market Gate
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    </h3>
                    <div className="flex flex-col items-center justify-center py-2">
                        <div className="relative w-28 h-28 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                                <circle
                                    cx="56" cy="56" r="50"
                                    stroke="currentColor" strokeWidth="8" fill="transparent"
                                    strokeDasharray="314"
                                    strokeDashoffset={314 - (314 * (gateData?.score ?? 0) / 100)}
                                    className={`${getGateColor(gateData?.score ?? 0)} transition-all duration-1000 ease-out`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-2xl font-black ${getGateColor(gateData?.score ?? 0)}`}>
                                    {loading ? '--' : gateData?.score ?? '--'}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Score</span>
                            </div>
                        </div>
                        <div className={`mt-3 px-3 py-1 rounded-full text-xs font-bold border ${gateData?.gate === 'GREEN' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                gateData?.gate === 'RED' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}>
                            {loading ? 'Analyzing...' : gateData?.gate ?? gateData?.label ?? 'N/A'}
                        </div>
                        {gateData?.metrics && (
                            <div className="mt-2 text-[10px] text-gray-500 text-center">
                                RSI: {gateData.metrics.rsi?.toFixed(1) ?? '--'} | VIX: {gateData.metrics.vix?.toFixed(1) ?? '--'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Market Indices Grid */}
                <div className="lg:col-span-4 p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-400">Major Indices</h3>
                        <button onClick={loadData} disabled={loading} className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                            <i className={`fas fa-sync-alt mr-1 ${loading ? 'animate-spin' : ''}`}></i>
                            Refresh
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse border border-white/5"></div>
                            ))
                        ) : (
                            indices.slice(0, 8).map((idx) => (
                                <div key={idx.name} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{idx.name}</div>
                                    <div className="text-lg font-black text-white mt-1">{idx.price}</div>
                                    <div className={`text-xs font-bold ${(idx.change_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        <i className={`fas fa-caret-${(idx.change_pct ?? 0) >= 0 ? 'up' : 'down'} mr-0.5`}></i>
                                        {(idx.change_pct ?? 0) >= 0 ? '+' : ''}{(idx.change_pct ?? 0).toFixed(2)}%
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Quick Signal Grid */}
            {!loading && (
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Regime */}
                    <Link href="/dashboard/us/regime" className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-cyan-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Market Regime</span>
                            <i className="fas fa-arrow-right text-gray-600 group-hover:text-cyan-400 transition-colors text-xs"></i>
                        </div>
                        <div className={`text-lg font-black ${regimeData?.regime === 'risk_on' ? 'text-green-400' : regimeData?.regime === 'risk_off' ? 'text-red-400' : regimeData?.regime === 'crisis' ? 'text-red-500' : 'text-yellow-400'}`}>
                            {regimeData?.regime?.replace('_', ' ').toUpperCase() ?? 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">Confidence: {regimeData?.confidence?.toFixed(0) ?? '--'}%</div>
                    </Link>

                    {/* ML Prediction */}
                    <Link href="/dashboard/us/prediction" className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-red-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">SPY Prediction</span>
                            <i className="fas fa-arrow-right text-gray-600 group-hover:text-red-400 transition-colors text-xs"></i>
                        </div>
                        <div className={`text-lg font-black ${(spyPred?.bullish_probability ?? 50) >= 60 ? 'text-green-400' : (spyPred?.bullish_probability ?? 50) <= 40 ? 'text-red-400' : 'text-yellow-400'}`}>
                            {spyPred?.bullish_probability?.toFixed(1) ?? '--'}% Bullish
                        </div>
                        <div className="text-xs text-gray-500">Expected: {spyPred?.predicted_return_pct ? `${spyPred.predicted_return_pct > 0 ? '+' : ''}${spyPred.predicted_return_pct.toFixed(2)}%` : '--'}</div>
                    </Link>

                    {/* Sector Phase */}
                    <Link href="/dashboard/us/sector-rotation" className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-teal-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Business Cycle</span>
                            <i className="fas fa-arrow-right text-gray-600 group-hover:text-teal-400 transition-colors text-xs"></i>
                        </div>
                        <div className="text-lg font-black text-teal-400">
                            {sectorData?.rotation_signals?.current_phase ?? 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                            Leading: {sectorData?.rotation_signals?.leading_sectors?.slice(0, 2).join(', ') ?? '--'}
                        </div>
                    </Link>

                    {/* Risk Level */}
                    <Link href="/dashboard/us/risk" className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-orange-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Portfolio Risk</span>
                            <i className="fas fa-arrow-right text-gray-600 group-hover:text-orange-400 transition-colors text-xs"></i>
                        </div>
                        <div className={`text-lg font-black ${riskData?.portfolio_summary?.risk_level === 'Low' ? 'text-green-400' : riskData?.portfolio_summary?.risk_level === 'High' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {riskData?.portfolio_summary?.risk_level ?? 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                            VaR: ${Math.abs(riskData?.portfolio_summary?.portfolio_var_95_5d ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </Link>
                </section>
            )}

            {/* Performance Banner */}
            {perfData && perfData.total_picks > 0 && (
                <Link href="/dashboard/us/cumulative-performance" className="block group">
                    <div className="p-4 rounded-2xl bg-[#1c1c1e] border border-indigo-500/20 hover:border-indigo-500/40 transition-all relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-blue-500" />
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <i className="fas fa-chart-line text-indigo-400"></i>
                                Track Record
                            </h3>
                            <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors font-medium">
                                View All <i className="fas fa-arrow-right ml-1"></i>
                            </span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap text-sm mb-3">
                            <span className="text-white font-bold">{perfData.total_picks} <span className="text-gray-500 font-normal text-xs">picks</span></span>
                            <span className={`font-bold ${perfData.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {perfData.win_rate}% <span className="text-gray-500 font-normal text-xs">win rate</span>
                            </span>
                            <span className={`font-bold ${perfData.avg_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {perfData.avg_return > 0 ? '+' : ''}{perfData.avg_return}% <span className="text-gray-500 font-normal text-xs">avg return</span>
                            </span>
                            <span className={`font-bold ${perfData.avg_alpha >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                {perfData.avg_alpha > 0 ? '+' : ''}{perfData.avg_alpha}% <span className="text-gray-500 font-normal text-xs">alpha vs SPY</span>
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000"
                                style={{ width: `${Math.min(perfData.win_rate, 100)}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">{perfData.win_rate}% win rate across {perfData.num_snapshots} snapshots</div>
                    </div>
                </Link>
            )}

            {/* Top 5 AI Picks */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span className="w-1 h-5 bg-indigo-500 rounded-full"></span>
                        AI Top Picks
                    </h3>
                    <Link href="/dashboard/us/top-picks" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                        View Full Report <i className="fas fa-arrow-right ml-1"></i>
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-36 rounded-2xl bg-[#1c1c1e] border border-white/10 animate-pulse"></div>
                        ))
                    ) : (topPicksData?.top_picks ?? []).length === 0 ? (
                        smartMoney.slice(0, 5).map((stock, idx) => (
                            <div
                                key={stock.ticker}
                                onClick={() => setSelectedTicker(stock.ticker)}
                                className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-blue-500/30 transition-all group cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="text-xs text-gray-500 font-mono">#{idx + 1}</div>
                                        <div className="text-lg font-black text-white group-hover:text-blue-400 transition-colors">{stock.ticker}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-white">${stock.price?.toFixed(2) ?? '--'}</div>
                                        <div className={`text-xs font-bold ${getChangeColor(stock.change_pct ?? 0)}`}>
                                            {(stock.change_pct ?? 0) >= 0 ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 truncate">{stock.name}</div>
                                <div className="mt-2 flex gap-1">
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-bold">
                                        {stock.composite_score?.toFixed(1) ?? '--'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 font-bold">
                                        {stock.grade || 'N/A'}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        (topPicksData?.top_picks ?? []).slice(0, 5).map((pick) => (
                            <div
                                key={pick.ticker}
                                onClick={() => setSelectedTicker(pick.ticker)}
                                className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-indigo-500/30 transition-all group cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="text-xs text-indigo-400 font-mono font-bold">#{pick.rank}</div>
                                        <div className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors">{pick.ticker}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-white">${(pick.current_price ?? 0).toFixed(2)}</div>
                                        <div className={`text-xs font-bold ${(pick.target_upside ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(pick.target_upside ?? 0) > 0 ? '+' : ''}{(pick.target_upside ?? 0).toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 truncate mb-2">{pick.name}</div>
                                <div className="flex gap-1 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-bold">
                                        {(pick.final_score ?? 0).toFixed(1)}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(pick.ai_recommendation ?? '').includes('매수') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                                        {pick.ai_recommendation ?? '-'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Backtest Proof Banner */}
            {backtestData?.returns && (
                <Link href="/dashboard/us/risk" className="block group">
                    <div className="p-4 rounded-2xl bg-[#1c1c1e] border border-emerald-500/20 hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <i className="fas fa-flask text-emerald-400"></i>
                                Backtest Performance
                            </h3>
                            <span className="text-xs text-emerald-400 group-hover:text-emerald-300 transition-colors font-medium">
                                View Details <i className="fas fa-arrow-right ml-1"></i>
                            </span>
                        </div>
                        <div className="flex items-center gap-6 flex-wrap text-sm">
                            <span className="text-emerald-400 font-black">+{backtestData.returns?.total_return?.toFixed(1) ?? '--'}% <span className="text-gray-500 font-normal text-xs">return</span></span>
                            <span className="text-blue-400 font-black">+{backtestData.benchmarks?.SPY?.alpha?.toFixed(1) ?? '--'}% <span className="text-gray-500 font-normal text-xs">alpha vs SPY</span></span>
                            <span className="text-purple-400 font-black">{backtestData.returns?.sharpe_ratio?.toFixed(1) ?? '--'} <span className="text-gray-500 font-normal text-xs">sharpe</span></span>
                            <span className="text-yellow-400 font-black">{backtestData.returns?.win_rate?.toFixed(1) ?? '--'}% <span className="text-gray-500 font-normal text-xs">win rate</span></span>
                            <span className="text-red-400 font-bold">{backtestData.returns?.max_drawdown?.toFixed(1) ?? '--'}% <span className="text-gray-500 font-normal text-xs">max DD</span></span>
                        </div>
                    </div>
                </Link>
            )}

            {/* Macro Analysis */}
            {macroData?.ai_analysis && (
                <section className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                        <i className="fas fa-robot text-blue-500"></i>
                        AI Macro Analysis
                    </h3>
                    <div className="macro-analysis text-sm leading-relaxed">
                        <ReactMarkdown
                            components={{
                                h2: ({ children }) => (
                                    <h2 className="text-base font-black text-white mt-0 mb-3 pb-2 border-b border-white/10">{children}</h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className="text-sm font-bold text-indigo-400 mt-5 mb-2">{children}</h3>
                                ),
                                p: ({ children }) => (
                                    <p className="text-gray-400 leading-relaxed my-2">{children}</p>
                                ),
                                strong: ({ children }) => (
                                    <strong className="text-white font-bold">{children}</strong>
                                ),
                                em: ({ children }) => (
                                    <em className="text-gray-300 not-italic">{children}</em>
                                ),
                                ul: ({ children }) => (
                                    <ul className="my-2 space-y-1.5">{children}</ul>
                                ),
                                li: ({ children }) => (
                                    <li className="text-gray-400 flex gap-2 items-start">
                                        <span className="w-1 h-1 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                        <span>{children}</span>
                                    </li>
                                ),
                                hr: () => <hr className="border-white/10 my-4" />,
                            }}
                        >
                            {macroData.ai_analysis}
                        </ReactMarkdown>
                    </div>
                </section>
            )}

            {/* Quick Links */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    { href: '/dashboard/us/heatmap', icon: 'fa-th', color: 'emerald', title: 'Sector Heatmap', desc: 'S&P 500 섹터별 주가 변동' },
                    { href: '/dashboard/us/calendar', icon: 'fa-calendar-alt', color: 'teal', title: 'Economic Calendar', desc: '주요 경제 지표 발표 일정' },
                    { href: '/dashboard/us/earnings', icon: 'fa-chart-column', color: 'pink', title: 'Earnings Strategy', desc: '섹터별 실적 반응 프로파일' },
                    { href: '/dashboard/us/risk', icon: 'fa-shield-alt', color: 'orange', title: 'Risk Dashboard', desc: 'VaR/CVaR, 드로다운, 리스크 알림' },
                    { href: '/dashboard/us/top-picks', icon: 'fa-robot', color: 'indigo', title: 'Top Picks Report', desc: 'AI 종합 분석 Top 10 리포트' },
                    { href: '/dashboard/us/briefing', icon: 'fa-newspaper', color: 'amber', title: 'Market Briefing', desc: 'AI 기반 시황 & 섹터 분석' },
                ].map(link => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`p-5 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-${link.color}-500/30 transition-all group`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className={`text-sm font-bold text-white group-hover:text-${link.color}-400 transition-colors flex items-center gap-2`}>
                                    <i className={`fas ${link.icon} text-${link.color}-500`}></i>
                                    {link.title}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">{link.desc}</div>
                            </div>
                            <i className={`fas fa-arrow-right text-gray-600 group-hover:text-${link.color}-400 transition-colors`}></i>
                        </div>
                    </Link>
                ))}
            </section>

            {/* Footer */}
            <div className="text-center text-xs text-gray-600">
                Last updated: {lastUpdated || '--'}
            </div>

            {/* Stock Detail Modal */}
            {selectedTicker && (
                <StockDetailModal
                    ticker={selectedTicker}
                    onClose={() => setSelectedTicker(null)}
                />
            )}
        </div>
    );
}

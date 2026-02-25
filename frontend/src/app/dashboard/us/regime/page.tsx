'use client';

import { useEffect, useState } from 'react';
import { usAPI, MarketRegimeData } from '@/lib/api';
import ErrorBanner from '@/components/ui/ErrorBanner';
import HelpButton from '@/components/ui/HelpButton';

const REGIME_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
    risk_on:  { label: 'Risk-On',  color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30', icon: 'fa-rocket' },
    neutral:  { label: 'Neutral',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: 'fa-equals' },
    risk_off: { label: 'Risk-Off', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'fa-shield-halved' },
    crisis:   { label: 'Crisis',   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: 'fa-triangle-exclamation' },
};

const SIGNAL_NAMES: Record<string, string> = {
    vix: 'VIX',
    trend: 'SPY Trend',
    breadth: 'Market Breadth',
    yield_curve: 'Yield Curve',
};

export default function RegimePage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<MarketRegimeData | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await usAPI.getMarketRegime();
            setData(res);
        } catch {
            setError('Failed to load regime data.');
        } finally {
            setLoading(false);
        }
    };

    const cfg = data ? REGIME_CONFIG[data.regime] || REGIME_CONFIG.neutral : REGIME_CONFIG.neutral;

    const getSignalRegime = (sig: { [key: string]: unknown }): string => {
        const keys = Object.keys(sig);
        const regimeKey = keys.find(k => k.endsWith('_regime'));
        return regimeKey ? String(sig[regimeKey]) : 'neutral';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-xs text-cyan-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></span>
                    Adaptive Engine
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                                Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Regime</span>
                            </h2>
                            <HelpButton title="Market Regime 가이드" sections={[
                                { heading: '작동 원리', body: '4가지 시장 신호를 종합하여 현재 시장 체제(Regime)를 판별합니다.\n\n• VIX: 공포지수 수준 (20이하 = 안정, 30+ = 공포)\n• SPY Trend: 200일 이평선 대비 위치 + 추세 방향\n• Market Breadth: 200MA 위 종목 비율 (시장 참여도)\n• Yield Curve: 10Y-2Y 국채 스프레드 (경기 전망)' },
                                { heading: '4가지 체제', body: '• Risk-On (초록): 모든 신호 긍정 → 공격적 포지션 가능\n• Neutral (노랑): 혼합 신호 → 선별적 접근\n• Risk-Off (주황): 경고 신호 다수 → 방어적 포지션\n• Crisis (빨강): 위기 신호 → 현금 비중 확대, 헤지 고려\n\n체제에 따라 다른 분석 스크립트의 임계값이 자동 조정됩니다.' },
                                { heading: '활용 팁', body: '• Regime 변경 시 포트폴리오 리밸런싱 검토\n• Risk-Off에서는 Smart Money 종목도 보수적으로 접근\n• Crisis 체제 진입 시 기존 롱 포지션 축소 우선\n• 각 신호의 세부 수치를 클릭하면 상세 데이터 확인 가능' },
                            ]} />
                        </div>
                        <p className="text-gray-400">Real-time regime detection & adaptive threshold engine</p>
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

            {error && <ErrorBanner message={error} onRetry={loadData} />}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse"></div>
                    ))}
                </div>
            ) : !data ? (
                !error && (
                    <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center">
                            <i className="fas fa-globe text-2xl text-cyan-500"></i>
                        </div>
                        <div className="text-gray-500 text-lg mb-2">No regime data available</div>
                        <div className="text-xs text-gray-600">Run: python3 us_market/market_regime.py</div>
                    </div>
                )
            ) : (
                <>
                    {/* Main Regime Card */}
                    <div className={`p-8 rounded-2xl bg-[#1c1c1e] border ${cfg.border} text-center`}>
                        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${cfg.bg} ${cfg.border} border mb-4`}>
                            <i className={`fas ${cfg.icon} text-xl ${cfg.color}`}></i>
                            <span className={`text-2xl font-black ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center justify-center gap-6 mt-3">
                            <div className="text-center">
                                <div className="text-xs text-gray-500 mb-1">Confidence</div>
                                <div className="text-xl font-bold text-white">{data.confidence}%</div>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="text-center">
                                <div className="text-xs text-gray-500 mb-1">Score</div>
                                <div className="text-xl font-bold text-white">{data.weighted_score}</div>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="text-center">
                                <div className="text-xs text-gray-500 mb-1">Scale</div>
                                <div className="text-xs text-gray-400">0 = Risk-On, 3 = Crisis</div>
                            </div>
                        </div>
                        {/* Score bar */}
                        <div className="mt-4 mx-auto max-w-md">
                            <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
                                <div className="h-full bg-green-500" style={{ width: '25%' }}></div>
                                <div className="h-full bg-yellow-500" style={{ width: '25%' }}></div>
                                <div className="h-full bg-orange-500" style={{ width: '25%' }}></div>
                                <div className="h-full bg-red-500" style={{ width: '25%' }}></div>
                            </div>
                            <div className="relative h-4 mt-1">
                                <div
                                    className="absolute w-2 h-2 bg-white rounded-full -top-0.5 transform -translate-x-1/2"
                                    style={{ left: `${Math.min(data.weighted_score / 3, 1) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Signal Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(data.signals).map(([key, sig]) => {
                            const sigRegime = getSignalRegime(sig as Record<string, unknown>);
                            const sigCfg = REGIME_CONFIG[sigRegime] || REGIME_CONFIG.neutral;

                            return (
                                <div key={key} className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-gray-500 uppercase tracking-wider">{SIGNAL_NAMES[key] || key}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sigCfg.color} ${sigCfg.bg} ${sigCfg.border} border`}>
                                            {sigCfg.label}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        {Object.entries(sig as Record<string, unknown>).map(([k, v]) => {
                                            if (k.endsWith('_regime')) return null;
                                            return (
                                                <div key={k} className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">{k.replace(/_/g, ' ')}</span>
                                                    <span className="text-white text-xs font-mono">
                                                        {v == null ? '--' : typeof v === 'number' ? v.toFixed(2) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Timestamp */}
                    <div className="text-center text-xs text-gray-600">
                        Last updated: {new Date(data.timestamp).toLocaleString('ko-KR')}
                    </div>
                </>
            )}
        </div>
    );
}

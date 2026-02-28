'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { skillsAPI } from '@/lib/api';

const DIRECTION_KR: Record<string, string> = {
    'bullish': '강세', 'bearish': '약세', 'neutral': '중립',
};

const CONFIDENCE_KR: Record<string, string> = {
    'High': '높음', 'Medium': '보통', 'Low': '낮음',
};

const HEAT_LABEL_KR: Record<string, string> = {
    'Hot': '뜨거움', 'Warm': '따뜻', 'Cool': '쿨', 'Cold': '차가움',
};

const STAGE_KR: Record<string, string> = {
    'Early': '초기', 'Growth': '성장기', 'Mature': '성숙기', 'Decline': '쇠퇴기',
    'Emerging': '신흥', 'Accelerating': '가속', 'Peak': '정점',
};

const INDUSTRY_KR: Record<string, string> = {
    'Oil & Gas': '석유/가스', 'Aluminum': '알루미늄', 'Gold': '금',
    'Capital Markets': '자본시장', 'Banks': '은행', 'Insurance': '보험',
    'Software': '소프트웨어', 'Semiconductors': '반도체', 'Biotechnology': '바이오테크',
    'Healthcare': '헬스케어', 'Real Estate': '부동산', 'Utilities': '유틸리티',
    'Aerospace & Defense': '항공우주/방위', 'Auto Manufacturers': '자동차 제조',
    'Financial Services': '금융서비스', 'Retail': '소매',
};

function getHeatColor(heat: number) {
    if (heat >= 70) return 'text-red-400';
    if (heat >= 50) return 'text-orange-400';
    if (heat >= 30) return 'text-yellow-400';
    return 'text-blue-400';
}

function getHeatBarColor(heat: number) {
    if (heat >= 70) return 'bg-red-500';
    if (heat >= 50) return 'bg-orange-500';
    if (heat >= 30) return 'bg-yellow-500';
    return 'bg-blue-500';
}

function translateIndustry(name: string): string {
    for (const [en, kr] of Object.entries(INDUSTRY_KR)) {
        if (name.includes(en)) return name.replace(en, kr);
    }
    return name;
}

export default function ThemesPage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [running, setRunning] = useState(false);

    const loadData = useCallback(() => {
        skillsAPI.getThemes()
            .then(data => { setReport(data); setError(''); })
            .catch(() => setError('테마 리포트가 없습니다.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleRun = async () => {
        setRunning(true);
        try {
            await skillsAPI.runSkill('theme-detector');
            const poll = setInterval(() => {
                skillsAPI.getStatus().then((s: any) => {
                    if (!s.running?.['theme-detector']) { clearInterval(poll); setRunning(false); loadData(); }
                });
            }, 3000);
        } catch { setRunning(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500/20 border-t-amber-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Link href="/dashboard/skills" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
                    <span>&larr;</span> 스킬 허브
                </Link>
                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-10 text-center">
                    <p className="text-gray-400">{error}</p>
                    <button onClick={handleRun} disabled={running}
                        className="mt-4 px-6 py-2.5 rounded-xl font-medium bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all">
                        {running ? '실행 중...' : '테마 감지기 실행'}
                    </button>
                </div>
            </div>
        );
    }

    // Support both data formats: themes.all (actual API) and results (legacy)
    const themes = report?.themes?.all || report?.results || [];
    const summary = report?.summary || {};
    const industryRankings = report?.industry_rankings || {};

    return (
        <div className="space-y-6">
            <Link href="/dashboard/skills" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
                <span>&larr;</span> 스킬 허브
            </Link>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">테마 감지기</h1>
                    <p className="text-gray-500 mt-1">동시 급등 종목군 클러스터링 & 테마 식별</p>
                </div>
                <div className="flex items-center gap-3">
                    {report?.generated_at && (
                        <span className="text-xs text-gray-600">
                            {new Date(report.generated_at).toLocaleString()}
                        </span>
                    )}
                    <button onClick={handleRun} disabled={running}
                        className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${running ? 'bg-blue-500/20 text-blue-400 animate-pulse cursor-wait' : 'bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'}`}>
                        {running ? '실행 중...' : '실행'}
                    </button>
                </div>
            </div>

            {/* Summary */}
            {(summary.bullish_count || summary.bearish_count) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">강세 테마</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">{summary.bullish_count || 0}</p>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">약세 테마</p>
                        <p className="text-2xl font-bold text-red-400 mt-1">{summary.bearish_count || 0}</p>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">최강 테마</p>
                        <p className="text-sm font-medium text-green-400 mt-2">{translateIndustry(summary.top_bullish || '-')}</p>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">최약 테마</p>
                        <p className="text-sm font-medium text-red-400 mt-2">{translateIndustry(summary.top_bearish || '-')}</p>
                    </div>
                </div>
            )}

            {/* Themes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {themes.map((theme: any, i: number) => {
                    const name = theme.name || theme.theme || 'Unknown';
                    const heat = theme.heat ?? theme.heat_score ?? 0;
                    const direction = theme.direction || 'neutral';
                    const confidence = theme.confidence || '';
                    const heatLabel = theme.heat_label || '';
                    const stage = theme.stage || '';
                    const etfs = theme.proxy_etfs || theme.etfs || [];
                    const stocks = theme.representative_stocks || [];

                    return (
                        <div key={i} className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{translateIndustry(name)}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                            direction === 'bullish' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            direction === 'bearish' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                        }`}>
                                            {DIRECTION_KR[direction] || direction}
                                        </span>
                                        {confidence && (
                                            <span className="text-xs text-gray-500">
                                                신뢰: {CONFIDENCE_KR[confidence] || confidence}
                                            </span>
                                        )}
                                        {stage && (
                                            <span className="text-xs text-gray-500">
                                                단계: {STAGE_KR[stage] || stage}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-bold ${getHeatColor(heat)}`}>{heat.toFixed(0)}</p>
                                    {heatLabel && (
                                        <p className="text-xs text-gray-500">{HEAT_LABEL_KR[heatLabel] || heatLabel}</p>
                                    )}
                                </div>
                            </div>

                            {/* Heat Bar */}
                            <div className="mt-4">
                                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                                    <span>열기 점수</span>
                                    <span className="font-medium">{heat.toFixed(0)}</span>
                                </div>
                                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                    <div className={`h-full ${getHeatBarColor(heat)} rounded-full transition-all duration-700`}
                                        style={{ width: `${Math.min(heat, 100)}%` }} />
                                </div>
                            </div>

                            {/* Heat Breakdown */}
                            {theme.heat_breakdown && (
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    {theme.heat_breakdown.momentum_strength !== undefined && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>모멘텀</span>
                                            <span className="text-white">{theme.heat_breakdown.momentum_strength.toFixed(0)}</span>
                                        </div>
                                    )}
                                    {theme.heat_breakdown.breadth_signal !== undefined && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>건전성</span>
                                            <span className="text-white">{theme.heat_breakdown.breadth_signal.toFixed(0)}</span>
                                        </div>
                                    )}
                                    {theme.heat_breakdown.uptrend_signal !== undefined && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>상승추세</span>
                                            <span className="text-white">{theme.heat_breakdown.uptrend_signal.toFixed(0)}</span>
                                        </div>
                                    )}
                                    {theme.heat_breakdown.volume_intensity !== undefined && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>거래량</span>
                                            <span className="text-white">{theme.heat_breakdown.volume_intensity.toFixed(0)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ETFs & Stocks */}
                            {(etfs.length > 0 || stocks.length > 0) && (
                                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-1.5">
                                    {etfs.map((etf: string, j: number) => (
                                        <span key={`e${j}`} className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">{etf}</span>
                                    ))}
                                    {stocks.slice(0, 5).map((stock: string, j: number) => (
                                        <span key={`s${j}`} className="text-xs bg-white/[0.06] text-gray-300 px-2.5 py-1 rounded-full border border-white/10">{stock}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
                {themes.length === 0 && (
                    <div className="col-span-2 text-center p-10 text-gray-500">
                        감지된 테마가 없습니다. <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">/skill-theme-detector</code> 를 실행하세요
                    </div>
                )}
            </div>

            {/* Industry Rankings */}
            {(industryRankings.top?.length > 0 || industryRankings.bottom?.length > 0) && (
                <div>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">산업 순위</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {industryRankings.top?.length > 0 && (
                            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                                <p className="text-xs text-green-400 uppercase tracking-wider mb-3">상위 산업</p>
                                <div className="space-y-2">
                                    {industryRankings.top.slice(0, 5).map((ind: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <span className="text-white">{translateIndustry(ind.name)}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-green-400 text-xs">1주 {ind.perf_1w?.toFixed(1)}%</span>
                                                <span className="text-green-400 text-xs">1개월 {ind.perf_1m?.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {industryRankings.bottom?.length > 0 && (
                            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                                <p className="text-xs text-red-400 uppercase tracking-wider mb-3">하위 산업</p>
                                <div className="space-y-2">
                                    {industryRankings.bottom.slice(0, 5).map((ind: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <span className="text-white">{translateIndustry(ind.name)}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-red-400 text-xs">1주 {ind.perf_1w?.toFixed(1)}%</span>
                                                <span className="text-red-400 text-xs">1개월 {ind.perf_1m?.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {report?._report_time && (
                <p className="text-xs text-gray-600 text-right">
                    리포트: {new Date(report._report_time).toLocaleString()}
                </p>
            )}
        </div>
    );
}

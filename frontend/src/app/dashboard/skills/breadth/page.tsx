'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { skillsAPI } from '@/lib/api';

const ZONE_LABELS: Record<string, string> = {
    'Strong': '강세',
    'Healthy': '건강',
    'Neutral': '중립',
    'Weakening': '약화',
    'Critical': '위험',
};

const HEALTH_ZONES = [
    { min: 80, label: '강세', color: 'text-green-400', bg: 'bg-green-500', exposure: '90-100%' },
    { min: 60, label: '건강', color: 'text-emerald-400', bg: 'bg-emerald-500', exposure: '75-90%' },
    { min: 40, label: '중립', color: 'text-yellow-400', bg: 'bg-yellow-500', exposure: '60-75%' },
    { min: 20, label: '약화', color: 'text-orange-400', bg: 'bg-orange-500', exposure: '40-60%' },
    { min: 0, label: '위험', color: 'text-red-400', bg: 'bg-red-500', exposure: '25-40%' },
];

const COMPONENT_LABELS: Record<string, string> = {
    'current_breadth_level_trend': '현재 건전성 수준 & 추세',
    'breadth_level_trend': '현재 건전성 수준 & 추세',
    '8ma_vs_200ma_crossover': '8MA vs 200MA 크로스오버',
    'ma_crossover': '8MA vs 200MA 크로스오버',
    'peak_trough_cycle_position': '고점/저점 사이클 위치',
    'cycle_position': '고점/저점 사이클 위치',
    'bearish_signal_status': '약세 신호 상태',
    'bearish_signal': '약세 신호 상태',
    'historical_percentile': '역사적 백분위',
    'sp_vs_breadth_divergence': 'S&P vs 건전성 괴리',
    'divergence': 'S&P vs 건전성 괴리',
};

const SIGNAL_PREFIX_KR: Record<string, string> = {
    'HEALTHY': '양호', 'ALL CLEAR': '양호',
    'NEUTRAL': '중립', 'AVERAGE': '평균',
    'CAUTION': '주의', 'WARNING': '경고',
    'CRITICAL': '위험', 'BEARISH': '약세',
    'BULLISH': '강세',
};

function translateComponent(key: string): string {
    return COMPONENT_LABELS[key] || key.replace(/_/g, ' ');
}

function translateSignal(signal: string): string {
    if (!signal) return '';
    const colonIdx = signal.indexOf(':');
    if (colonIdx === -1) return signal;
    const prefix = signal.substring(0, colonIdx).trim();
    const rest = signal.substring(colonIdx + 1).trim();
    const krPrefix = SIGNAL_PREFIX_KR[prefix] || prefix;
    return `${krPrefix}: ${translateBreadthText(rest)}`;
}

function translateBreadthText(text: string): string {
    if (!text) return '';
    return text
        .replace(/No bearish signal/gi, '약세 신호 없음')
        .replace(/uptrend/gi, '상승추세')
        .replace(/downtrend/gi, '하락추세')
        .replace(/in uptrend/gi, '상승추세 중')
        .replace(/above average/gi, '평균 이상')
        .replace(/below average/gi, '평균 이하')
        .replace(/normal range/gi, '정상 범위')
        .replace(/No cycle marker in last/gi, '최근 사이클 마커 없음 (')
        .replace(/days$/gi, '일)')
        .replace(/Near crossover/gi, '크로스오버 임박')
        .replace(/falling/gi, '하락 중')
        .replace(/rising/gi, '상승 중')
        .replace(/deterioration signal/gi, '악화 신호')
        .replace(/percentile/gi, '백분위')
        .replace(/both rising/gi, '모두 상승')
        .replace(/both falling/gi, '모두 하락')
        .replace(/Healthy alignment/gi, '건전한 정렬')
        .replace(/Consistent decline/gi, '일관된 하락')
        .replace(/Divergence detected/gi, '괴리 감지');
}

function getHealthZone(score: number) {
    return HEALTH_ZONES.find(z => score >= z.min) || HEALTH_ZONES[HEALTH_ZONES.length - 1];
}

export default function BreadthPage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [running, setRunning] = useState(false);

    const loadData = useCallback(() => {
        skillsAPI.getMarketBreadth()
            .then(data => { setReport(data); setError(''); })
            .catch(() => setError('시장 건전성 리포트가 없습니다.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleRun = async () => {
        setRunning(true);
        try {
            await skillsAPI.runSkill('market-breadth-analyzer');
            const poll = setInterval(() => {
                skillsAPI.getStatus().then((s: any) => {
                    if (!s.running?.['market-breadth-analyzer']) { clearInterval(poll); setRunning(false); loadData(); }
                });
            }, 3000);
        } catch { setRunning(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-500"></div>
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
                        {running ? '실행 중...' : '시장 건전성 분석 실행'}
                    </button>
                </div>
            </div>
        );
    }

    const results = report?.results?.[0] || report?.results || {};
    const score = results?.composite_score ?? results?.score ?? 0;
    const zone = getHealthZone(score);
    const components = results?.components || results?.scoring?.components || {};

    return (
        <div className="space-y-6">
            <Link href="/dashboard/skills" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
                <span>&larr;</span> 스킬 허브
            </Link>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">시장 건전성 분석</h1>
                    <p className="text-gray-500 mt-1">6개 구성 요소 기반 시장 건전성 점수 (API 키 불필요)</p>
                </div>
                <button onClick={handleRun} disabled={running}
                    className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${running ? 'bg-blue-500/20 text-blue-400 animate-pulse cursor-wait' : 'bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'}`}>
                    {running ? '실행 중...' : '실행'}
                </button>
            </div>

            {/* Main Score */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-sm text-gray-500 mb-3 uppercase tracking-wider">종합 건전성 점수</p>
                <p className={`text-7xl font-bold ${zone.color}`}>{score.toFixed(0)}</p>
                <p className={`text-lg font-medium mt-3 ${zone.color}`}>{zone.label}</p>
                <p className="text-sm text-gray-500 mt-2">권장 주식 노출도: {zone.exposure}</p>
            </div>

            {/* Score Bar */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                <div className="h-3 bg-black/40 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${zone.bg} rounded-full transition-all duration-1000`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between mt-3 text-xs text-gray-600">
                    <span>위험 (0)</span>
                    <span>중립 (50)</span>
                    <span>강세 (100)</span>
                </div>
            </div>

            {/* Components */}
            {Object.keys(components).length > 0 && (
                <div>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">구성 요소별 점수</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(components).map(([key, comp]: [string, any]) => (
                            <div key={key} className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-5">
                                <p className="text-sm text-gray-400">{translateComponent(key)}</p>
                                <div className="flex items-end justify-between mt-2">
                                    <p className="text-2xl font-bold text-white">
                                        {typeof comp === 'object' ? (comp.score ?? comp.value ?? '-') : comp}
                                    </p>
                                    {typeof comp === 'object' && comp.weight && (
                                        <span className="text-xs text-gray-600">가중치: {(comp.weight * 100).toFixed(0)}%</span>
                                    )}
                                </div>
                                {typeof comp === 'object' && comp.signal && (
                                    <p className="text-xs text-gray-500 mt-2">{translateSignal(comp.signal)}</p>
                                )}
                            </div>
                        ))}
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

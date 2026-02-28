'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { skillsAPI, SkillInfo } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
    screening: '스크리닝',
    timing: '마켓 타이밍',
    analysis: '시장 분석',
    earnings: '어닝',
    strategy: '전략 & 리스크',
    institutional: '기관',
    edge: '엣지',
    dividend: '배당',
    risk: '리스크',
    meta: '메타',
};

const CATEGORY_COLORS: Record<string, string> = {
    screening: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    timing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    analysis: 'bg-green-500/20 text-green-400 border-green-500/30',
    earnings: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    strategy: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    institutional: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    edge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    dividend: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    risk: 'bg-red-500/20 text-red-400 border-red-500/30',
    meta: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const SIGNAL_STYLES: Record<string, { color: string; bg: string }> = {
    RISK_ON: { color: 'text-green-400', bg: 'bg-green-500/20' },
    NEUTRAL: { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    CAUTION: { color: 'text-orange-400', bg: 'bg-orange-500/20' },
    RISK_OFF: { color: 'text-red-400', bg: 'bg-red-500/20' },
};

const SIGNAL_LABELS: Record<string, string> = {
    RISK_ON: '위험 선호',
    NEUTRAL: '중립',
    CAUTION: '주의',
    RISK_OFF: '위험 회피',
};

// Dedicated pages for skills with custom visualizations
const SKILL_DEDICATED_PAGES: Record<string, string> = {
    'vcp-screener': '/dashboard/skills/vcp',
    'market-breadth-analyzer': '/dashboard/skills/breadth',
    'theme-detector': '/dashboard/skills/themes',
    'ftd-detector': '/dashboard/skills/ftd',
    'market-top-detector': '/dashboard/skills/market-top',
    'uptrend-analyzer': '/dashboard/skills/uptrend',
    'us-market-bubble-detector': '/dashboard/skills/bubble',
    'canslim-screener': '/dashboard/skills/canslim',
    'backtest-expert': '/dashboard/skills/backtest',
};

// All skills link to detail pages: dedicated or generic [skillId] route
function getDetailPage(skillId: string): string {
    return SKILL_DEDICATED_PAGES[skillId] || `/dashboard/skills/${skillId}`;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
    const color = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score >= 30 ? 'bg-orange-500' : 'bg-red-500';
    const textColor = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : score >= 30 ? 'text-orange-400' : 'text-red-400';
    return (
        <div>
            <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">{label}</span>
                <span className={`font-medium ${textColor}`}>{score.toFixed(0)}</span>
            </div>
            <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(score, 100)}%` }} />
            </div>
        </div>
    );
}

// Dashboard zone label translations
const ZONE_LABELS: Record<string, string> = {
    'Healthy': '건강',
    'Cautious': '주의',
    'Warning': '경고',
    'Critical': '위험',
    'Unhealthy': '비건강',
    'Strong': '강세',
    'Neutral': '중립',
    'Weakening': '약화',
    'Low': '낮음',
    'Medium': '보통',
    'High': '높음',
    'Very High': '매우 높음',
    'Extreme': '극단적',
};

function translateZone(zone: string): string {
    return ZONE_LABELS[zone] || zone;
}

export default function SkillsHubPage() {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState<any>(null);
    const [chains, setChains] = useState<any>(null);
    const [runningSkills, setRunningSkills] = useState<Set<string>>(new Set());
    const [runningChains, setRunningChains] = useState<Set<string>>(new Set());
    const [skillResults, setSkillResults] = useState<Record<string, string>>({});

    const loadData = useCallback(() => {
        return Promise.all([
            skillsAPI.getCatalog().catch(() => ({ skills: [], categories: [] })),
            skillsAPI.getDashboard().catch(() => null),
            skillsAPI.getChains().catch(() => null),
        ]).then(([catalog, dash, ch]) => {
            setSkills((catalog as any).skills || []);
            setCategories((catalog as any).categories || []);
            setDashboard(dash);
            setChains(ch);
        });
    }, []);

    useEffect(() => {
        loadData().finally(() => setLoading(false));
    }, [loadData]);

    // Poll running skills status
    useEffect(() => {
        if (runningSkills.size === 0 && runningChains.size === 0) return;
        const interval = setInterval(() => {
            skillsAPI.getStatus().then((status: any) => {
                const stillRunning = new Set(Object.keys(status.running || {}));
                const recent = status.recent || {};
                // Update results from recent completions
                Object.entries(recent).forEach(([id, res]: [string, any]) => {
                    if (!stillRunning.has(id)) {
                        setSkillResults(prev => ({
                            ...prev,
                            [id]: res.success ? '완료' : `실패 (exit ${res.exit_code})`,
                        }));
                    }
                });
                if (stillRunning.size === 0 && (runningSkills.size > 0 || runningChains.size > 0)) {
                    // All done — refresh data
                    setRunningSkills(new Set());
                    setRunningChains(new Set());
                    loadData();
                } else {
                    setRunningSkills(prev => {
                        const next = new Set<string>();
                        prev.forEach(s => { if (stillRunning.has(s)) next.add(s); });
                        if (next.size < prev.size) loadData(); // partial completion
                        return next;
                    });
                }
            }).catch(() => {});
        }, 3000);
        return () => clearInterval(interval);
    }, [runningSkills, runningChains, loadData]);

    const handleRunSkill = async (skillId: string) => {
        setRunningSkills(prev => new Set(prev).add(skillId));
        setSkillResults(prev => ({ ...prev, [skillId]: '시작 중...' }));
        try {
            const res = await skillsAPI.runSkill(skillId);
            if (res.status === 'started') {
                setSkillResults(prev => ({ ...prev, [skillId]: '실행 중...' }));
            } else if (res.error) {
                setSkillResults(prev => ({ ...prev, [skillId]: res.error }));
                setRunningSkills(prev => { const n = new Set(prev); n.delete(skillId); return n; });
            }
        } catch (e: any) {
            setSkillResults(prev => ({ ...prev, [skillId]: '오류: ' + (e.message || '실패') }));
            setRunningSkills(prev => { const n = new Set(prev); n.delete(skillId); return n; });
        }
    };

    const handleRunChain = async (chainId: string) => {
        setRunningChains(prev => new Set(prev).add(chainId));
        try {
            const res = await skillsAPI.runChain(chainId);
            if (res.started) {
                res.started.forEach((s: string) => {
                    setRunningSkills(prev => new Set(prev).add(s));
                });
            }
        } catch {
            setRunningChains(prev => { const n = new Set(prev); n.delete(chainId); return n; });
        }
    };

    const filtered = filter === 'all' ? skills : skills.filter(s => s.category === filter);
    const grouped = filtered.reduce((acc, s) => {
        const cat = s.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(s);
        return acc;
    }, {} as Record<string, SkillInfo[]>);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-pink-500/20 border-t-pink-500"></div>
            </div>
        );
    }

    const overall = dashboard?.overall;
    const signalStyle = overall ? SIGNAL_STYLES[overall.signal] || SIGNAL_STYLES.NEUTRAL : null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">트레이딩 스킬 허브</h1>
                    <p className="text-gray-500 mt-1">{skills.length}개 스킬 | {skills.filter(s => s.has_report).length}개 리포트 사용 가능</p>
                </div>
                {runningSkills.size > 0 && (
                    <div className="flex items-center gap-2 text-blue-400 text-sm bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1.5">
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-400/20 border-t-blue-400"></div>
                        {runningSkills.size}개 스킬 실행 중
                    </div>
                )}
            </div>

            {/* Market Pulse Dashboard */}
            {dashboard && (
                <div className="space-y-4">
                    <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">마켓 펄스</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {overall && (
                            <div className={`${signalStyle?.bg} backdrop-blur-sm border border-white/10 rounded-2xl p-5 col-span-2 md:col-span-1 text-center`}>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">종합</p>
                                <p className={`text-2xl font-bold mt-1 ${signalStyle?.color}`}>{SIGNAL_LABELS[overall.signal] || overall.signal.replace('_', ' ')}</p>
                                <p className="text-sm text-gray-500 mt-1">{overall.avg_score}/100</p>
                            </div>
                        )}
                        {dashboard.breadth && (
                            <Link href="/dashboard/skills/breadth" className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/[0.06] transition-all">
                                <p className="text-xs text-gray-500">건전성</p>
                                <ScoreBar score={dashboard.breadth.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{translateZone(dashboard.breadth.zone)}</p>
                            </Link>
                        )}
                        {dashboard.regime && (
                            <Link href="/dashboard/skills/macro-regime-detector" className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/[0.06] transition-all">
                                <p className="text-xs text-gray-500">레짐</p>
                                <ScoreBar score={dashboard.regime.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{translateZone(dashboard.regime.zone)}</p>
                            </Link>
                        )}
                        {dashboard.uptrend && (
                            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">상승추세</p>
                                <ScoreBar score={dashboard.uptrend.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{translateZone(dashboard.uptrend.zone)}</p>
                            </div>
                        )}
                        {dashboard.bubble && (
                            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">버블 위험</p>
                                <ScoreBar score={dashboard.bubble.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{translateZone(dashboard.bubble.zone)}</p>
                            </div>
                        )}
                        {dashboard.market_top && (
                            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">고점 감지</p>
                                <ScoreBar score={dashboard.market_top.score} label="" />
                            </div>
                        )}
                        {dashboard.ftd && (
                            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">FTD</p>
                                <ScoreBar score={dashboard.ftd.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{translateZone(dashboard.ftd.zone)}</p>
                            </div>
                        )}
                    </div>

                    {/* Themes & Screening Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dashboard.themes && (
                            <Link href="/dashboard/skills/themes" className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/[0.06] transition-all">
                                <p className="text-sm text-gray-400 mb-3">활성 테마 ({dashboard.themes.count})</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(dashboard.themes.top_themes || []).map((t: string, i: number) => (
                                        <span key={i} className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20">{t}</span>
                                    ))}
                                </div>
                            </Link>
                        )}
                        {dashboard.screening && (
                            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                                <p className="text-sm text-gray-400 mb-3">스크리닝 결과</p>
                                <div className="flex gap-6">
                                    {dashboard.screening.vcp && (
                                        <Link href="/dashboard/skills/vcp" className="hover:opacity-80 transition-opacity">
                                            <span className="text-3xl font-bold text-rose-400">{dashboard.screening.vcp.count}</span>
                                            <span className="text-xs text-gray-500 ml-1.5">VCP</span>
                                        </Link>
                                    )}
                                    {dashboard.screening.canslim && (
                                        <div>
                                            <span className="text-3xl font-bold text-blue-400">{dashboard.screening.canslim.count}</span>
                                            <span className="text-xs text-gray-500 ml-1.5">CANSLIM</span>
                                        </div>
                                    )}
                                    {dashboard.screening.pead && (
                                        <div>
                                            <span className="text-3xl font-bold text-purple-400">{dashboard.screening.pead.count}</span>
                                            <span className="text-xs text-gray-500 ml-1.5">PEAD</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Workflow Chains */}
            {chains && (
                <div className="space-y-3">
                    <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">워크플로우 체인</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(chains).map(([chainId, chain]: [string, any]) => (
                            <div key={chainId} className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-white text-sm">{chain.name}</h3>
                                    <div className="flex items-center gap-2">
                                        {chain.complete && (
                                            <span className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">완료</span>
                                        )}
                                        <button
                                            onClick={() => handleRunChain(chainId)}
                                            disabled={runningChains.has(chainId)}
                                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                                                runningChains.has(chainId)
                                                    ? 'bg-blue-500/20 text-blue-400 animate-pulse cursor-wait'
                                                    : 'bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'
                                            }`}
                                        >
                                            {runningChains.has(chainId) ? '실행 중...' : '전체 실행'}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">{chain.description}</p>
                                <div className="space-y-1.5">
                                    {(chain.skills || []).map((s: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className={
                                                runningSkills.has(s.id) ? 'text-blue-400 animate-pulse' :
                                                s.has_report ? 'text-green-400' : 'text-gray-600'
                                            }>
                                                {runningSkills.has(s.id) ? '\u25C9' : s.has_report ? '\u25CF' : '\u25CB'}
                                            </span>
                                            <span className={s.has_report ? 'text-gray-300' : 'text-gray-600'}>
                                                {s.name}
                                            </span>
                                            {!s.has_script && (
                                                <span className="text-gray-700 text-[10px]">프롬프트</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                                    {chain.available_count}/{chain.total_count}개 리포트 사용 가능
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                        filter === 'all' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08] border border-white/10'
                    }`}
                >
                    전체 ({skills.length})
                </button>
                {categories.sort().map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                            filter === cat ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08] border border-white/10'
                        }`}
                    >
                        {CATEGORY_LABELS[cat] || cat} ({skills.filter(s => s.category === cat).length})
                    </button>
                ))}
            </div>

            {/* Skills Grid by Category */}
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catSkills]) => (
                <div key={category}>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">
                        {CATEGORY_LABELS[category] || category}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {catSkills.map(skill => {
                            const detailPage = getDetailPage(skill.id);
                            const isRunning = runningSkills.has(skill.id) || skill.running;
                            const result = skillResults[skill.id];

                            return (
                                <div
                                    key={skill.id}
                                    className={`bg-white/[0.03] backdrop-blur-sm border rounded-xl p-5 transition-all ${
                                        isRunning ? 'border-blue-500/30 bg-blue-500/[0.03]' :
                                        skill.has_report ? 'border-white/10 hover:bg-white/[0.06]' :
                                        'border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <Link href={detailPage} className="font-medium text-white hover:text-pink-400 transition-colors">
                                                {skill.name}
                                            </Link>
                                            <p className="text-xs text-gray-600 mt-0.5">{skill.id}</p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <span className={`text-xs px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[skill.category] || 'bg-gray-700 text-gray-400'}`}>
                                                {CATEGORY_LABELS[skill.category] || skill.category}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 mt-3 text-xs">
                                        {skill.has_script ? (
                                            skill.auto_runnable ? (
                                                <span className="text-green-400/80">자동 실행</span>
                                            ) : (
                                                <span className="text-orange-400/80">입력 필요</span>
                                            )
                                        ) : (
                                            <span className="text-gray-600">프롬프트 전용</span>
                                        )}
                                        {skill.api_key_required && (
                                            <span className="text-yellow-500/80">{skill.api_key_required}</span>
                                        )}
                                    </div>

                                    {/* Status + Run Button */}
                                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            {isRunning ? (
                                                <span className="text-xs text-blue-400 animate-pulse flex items-center gap-1.5">
                                                    <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                                                    {result || '실행 중...'}
                                                </span>
                                            ) : skill.has_report ? (
                                                <span className="text-xs text-green-400/80">
                                                    리포트: {new Date(skill.last_report_time!).toLocaleDateString()}
                                                </span>
                                            ) : result ? (
                                                <span className="text-xs text-red-400 truncate block">{result}</span>
                                            ) : (
                                                <span className="text-xs text-gray-600">리포트 없음</span>
                                            )}
                                        </div>

                                        {skill.auto_runnable && !isRunning && (
                                            <button
                                                onClick={(e) => { e.preventDefault(); handleRunSkill(skill.id); }}
                                                className="ml-2 text-xs px-3.5 py-1.5 rounded-lg font-medium bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all whitespace-nowrap"
                                            >
                                                실행
                                            </button>
                                        )}
                                        <Link
                                            href={detailPage}
                                            className="ml-2 text-xs px-3.5 py-1.5 rounded-lg font-medium bg-white/[0.06] text-gray-300 hover:bg-white/[0.1] border border-white/10 transition-all whitespace-nowrap"
                                        >
                                            상세보기
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

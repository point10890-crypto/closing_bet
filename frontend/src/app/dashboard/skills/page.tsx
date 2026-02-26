'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { skillsAPI, SkillInfo } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
    screening: 'Screening',
    timing: 'Market Timing',
    analysis: 'Analysis',
    earnings: 'Earnings',
    strategy: 'Strategy & Risk',
    institutional: 'Institutional',
    edge: 'Edge Discovery',
    dividend: 'Dividend',
    risk: 'Risk',
    meta: 'Meta',
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

const SKILL_DETAIL_PAGES: Record<string, string> = {
    'vcp-screener': '/dashboard/skills/vcp',
    'market-breadth-analyzer': '/dashboard/skills/breadth',
    'macro-regime-detector': '/dashboard/skills/regime',
    'theme-detector': '/dashboard/skills/themes',
};

function ScoreBar({ score, label }: { score: number; label: string }) {
    const color = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score >= 30 ? 'bg-orange-500' : 'bg-red-500';
    const textColor = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : score >= 30 ? 'text-orange-400' : 'text-red-400';
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{label}</span>
                <span className={textColor}>{score.toFixed(0)}</span>
            </div>
            <div className="h-2 bg-gray-900 rounded-full">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(score, 100)}%` }} />
            </div>
        </div>
    );
}

export default function SkillsHubPage() {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState<any>(null);
    const [chains, setChains] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            skillsAPI.getCatalog().catch(() => ({ skills: [], categories: [] })),
            skillsAPI.getDashboard().catch(() => null),
            skillsAPI.getChains().catch(() => null),
        ]).then(([catalog, dash, ch]) => {
            setSkills((catalog as any).skills || []);
            setCategories((catalog as any).categories || []);
            setDashboard(dash);
            setChains(ch);
        }).finally(() => setLoading(false));
    }, []);

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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    const overall = dashboard?.overall;
    const signalStyle = overall ? SIGNAL_STYLES[overall.signal] || SIGNAL_STYLES.NEUTRAL : null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Trading Skills Hub</h1>
                    <p className="text-gray-400 mt-1">{skills.length} skills integrated from claude-trading-skills</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {skills.filter(s => s.has_report).length} reports available
                    </span>
                </div>
            </div>

            {/* Market Pulse Dashboard */}
            {dashboard && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-300">Market Pulse</h2>

                    {/* Overall Signal + Score Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {/* Overall Signal */}
                        {overall && (
                            <div className={`${signalStyle?.bg} border border-gray-700 rounded-lg p-4 col-span-2 md:col-span-1 text-center`}>
                                <p className="text-xs text-gray-400">Overall</p>
                                <p className={`text-2xl font-bold ${signalStyle?.color}`}>{overall.signal.replace('_', ' ')}</p>
                                <p className="text-sm text-gray-500">{overall.avg_score}/100</p>
                            </div>
                        )}

                        {/* Individual Scores */}
                        {dashboard.breadth && (
                            <Link href="/dashboard/skills/breadth" className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors">
                                <p className="text-xs text-gray-400">Breadth</p>
                                <ScoreBar score={dashboard.breadth.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{dashboard.breadth.zone}</p>
                            </Link>
                        )}
                        {dashboard.regime && (
                            <Link href="/dashboard/skills/regime" className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors">
                                <p className="text-xs text-gray-400">Regime</p>
                                <ScoreBar score={dashboard.regime.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{dashboard.regime.zone}</p>
                            </Link>
                        )}
                        {dashboard.uptrend && (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-xs text-gray-400">Uptrend</p>
                                <ScoreBar score={dashboard.uptrend.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{dashboard.uptrend.zone}</p>
                            </div>
                        )}
                        {dashboard.bubble && (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-xs text-gray-400">Bubble Risk</p>
                                <ScoreBar score={dashboard.bubble.score} label="" />
                                <p className="text-xs text-gray-600 mt-1">{dashboard.bubble.zone}</p>
                            </div>
                        )}
                        {dashboard.market_top && (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-xs text-gray-400">Market Top</p>
                                <ScoreBar score={dashboard.market_top.score} label="" />
                            </div>
                        )}
                        {dashboard.ftd && (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-xs text-gray-400">FTD</p>
                                <ScoreBar score={dashboard.ftd.score} label="" />
                            </div>
                        )}
                    </div>

                    {/* Themes & Screening Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dashboard.themes && (
                            <Link href="/dashboard/skills/themes" className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors">
                                <p className="text-sm text-gray-400 mb-2">Active Themes ({dashboard.themes.count})</p>
                                <div className="flex flex-wrap gap-1">
                                    {(dashboard.themes.top_themes || []).map((t: string, i: number) => (
                                        <span key={i} className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">{t}</span>
                                    ))}
                                </div>
                            </Link>
                        )}
                        {dashboard.screening && (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-sm text-gray-400 mb-2">Screening Results</p>
                                <div className="flex gap-4">
                                    {dashboard.screening.vcp && (
                                        <Link href="/dashboard/skills/vcp" className="hover:text-rose-300">
                                            <span className="text-2xl font-bold text-rose-400">{dashboard.screening.vcp.count}</span>
                                            <span className="text-xs text-gray-500 ml-1">VCP</span>
                                        </Link>
                                    )}
                                    {dashboard.screening.canslim && (
                                        <div>
                                            <span className="text-2xl font-bold text-blue-400">{dashboard.screening.canslim.count}</span>
                                            <span className="text-xs text-gray-500 ml-1">CANSLIM</span>
                                        </div>
                                    )}
                                    {dashboard.screening.pead && (
                                        <div>
                                            <span className="text-2xl font-bold text-purple-400">{dashboard.screening.pead.count}</span>
                                            <span className="text-xs text-gray-500 ml-1">PEAD</span>
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
                    <h2 className="text-lg font-semibold text-gray-300">Workflow Chains</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {Object.entries(chains).map(([chainId, chain]: [string, any]) => (
                            <div key={chainId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-white text-sm">{chain.name}</h3>
                                    {chain.complete && (
                                        <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded">Complete</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mb-3">{chain.description}</p>
                                <div className="space-y-1">
                                    {(chain.skills || []).map((s: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className={s.has_report ? 'text-green-400' : 'text-gray-600'}>
                                                {s.has_report ? '\u25CF' : '\u25CB'}
                                            </span>
                                            <span className={s.has_report ? 'text-gray-300' : 'text-gray-600'}>
                                                {s.name}
                                            </span>
                                            {!s.has_script && (
                                                <span className="text-gray-700 text-[10px]">prompt</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 text-xs text-gray-500">
                                    {chain.available_count}/{chain.total_count} reports available
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
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filter === 'all' ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    All ({skills.length})
                </button>
                {categories.sort().map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            filter === cat ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {CATEGORY_LABELS[cat] || cat} ({skills.filter(s => s.category === cat).length})
                    </button>
                ))}
            </div>

            {/* Skills Grid by Category */}
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catSkills]) => (
                <div key={category}>
                    <h2 className="text-lg font-semibold text-gray-300 mb-3">
                        {CATEGORY_LABELS[category] || category}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catSkills.map(skill => {
                            const detailPage = SKILL_DETAIL_PAGES[skill.id];
                            const Wrapper = detailPage ? Link : 'div';
                            const wrapperProps = detailPage ? { href: detailPage } : {};
                            return (
                                <Wrapper
                                    key={skill.id}
                                    {...wrapperProps as any}
                                    className={`bg-gray-800/50 border border-gray-700 rounded-lg p-4 transition-colors ${detailPage ? 'hover:border-pink-500/50 cursor-pointer' : 'hover:border-gray-600'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-medium text-white">{skill.name}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{skill.id}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[skill.category] || 'bg-gray-700 text-gray-400'}`}>
                                            {CATEGORY_LABELS[skill.category] || skill.category}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 mt-3 text-xs">
                                        {skill.has_script ? (
                                            <span className="text-green-400">Script</span>
                                        ) : (
                                            <span className="text-gray-600">Prompt-only</span>
                                        )}
                                        {skill.api_key_required && (
                                            <span className="text-yellow-500">{skill.api_key_required}</span>
                                        )}
                                        {skill.running && (
                                            <span className="text-blue-400 animate-pulse">Running...</span>
                                        )}
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        {skill.has_report ? (
                                            <span className="text-xs text-green-400">
                                                Report: {new Date(skill.last_report_time!).toLocaleDateString()}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-600">No report yet</span>
                                        )}
                                        {skill.has_script && (
                                            <span className="text-xs text-gray-500">
                                                /skill-{skill.id}
                                            </span>
                                        )}
                                    </div>
                                </Wrapper>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

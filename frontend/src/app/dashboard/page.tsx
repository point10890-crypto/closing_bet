'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { skillsAPI, usAPI } from '@/lib/api';

const SIGNAL_STYLES: Record<string, { color: string; bg: string; border: string }> = {
    RISK_ON: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    NEUTRAL: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    CAUTION: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    RISK_OFF: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

function ScoreGauge({ score, label, href }: { score: number; label: string; href?: string }) {
    const color = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : score >= 30 ? 'text-orange-400' : 'text-red-400';
    const barColor = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score >= 30 ? 'bg-orange-500' : 'bg-red-500';
    const Wrapper = href ? Link : 'div';
    const wrapperProps = href ? { href } : {};
    return (
        <Wrapper {...wrapperProps as any} className={`bg-[#1c1c1e] border border-white/10 rounded-xl p-4 ${href ? 'hover:border-white/20 transition-colors cursor-pointer' : ''}`}>
            <p className="text-xs text-gray-500 mb-2">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{score.toFixed(0)}</p>
            <div className="h-1.5 bg-gray-800 rounded-full mt-2">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(score, 100)}%` }} />
            </div>
        </Wrapper>
    );
}

export default function DashboardPage() {
    const [dashboard, setDashboard] = useState<any>(null);
    const [usDecision, setUsDecision] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            skillsAPI.getDashboard().catch(() => null),
            usAPI.getDecisionSignal().catch(() => null),
        ]).then(([dash, decision]) => {
            setDashboard(dash);
            setUsDecision(decision);
        }).finally(() => setLoading(false));
    }, []);

    const overall = dashboard?.overall;
    const signalStyle = overall ? SIGNAL_STYLES[overall.signal] || SIGNAL_STYLES.NEUTRAL : null;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/5 text-xs text-purple-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
                    Portfolio Summary
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                    Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Dashboard</span>
                </h2>
                <p className="text-gray-400 text-lg">AI-Powered Market Analysis</p>
            </div>

            {/* Market Pulse - Overall Signal */}
            {!loading && dashboard && overall && (
                <div className={`${signalStyle?.bg} border ${signalStyle?.border} rounded-2xl p-6`}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-2xl ${signalStyle?.bg} border ${signalStyle?.border} flex items-center justify-center`}>
                                <span className={`text-3xl font-black ${signalStyle?.color}`}>
                                    {overall.signal === 'RISK_ON' ? '+' : overall.signal === 'RISK_OFF' ? '-' : '~'}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Market Pulse</p>
                                <p className={`text-2xl font-bold ${signalStyle?.color}`}>{overall.signal.replace('_', ' ')}</p>
                                <p className="text-sm text-gray-400">Composite Score: {overall.avg_score}/100</p>
                            </div>
                        </div>

                        {/* Mini Scores Row */}
                        <div className="flex flex-wrap gap-3">
                            {dashboard.breadth && (
                                <Link href="/dashboard/skills/breadth" className="text-center px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <p className="text-[10px] text-gray-500">Breadth</p>
                                    <p className={`text-lg font-bold ${dashboard.breadth.score >= 60 ? 'text-green-400' : dashboard.breadth.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(dashboard.breadth.score ?? 0).toFixed(0)}
                                    </p>
                                </Link>
                            )}
                            {dashboard.regime && (
                                <Link href="/dashboard/skills/regime" className="text-center px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <p className="text-[10px] text-gray-500">Regime</p>
                                    <p className={`text-lg font-bold ${dashboard.regime.score >= 60 ? 'text-green-400' : dashboard.regime.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(dashboard.regime.score ?? 0).toFixed(0)}
                                    </p>
                                </Link>
                            )}
                            {dashboard.uptrend && (
                                <div className="text-center px-4 py-2 rounded-lg bg-white/5">
                                    <p className="text-[10px] text-gray-500">Uptrend</p>
                                    <p className={`text-lg font-bold ${dashboard.uptrend.score >= 60 ? 'text-green-400' : dashboard.uptrend.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(dashboard.uptrend.score ?? 0).toFixed(0)}
                                    </p>
                                </div>
                            )}
                            {dashboard.bubble && (
                                <div className="text-center px-4 py-2 rounded-lg bg-white/5">
                                    <p className="text-[10px] text-gray-500">Bubble</p>
                                    <p className={`text-lg font-bold ${dashboard.bubble.score >= 60 ? 'text-green-400' : dashboard.bubble.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(dashboard.bubble.score ?? 0).toFixed(0)}
                                    </p>
                                </div>
                            )}
                            {dashboard.market_top && (
                                <div className="text-center px-4 py-2 rounded-lg bg-white/5">
                                    <p className="text-[10px] text-gray-500">Top Risk</p>
                                    <p className={`text-lg font-bold ${dashboard.market_top.score >= 60 ? 'text-green-400' : dashboard.market_top.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(dashboard.market_top.score ?? 0).toFixed(0)}
                                    </p>
                                </div>
                            )}
                            {dashboard.ftd && (
                                <div className="text-center px-4 py-2 rounded-lg bg-white/5">
                                    <p className="text-[10px] text-gray-500">FTD</p>
                                    <p className={`text-lg font-bold ${dashboard.ftd.score >= 60 ? 'text-green-400' : dashboard.ftd.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(dashboard.ftd.score ?? 0).toFixed(0)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Screening + Themes Row */}
            {!loading && dashboard && (dashboard.screening || dashboard.themes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Screening Results */}
                    {dashboard.screening && (
                        <div className="bg-[#1c1c1e] border border-white/10 rounded-xl p-5">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Screening Results</p>
                            <div className="flex items-center gap-6">
                                {dashboard.screening.vcp && (
                                    <Link href="/dashboard/skills/vcp" className="hover:opacity-80 transition-opacity">
                                        <span className="text-3xl font-black text-rose-400">{dashboard.screening.vcp.count}</span>
                                        <span className="text-xs text-gray-500 ml-1.5">VCP</span>
                                    </Link>
                                )}
                                {dashboard.screening.canslim && (
                                    <div>
                                        <span className="text-3xl font-black text-blue-400">{dashboard.screening.canslim.count}</span>
                                        <span className="text-xs text-gray-500 ml-1.5">CANSLIM</span>
                                    </div>
                                )}
                                {dashboard.screening.pead && (
                                    <div>
                                        <span className="text-3xl font-black text-purple-400">{dashboard.screening.pead.count}</span>
                                        <span className="text-xs text-gray-500 ml-1.5">PEAD</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Active Themes */}
                    {dashboard.themes && (
                        <Link href="/dashboard/skills/themes" className="bg-[#1c1c1e] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                                Active Themes ({dashboard.themes.count})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {(dashboard.themes.top_themes || []).map((t: string, i: number) => (
                                    <span key={i} className="text-xs bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-lg">{t}</span>
                                ))}
                            </div>
                        </Link>
                    )}
                </div>
            )}

            {/* US Decision Signal */}
            {!loading && usDecision && (
                <div className="bg-[#1c1c1e] border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">US Decision Signal</p>
                        <Link href="/dashboard/us/signals" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                            Details &rarr;
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`text-2xl font-black ${
                            usDecision.action === 'STRONG_BUY' ? 'text-green-400' :
                            usDecision.action === 'BUY' ? 'text-emerald-400' :
                            usDecision.action === 'NEUTRAL' ? 'text-yellow-400' :
                            usDecision.action === 'CAUTIOUS' ? 'text-orange-400' : 'text-red-400'
                        }`}>
                            {usDecision.action?.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-gray-500">Score: {usDecision.score}</span>
                        {usDecision.timing && (
                            <span className="text-xs text-gray-600 ml-auto">{usDecision.timing}</span>
                        )}
                    </div>
                    {usDecision.top_picks && usDecision.top_picks.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {usDecision.top_picks.slice(0, 5).map((p: any, i: number) => (
                                <span key={i} className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded">
                                    {p.ticker} <span className="text-green-400">+{p.target_upside?.toFixed(0)}%</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Access Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dashboard/kr" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-blue-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <i className="fas fa-chart-line text-blue-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">KR Market</h3>
                            <p className="text-xs text-gray-500">VCP & Institutional Flow</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Today&apos;s Signals</span>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-bold">Live</span>
                    </div>
                </Link>

                <Link href="/dashboard/us" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-green-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <i className="fas fa-globe-americas text-green-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-green-400 transition-colors">US Market</h3>
                            <p className="text-xs text-gray-500">Indices & Sectors</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Market Gate</span>
                        {usDecision && (
                            <span className={`px-2 py-0.5 rounded-full font-bold ${
                                usDecision.action === 'STRONG_BUY' || usDecision.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
                                usDecision.action === 'NEUTRAL' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-orange-500/20 text-orange-400'
                            }`}>
                                {usDecision.action?.replace('_', ' ')}
                            </span>
                        )}
                        {!usDecision && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full font-bold">Live</span>}
                    </div>
                </Link>

                <Link href="/dashboard/skills" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-pink-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center">
                            <i className="fas fa-brain text-pink-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-pink-400 transition-colors">Trading Skills</h3>
                            <p className="text-xs text-gray-500">38 AI Skills Hub</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Market Pulse</span>
                        {overall && (
                            <span className={`px-2 py-0.5 rounded-full font-bold ${signalStyle?.bg?.replace('/10', '/20')} ${signalStyle?.color}`}>
                                {overall.signal.replace('_', ' ')}
                            </span>
                        )}
                        {!overall && <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded-full font-bold">Hub</span>}
                    </div>
                </Link>

                <Link href="/dashboard/crypto" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-yellow-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                            <i className="fab fa-bitcoin text-yellow-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">Crypto</h3>
                            <p className="text-xs text-gray-500">Top Coins & Sentiment</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">BTC Dominance</span>
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-bold">BTC</span>
                    </div>
                </Link>

                <Link href="/dashboard/economy" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                            <i className="fas fa-chart-bar text-cyan-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">Economy</h3>
                            <p className="text-xs text-gray-500">Yield Curve & VIX</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Fear & Greed</span>
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full font-bold">Macro</span>
                    </div>
                </Link>

                <Link href="/dashboard/data-status" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-gray-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center">
                            <i className="fas fa-database text-gray-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-gray-300 transition-colors">System</h3>
                            <p className="text-xs text-gray-500">Data Health</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">File Integrity</span>
                        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded-full font-bold">Check</span>
                    </div>
                </Link>
            </div>
        </div>
    );
}

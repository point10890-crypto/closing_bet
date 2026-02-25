'use client';

import { useEffect, useState } from 'react';
import { usAPI } from '@/lib/api';
import HelpButton from '@/components/ui/HelpButton';

interface SectorProfile {
    avg_beat_reaction_1d: number;
    avg_miss_reaction_1d: number;
    avg_beat_reaction_5d: number;
    avg_miss_reaction_5d: number;
    beat_rate: number;
    sample_size: number;
}

interface Surprise {
    date: string;
    estimate: number;
    actual: number;
    surprise_pct: number;
}

interface UpcomingEarning {
    ticker: string;
    date: string;
    days_left: number;
    revenue_growth: number;
    avg_surprise_pct: number;
    surprises: Surprise[];
}

interface TickerDetail {
    ticker: string;
    next_earnings_date: string;
    avg_surprise_pct: number;
    surprises: Surprise[];
    revenue_growth: number;
}

interface EarningsData {
    sector_profiles: Record<string, SectorProfile>;
    upcoming_earnings: UpcomingEarning[];
    details: Record<string, TickerDetail>;
    timestamp?: string;
    transcript_metadata?: { ticker_count?: number; transcripts_found?: number };
}

export default function EarningsStrategy() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<EarningsData | null>(null);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'all'>('upcoming');

    useEffect(() => {
        usAPI.getEarningsImpact()
            .then(d => setData(d as unknown as EarningsData))
            .catch(() => null)
            .finally(() => setLoading(false));
    }, []);

    const getReactionColor = (val: number) => {
        if (val > 3) return 'text-emerald-400';
        if (val > 0) return 'text-emerald-400/70';
        if (val > -3) return 'text-red-400/70';
        return 'text-red-400';
    };

    const getDaysColor = (days: number) => {
        if (days <= 0) return 'bg-red-500/20 text-red-400 border-red-500/30';
        if (days <= 3) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        if (days <= 7) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
    };

    const getDaysLabel = (days: number) => {
        if (days <= 0) return 'TODAY';
        return `D-${days}`;
    };

    const getGrowthColor = (val: number) => {
        if (val > 0.1) return 'text-emerald-400';
        if (val > 0) return 'text-emerald-400/70';
        if (val > -0.05) return 'text-yellow-400';
        return 'text-red-400';
    };

    const sectorProfiles = data?.sector_profiles
        ? Object.entries(data.sector_profiles).sort((a, b) => b[1].sample_size - a[1].sample_size)
        : [];

    const allDetails = data?.details
        ? Object.values(data.details).sort((a, b) => {
            const da = a.next_earnings_date || '9999';
            const db = b.next_earnings_date || '9999';
            return da.localeCompare(db);
        })
        : [];

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pink-500/20 bg-pink-500/5 text-xs text-pink-400 font-medium mb-4">
                    <i className="fas fa-chart-column"></i>
                    Earnings Strategy
                </div>
                <div className="flex items-center gap-3">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                        Earnings <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">Impact</span>
                    </h2>
                    <HelpButton title="Earnings Impact 가이드" sections={[
                        { heading: '작동 원리', body: 'S&P 500 / NASDAQ 100 종목의 최근 실적 발표 데이터를 수집하여 섹터별 실적 반응 프로파일을 생성합니다.\n\n• Beat Rate: 해당 섹터에서 컨센서스를 상회한 비율\n• Beat/Miss 1D: 실적 발표 당일 주가 반응 평균\n• Beat/Miss 5D: 실적 발표 후 5일간 주가 반응 평균' },
                        { heading: '해석 방법', body: '• Beat Rate 70%+ 섹터: 실적 시즌에 롱 바이어스 유리\n• Beat 5D > Beat 1D: 실적 서프라이즈 후 추격 매수(Post-Earnings Drift) 유효\n• Miss 1D가 작은 섹터: 실적 미스 시 리스크 관리 유리' },
                        { heading: '활용 팁', body: '• Upcoming Earnings에서 D-3 이내 종목은 포지션 조정 고려\n• Revenue Growth가 높은 종목은 Beat 시 반응 확대 기대\n• Pre-Earnings Momentum: 발표 7-14일 전 기관 매집 + 높은 Beat Rate 섹터 주목' },
                    ]} />
                </div>
                <p className="text-gray-400 text-lg">섹터별 실적 반응 프로파일 & 어닝 캘린더</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">Tracked Tickers</div>
                    <div className="text-2xl font-black text-white">{allDetails.length}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">Upcoming (30d)</div>
                    <div className="text-2xl font-black text-amber-400">{data?.upcoming_earnings?.length || 0}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">Sectors Profiled</div>
                    <div className="text-2xl font-black text-pink-400">{sectorProfiles.length}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">Reporting Today</div>
                    <div className="text-2xl font-black text-red-400">
                        {data?.upcoming_earnings?.filter(e => e.days_left <= 0).length || 0}
                    </div>
                </div>
            </div>

            {/* Sector Profiles */}
            {sectorProfiles.length > 0 && (
                <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                        <i className="fas fa-industry text-pink-500"></i>
                        Sector Earnings Profiles
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-3 text-gray-500 font-medium">Sector</th>
                                    <th className="text-center py-3 px-3 text-gray-500 font-medium">Beat Rate</th>
                                    <th className="text-center py-3 px-3 text-emerald-500/70 font-medium">Beat 1D</th>
                                    <th className="text-center py-3 px-3 text-emerald-500/70 font-medium">Beat 5D</th>
                                    <th className="text-center py-3 px-3 text-red-500/70 font-medium">Miss 1D</th>
                                    <th className="text-center py-3 px-3 text-red-500/70 font-medium">Miss 5D</th>
                                    <th className="text-center py-3 px-3 text-gray-500 font-medium">Samples</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sectorProfiles.map(([sector, profile]) => (
                                    <tr key={sector} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-3 font-bold text-white">{sector}</td>
                                        <td className="py-3 px-3 text-center">
                                            <div className="inline-flex items-center gap-2">
                                                <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${profile.beat_rate >= 50 ? 'bg-emerald-400' : 'bg-yellow-400'}`}
                                                        style={{ width: `${Math.min(profile.beat_rate, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`font-bold text-xs ${profile.beat_rate >= 50 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                                    {profile.beat_rate.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`py-3 px-3 text-center font-bold ${getReactionColor(profile.avg_beat_reaction_1d)}`}>
                                            {profile.avg_beat_reaction_1d > 0 ? '+' : ''}{profile.avg_beat_reaction_1d.toFixed(2)}%
                                        </td>
                                        <td className={`py-3 px-3 text-center font-bold ${getReactionColor(profile.avg_beat_reaction_5d)}`}>
                                            {profile.avg_beat_reaction_5d > 0 ? '+' : ''}{profile.avg_beat_reaction_5d.toFixed(2)}%
                                        </td>
                                        <td className={`py-3 px-3 text-center font-bold ${getReactionColor(profile.avg_miss_reaction_1d)}`}>
                                            {profile.avg_miss_reaction_1d > 0 ? '+' : ''}{profile.avg_miss_reaction_1d.toFixed(2)}%
                                        </td>
                                        <td className={`py-3 px-3 text-center font-bold ${getReactionColor(profile.avg_miss_reaction_5d)}`}>
                                            {profile.avg_miss_reaction_5d > 0 ? '+' : ''}{profile.avg_miss_reaction_5d.toFixed(2)}%
                                        </td>
                                        <td className="py-3 px-3 text-center text-gray-500">{profile.sample_size}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Visual Comparison Bars */}
                    <div className="mt-6 space-y-3">
                        <h4 className="text-xs text-gray-500 font-bold uppercase tracking-wider">Beat vs Miss Reaction (1-Day)</h4>
                        {sectorProfiles.map(([sector, profile]) => (
                            <div key={sector} className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 w-24 truncate">{sector}</span>
                                <div className="flex-1 flex items-center">
                                    <div className="flex-1 flex justify-end">
                                        <div
                                            className="h-5 bg-gradient-to-l from-red-500/50 to-red-500/20 rounded-l-sm"
                                            style={{ width: `${Math.min(Math.abs(profile.avg_miss_reaction_1d) * 8, 100)}%` }}
                                        />
                                    </div>
                                    <div className="w-px h-7 bg-white/30" />
                                    <div className="flex-1">
                                        <div
                                            className="h-5 bg-gradient-to-r from-emerald-500/50 to-emerald-500/20 rounded-r-sm"
                                            style={{ width: `${Math.min(profile.avg_beat_reaction_1d * 8, 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="w-28 text-right">
                                    <span className="text-[10px] text-red-400">{profile.avg_miss_reaction_1d.toFixed(1)}%</span>
                                    <span className="text-[10px] text-gray-600 mx-1">|</span>
                                    <span className="text-[10px] text-emerald-400">+{profile.avg_beat_reaction_1d.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Earnings Calendar — Tabs */}
            <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                        <i className="fas fa-calendar-check text-amber-500"></i>
                        Earnings Calendar
                    </h3>
                    <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'upcoming' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Upcoming ({data?.upcoming_earnings?.length || 0})
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'all' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            All Tracked ({allDetails.length})
                        </button>
                    </div>
                </div>

                {activeTab === 'upcoming' ? (
                    data?.upcoming_earnings && data.upcoming_earnings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.upcoming_earnings.map((earn) => (
                                <div key={earn.ticker} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-amber-500/30 transition-all group">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                                            {earn.ticker}
                                        </span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getDaysColor(earn.days_left)}`}>
                                            {getDaysLabel(earn.days_left)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mb-3">
                                        <i className="fas fa-calendar-day mr-1.5"></i>
                                        {earn.date}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-[10px] text-gray-600 uppercase tracking-wider">Revenue Growth</div>
                                            <div className={`text-sm font-bold ${getGrowthColor(earn.revenue_growth)}`}>
                                                {earn.revenue_growth >= 0 ? '+' : ''}{(earn.revenue_growth * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-600 uppercase tracking-wider">Avg Surprise</div>
                                            <div className={`text-sm font-bold ${earn.avg_surprise_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {earn.avg_surprise_pct >= 0 ? '+' : ''}{earn.avg_surprise_pct.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini surprise history */}
                                    {earn.surprises && earn.surprises.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-white/5">
                                            <div className="text-[10px] text-gray-600 mb-1.5">Recent EPS History</div>
                                            <div className="flex gap-1.5">
                                                {earn.surprises.slice(0, 4).map((s, i) => (
                                                    <div key={i} className="flex-1 text-center">
                                                        <div className={`text-[9px] font-bold ${s.surprise_pct > 0 ? 'text-emerald-400' : s.surprise_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                            {s.surprise_pct > 0 ? '+' : ''}{s.surprise_pct.toFixed(0)}%
                                                        </div>
                                                        <div className="text-[8px] text-gray-600 mt-0.5">
                                                            {s.date.slice(5, 7)}/{s.date.slice(2, 4)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <i className="fas fa-calendar-check text-3xl text-gray-600 mb-3"></i>
                            <p className="text-sm text-gray-500">현재 30일 내 실적 발표 예정 종목이 없습니다.</p>
                        </div>
                    )
                ) : (
                    /* All Tracked Tickers Table */
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-2 px-3 text-gray-500 text-xs font-medium">Ticker</th>
                                    <th className="text-center py-2 px-3 text-gray-500 text-xs font-medium">Next Earnings</th>
                                    <th className="text-center py-2 px-3 text-gray-500 text-xs font-medium">Rev Growth</th>
                                    <th className="text-center py-2 px-3 text-gray-500 text-xs font-medium">Avg Surprise</th>
                                    <th className="text-center py-2 px-3 text-gray-500 text-xs font-medium">Q1</th>
                                    <th className="text-center py-2 px-3 text-gray-500 text-xs font-medium">Q2</th>
                                    <th className="text-center py-2 px-3 text-gray-500 text-xs font-medium">Q3</th>
                                    <th className="text-center py-2 px-3 text-gray-500 text-xs font-medium">Q4</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allDetails.map(detail => (
                                    <tr key={detail.ticker} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-white">{detail.ticker}</td>
                                        <td className="py-2.5 px-3 text-center text-gray-400 text-xs">{detail.next_earnings_date || '—'}</td>
                                        <td className={`py-2.5 px-3 text-center font-bold text-xs ${getGrowthColor(detail.revenue_growth)}`}>
                                            {detail.revenue_growth !== 0 ? `${detail.revenue_growth >= 0 ? '+' : ''}${(detail.revenue_growth * 100).toFixed(1)}%` : '—'}
                                        </td>
                                        <td className={`py-2.5 px-3 text-center font-bold text-xs ${detail.avg_surprise_pct >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                            {detail.avg_surprise_pct !== 0 ? `${detail.avg_surprise_pct >= 0 ? '+' : ''}${detail.avg_surprise_pct.toFixed(1)}%` : '—'}
                                        </td>
                                        {detail.surprises.slice(0, 4).map((s, i) => (
                                            <td key={i} className={`py-2.5 px-3 text-center text-xs font-bold ${s.surprise_pct > 0 ? 'text-emerald-400' : s.surprise_pct < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {s.surprise_pct !== 0 ? `${s.surprise_pct > 0 ? '+' : ''}${s.surprise_pct.toFixed(0)}%` : '—'}
                                            </td>
                                        ))}
                                        {Array.from({ length: Math.max(0, 4 - detail.surprises.length) }).map((_, i) => (
                                            <td key={`empty-${i}`} className="py-2.5 px-3 text-center text-xs text-gray-600">—</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Strategy Guide Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-emerald-500/10">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
                        <i className="fas fa-arrow-trend-up text-emerald-400"></i>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2">Pre-Earnings Momentum</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                        실적 발표 7-14일 전, 기관 매집 + 높은 Beat Rate 섹터의 종목에 포지션 진입.
                        Historical avg move 대비 implied move가 낮으면 기대감 선반영이 덜 된 상태.
                    </p>
                </div>
                <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-blue-500/10">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                        <i className="fas fa-chart-line text-blue-400"></i>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2">Post-Earnings Drift</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                        실적 발표 후 5일간 반응 방향이 유지되는 경향. Beat 5D 반응이 1D보다 큰 섹터에서
                        실적 서프라이즈 후 추격 매수 전략 유효.
                    </p>
                </div>
                <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-purple-500/10">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                        <i className="fas fa-shield-halved text-purple-400"></i>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2">Sector-Based Positioning</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                        Beat Rate가 높은 섹터는 롱 바이어스, 낮은 섹터는 보수적 접근.
                        Miss 시 반응이 작은 섹터(예: Financials)는 리스크 관리에 유리.
                    </p>
                </div>
            </div>
        </div>
    );
}

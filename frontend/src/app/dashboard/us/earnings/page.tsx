'use client';

import { useEffect, useState } from 'react';
import { usAPI, EarningsImpactData } from '@/lib/api';
import HelpButton from '@/components/ui/HelpButton';

export default function EarningsStrategy() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<EarningsImpactData | null>(null);

    useEffect(() => {
        usAPI.getEarningsImpact()
            .then(setData)
            .catch(() => null)
            .finally(() => setLoading(false));
    }, []);

    const getReactionColor = (val: number) => {
        if (val > 3) return 'text-green-400';
        if (val > 0) return 'text-green-400/70';
        if (val > -3) return 'text-red-400/70';
        return 'text-red-400';
    };

    const sectorProfiles = data?.sector_profiles
        ? Object.entries(data.sector_profiles).sort((a, b) => b[1].sample_size - a[1].sample_size)
        : [];

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
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
                        { heading: '해석 방법', body: '• Beat Rate 70%+ 섹터: 실적 시즌에 롱 바이어스 유리\n• Beat 5D > Beat 1D: 실적 서프라이즈 후 추격 매수(Post-Earnings Drift) 유효\n• Miss 1D가 작은 섹터: 실적 미스 시 리스크 관리 유리\n• Implied Move vs Historical Avg: 옵션 시장 기대 대비 실제 움직임 비교' },
                        { heading: '활용 팁', body: '• Upcoming Earnings에서 D-3 이내 종목은 포지션 조정 고려\n• Implied Move < Historical Avg인 경우 기대감 선반영이 덜 된 상태\n• Pre-Earnings Momentum: 발표 7-14일 전 기관 매집 + 높은 Beat Rate 섹터 주목\n• 비주얼 바 차트에서 Beat/Miss 반응 비대칭성을 확인하세요' },
                    ]} />
                </div>
                <p className="text-gray-400 text-lg">섹터별 실적 반응 프로파일 & 어닝 전략</p>
            </div>

            {/* Sector Profiles Table */}
            {sectorProfiles.length > 0 ? (
                <div className="p-4 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
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
                                    <th className="text-center py-3 px-3 text-green-500/70 font-medium">Beat 1D</th>
                                    <th className="text-center py-3 px-3 text-green-500/70 font-medium">Beat 5D</th>
                                    <th className="text-center py-3 px-3 text-red-500/70 font-medium">Miss 1D</th>
                                    <th className="text-center py-3 px-3 text-red-500/70 font-medium">Miss 5D</th>
                                    <th className="text-center py-3 px-3 text-gray-500 font-medium">Samples</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sectorProfiles.map(([sector, profile]) => (
                                    <tr key={sector} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-3 px-3 font-bold text-white">{sector}</td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`font-bold ${profile.beat_rate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {profile.beat_rate.toFixed(1)}%
                                            </span>
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
                                    {/* Miss bar (left, red) */}
                                    <div className="flex-1 flex justify-end">
                                        <div
                                            className="h-4 bg-red-500/40 rounded-l-sm"
                                            style={{ width: `${Math.min(Math.abs(profile.avg_miss_reaction_1d) * 8, 100)}%` }}
                                        />
                                    </div>
                                    <div className="w-px h-6 bg-white/20" />
                                    {/* Beat bar (right, green) */}
                                    <div className="flex-1">
                                        <div
                                            className="h-4 bg-green-500/40 rounded-r-sm"
                                            style={{ width: `${Math.min(profile.avg_beat_reaction_1d * 8, 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="w-24 text-right">
                                    <span className="text-[10px] text-red-400">{profile.avg_miss_reaction_1d.toFixed(1)}%</span>
                                    <span className="text-[10px] text-gray-600 mx-1">/</span>
                                    <span className="text-[10px] text-green-400">+{profile.avg_beat_reaction_1d.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <i className="fas fa-calendar-times text-3xl text-gray-600 mb-4"></i>
                    <p className="text-gray-500">No sector profile data available.</p>
                </div>
            )}

            {/* Upcoming Earnings */}
            <div className="p-4 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                    <i className="fas fa-calendar-check text-amber-500"></i>
                    Upcoming Earnings
                </h3>
                {data?.upcoming_earnings && data.upcoming_earnings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.upcoming_earnings.map((earn, i) => (
                            <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-lg font-black text-white">{earn.ticker}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${earn.days_until <= 3 ? 'bg-red-500/20 text-red-400' : earn.days_until <= 7 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                        D-{earn.days_until}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mb-2">{earn.sector} | {earn.earnings_date}</div>
                                <div className="flex items-center gap-4 text-xs">
                                    {earn.implied_move_pct !== null && (
                                        <span className="text-gray-400">Implied: <span className="text-white font-bold">{earn.implied_move_pct.toFixed(1)}%</span></span>
                                    )}
                                    <span className="text-gray-400">Hist Avg: <span className="text-white font-bold">{earn.historical_avg_move.toFixed(1)}%</span></span>
                                </div>
                                <div className="mt-2 text-xs text-gray-400">{earn.recommendation_ko}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <i className="fas fa-inbox text-2xl text-gray-600 mb-3"></i>
                        <p className="text-sm text-gray-500">현재 추적 중인 다가오는 실적 발표가 없습니다.</p>
                        <p className="text-xs text-gray-600 mt-1">Smart Money 종목의 실적 발표일이 가까워지면 여기에 표시됩니다.</p>
                    </div>
                )}
            </div>

            {/* Strategy Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-green-500/10">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
                        <i className="fas fa-arrow-trend-up text-green-400"></i>
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

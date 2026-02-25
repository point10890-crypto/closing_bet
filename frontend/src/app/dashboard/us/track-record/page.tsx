'use client';

import { useEffect, useState, useCallback } from 'react';
import { usAPI } from '@/lib/api';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface TrackRecordSummary {
    total_picks: number;
    unique_tickers: number;
    snapshots: number;
    tracking_period: string;
    win_rate: number;
    avg_return: number;
    avg_alpha: number;
    max_gain: { pct: number; ticker: string } | null;
    max_loss: { pct: number; ticker: string } | null;
    total_winners: number;
    total_losers: number;
}

interface SnapshotResult {
    date: string;
    picks_count: number;
    avg_return: number;
    spy_return: number;
    alpha: number;
    win_rate: number;
    win_count: number;
    loss_count: number;
}

interface PickResult {
    ticker: string;
    name: string;
    sector: string;
    snapshot_date: string;
    entry_price: number;
    current_price: number;
    return_pct: number;
    spy_return_pct: number;
    alpha: number;
    composite_score: number;
    grade: string;
    signal: string;
    rsi: number;
}

interface GradeStats {
    count: number;
    win_rate: number;
    avg_return: number;
    avg_alpha: number;
}

interface TrackRecordData {
    generated_at: string;
    summary: TrackRecordSummary;
    snapshots: SnapshotResult[];
    picks: PickResult[];
    by_grade: Record<string, GradeStats>;
    by_sector: Record<string, GradeStats>;
}

export default function TrackRecordPage() {
    const [data, setData] = useState<TrackRecordData | null>(null);
    const [loading, setLoading] = useState(true);
    const [pickFilter, setPickFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
    const [sortBy, setSortBy] = useState<'return' | 'alpha' | 'score'>('return');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await usAPI.getTrackRecord();
            if (!result.error) setData(result);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    const silentRefresh = useCallback(async () => {
        try {
            const result = await usAPI.getTrackRecord();
            if (!result.error) setData(result);
        } catch { /* silent */ }
    }, []);
    useAutoRefresh(silentRefresh, 60000);

    const filteredPicks = data?.picks
        ? data.picks.filter(p => {
            if (pickFilter === 'WIN') return p.return_pct > 0;
            if (pickFilter === 'LOSS') return p.return_pct <= 0;
            return true;
        }).sort((a, b) => {
            if (sortBy === 'alpha') return b.alpha - a.alpha;
            if (sortBy === 'score') return b.composite_score - a.composite_score;
            return b.return_pct - a.return_pct;
        })
        : [];

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="w-12 h-12 border-4 border-t-amber-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-20 text-gray-500">
                <p className="text-lg mb-2">No track record data available</p>
                <p className="text-sm">Run <code className="bg-gray-800 px-2 py-1 rounded">performance_tracker.py</code> to generate data.</p>
            </div>
        );
    }

    const s = data.summary;

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    Performance Tracker
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                    Track <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Record</span>
                </h2>
                <p className="text-gray-400 text-lg">US Smart Money Screener Historical Performance</p>
                {s.tracking_period && (
                    <p className="text-xs text-gray-500 mt-1">Tracking: {s.tracking_period}</p>
                )}
            </div>

            {/* Stats Cards - Mobile 2x4, Tablet 4x2, Desktop 8x1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
                <StatCard label="Total Picks" value={s.total_picks.toString()} />
                <StatCard label="Unique Tickers" value={s.unique_tickers.toString()} />
                <StatCard label="Win Rate" value={`${s.win_rate}%`} color={s.win_rate >= 50 ? 'green' : 'yellow'} />
                <StatCard label="Avg Return" value={`${s.avg_return >= 0 ? '+' : ''}${s.avg_return}%`} color={s.avg_return >= 0 ? 'green' : 'red'} />
                <StatCard label="Alpha vs SPY" value={`${s.avg_alpha >= 0 ? '+' : ''}${s.avg_alpha}%`} color={s.avg_alpha >= 0 ? 'green' : 'red'} />
                <StatCard label="Max Gain" value={s.max_gain ? `+${s.max_gain.pct}%` : '-'} sub={s.max_gain?.ticker || ''} color="green" />
                <StatCard label="Max Loss" value={s.max_loss ? `${s.max_loss.pct}%` : '-'} sub={s.max_loss?.ticker || ''} color="red" />
                <StatCard label="Snapshots" value={s.snapshots.toString()} />
            </div>

            {/* Snapshot Performance */}
            {data.snapshots.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                        <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                        Performance by Snapshot Date
                    </h3>
                    <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-black/20">
                                <tr className="text-[10px] text-gray-500 border-b border-white/5 uppercase tracking-wider">
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold text-center">Picks</th>
                                    <th className="px-4 py-3 font-semibold text-right">Avg Return</th>
                                    <th className="px-4 py-3 font-semibold text-right">SPY Return</th>
                                    <th className="px-4 py-3 font-semibold text-right">Alpha</th>
                                    <th className="px-4 py-3 font-semibold text-center">Win Rate</th>
                                    <th className="px-4 py-3 font-semibold text-center">W / L</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {data.snapshots.map((snap) => (
                                    <tr key={snap.date} className="hover:bg-white/5">
                                        <td className="px-4 py-2.5 text-white font-mono text-xs">{snap.date}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{snap.picks_count}</td>
                                        <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${snap.avg_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {snap.avg_return >= 0 ? '+' : ''}{snap.avg_return}%
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-mono text-xs ${snap.spy_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {snap.spy_return >= 0 ? '+' : ''}{snap.spy_return}%
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${snap.alpha >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {snap.alpha >= 0 ? '+' : ''}{snap.alpha}%
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">{snap.win_rate}%</td>
                                        <td className="px-4 py-2.5 text-center text-xs">
                                            <span className="text-green-400">{snap.win_count}W</span>
                                            <span className="text-gray-600 mx-1">/</span>
                                            <span className="text-red-400">{snap.loss_count}L</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Grade Performance */}
            {Object.keys(data.by_grade).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                            By Grade
                        </h3>
                        <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-black/20">
                                    <tr className="text-[10px] text-gray-500 border-b border-white/5 uppercase">
                                        <th className="px-4 py-2 font-semibold">Grade</th>
                                        <th className="px-4 py-2 font-semibold text-center">Count</th>
                                        <th className="px-4 py-2 font-semibold text-center">Win Rate</th>
                                        <th className="px-4 py-2 font-semibold text-right">Avg Return</th>
                                        <th className="px-4 py-2 font-semibold text-right">Avg Alpha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {Object.entries(data.by_grade)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([grade, gs]) => (
                                            <tr key={grade} className="hover:bg-white/5">
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${grade === 'S' ? 'bg-amber-500/20 text-amber-400' : grade === 'A' ? 'bg-green-500/20 text-green-400' : grade === 'B' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                        {grade}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-center text-xs text-gray-400">{gs.count}</td>
                                                <td className="px-4 py-2 text-center text-xs text-gray-400">{gs.win_rate}%</td>
                                                <td className={`px-4 py-2 text-right font-mono text-xs ${gs.avg_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>{gs.avg_return >= 0 ? '+' : ''}{gs.avg_return}%</td>
                                                <td className={`px-4 py-2 text-right font-mono text-xs ${gs.avg_alpha >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{gs.avg_alpha >= 0 ? '+' : ''}{gs.avg_alpha}%</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Sector Performance */}
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <span className="w-1 h-5 bg-cyan-500 rounded-full"></span>
                            By Sector
                        </h3>
                        <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-black/20">
                                    <tr className="text-[10px] text-gray-500 border-b border-white/5 uppercase">
                                        <th className="px-4 py-2 font-semibold">Sector</th>
                                        <th className="px-4 py-2 font-semibold text-center">Count</th>
                                        <th className="px-4 py-2 font-semibold text-center">Win Rate</th>
                                        <th className="px-4 py-2 font-semibold text-right">Avg Return</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {Object.entries(data.by_sector)
                                        .sort(([, a], [, b]) => b.avg_return - a.avg_return)
                                        .map(([sector, ss]) => (
                                            <tr key={sector} className="hover:bg-white/5">
                                                <td className="px-4 py-2 text-white text-xs">{sector}</td>
                                                <td className="px-4 py-2 text-center text-xs text-gray-400">{ss.count}</td>
                                                <td className="px-4 py-2 text-center text-xs text-gray-400">{ss.win_rate}%</td>
                                                <td className={`px-4 py-2 text-right font-mono text-xs ${ss.avg_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>{ss.avg_return >= 0 ? '+' : ''}{ss.avg_return}%</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Picks */}
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
                        Individual Picks
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">{filteredPicks.length}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="flex rounded-lg overflow-hidden border border-white/10">
                            {(['ALL', 'WIN', 'LOSS'] as const).map(f => (
                                <button key={f} onClick={() => setPickFilter(f)}
                                    className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${pickFilter === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                                    {f}
                                </button>
                            ))}
                        </div>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'return' | 'alpha' | 'score')}
                            className="bg-[#1c1c1e] border border-white/10 text-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none">
                            <option value="return">Return</option>
                            <option value="alpha">Alpha</option>
                            <option value="score">Score</option>
                        </select>
                    </div>
                </div>
                <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-black/20">
                                <tr className="text-[10px] text-gray-500 border-b border-white/5 uppercase tracking-wider">
                                    <th className="px-2 sm:px-4 py-3 font-semibold">#</th>
                                    <th className="px-2 sm:px-4 py-3 font-semibold">Ticker</th>
                                    <th className="hidden md:table-cell px-4 py-3 font-semibold">Name</th>
                                    <th className="hidden lg:table-cell px-4 py-3 font-semibold">Sector</th>
                                    <th className="px-2 sm:px-4 py-3 font-semibold text-center">Grade</th>
                                    <th className="px-2 sm:px-4 py-3 font-semibold text-center">Score</th>
                                    <th className="hidden sm:table-cell px-4 py-3 font-semibold">Date</th>
                                    <th className="px-2 sm:px-4 py-3 font-semibold text-right">Entry</th>
                                    <th className="px-2 sm:px-4 py-3 font-semibold text-right">Current</th>
                                    <th className="px-2 sm:px-4 py-3 font-semibold text-right">Return</th>
                                    <th className="px-2 sm:px-4 py-3 font-semibold text-right">Alpha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {filteredPicks.slice(0, 50).map((p, idx) => (
                                    <tr key={`${p.ticker}-${p.snapshot_date}`} className="hover:bg-white/5">
                                        <td className="px-2 sm:px-4 py-2.5 text-gray-500 text-xs">{idx + 1}</td>
                                        <td className="px-2 sm:px-4 py-2.5 text-white font-bold text-xs font-mono">{p.ticker}</td>
                                        <td className="hidden md:table-cell px-4 py-2.5 text-gray-400 text-xs truncate max-w-[150px]">{p.name}</td>
                                        <td className="hidden lg:table-cell px-4 py-2.5 text-gray-500 text-xs truncate max-w-[100px]">{p.sector}</td>
                                        <td className="px-2 sm:px-4 py-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.grade === 'S' ? 'bg-amber-500/20 text-amber-400' : p.grade === 'A' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {p.grade}
                                            </span>
                                        </td>
                                        <td className="px-2 sm:px-4 py-2.5 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">{Math.round(p.composite_score)}</span>
                                        </td>
                                        <td className="hidden sm:table-cell px-4 py-2.5 text-gray-400 text-xs">{p.snapshot_date}</td>
                                        <td className="px-2 sm:px-4 py-2.5 text-right font-mono text-xs text-gray-400">${p.entry_price?.toFixed(2)}</td>
                                        <td className="px-2 sm:px-4 py-2.5 text-right font-mono text-xs text-white">${p.current_price?.toFixed(2)}</td>
                                        <td className={`px-2 sm:px-4 py-2.5 text-right font-mono text-xs font-bold ${p.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {p.return_pct >= 0 ? '+' : ''}{p.return_pct}%
                                        </td>
                                        <td className={`px-2 sm:px-4 py-2.5 text-right font-mono text-xs ${p.alpha >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {p.alpha >= 0 ? '+' : ''}{p.alpha}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500">
                Generated: {data.generated_at ? new Date(data.generated_at).toLocaleString('ko-KR') : '-'}
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
    const colorClass = color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : color === 'yellow' ? 'text-yellow-400' : 'text-white';
    return (
        <div className="rounded-xl bg-[#1c1c1e] border border-white/10 p-3">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
            {sub && <p className="text-[9px] text-gray-500 mt-0.5">{sub}</p>}
        </div>
    );
}

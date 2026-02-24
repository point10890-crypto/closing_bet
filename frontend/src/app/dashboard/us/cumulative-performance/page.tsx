'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usAPI, CumulativePerformanceData, CumulativePerformancePick, CumulativePerformanceByDate } from '@/lib/api';
import type { IChartApi, LineData, Time } from 'lightweight-charts';
import Tip from '@/components/ui/Tip';
import Pagination from '@/components/ui/Pagination';
import ErrorBanner from '@/components/ui/ErrorBanner';

/* ─── Sort helpers ─── */
type PickSortKey = 'ticker' | 'name' | 'rec_date' | 'entry_price' | 'current_price' | 'return_pct' | 'final_score';
type DateSortKey = 'date' | 'num_picks' | 'avg_return' | 'spy_return' | 'alpha' | 'win_rate';
type SortDir = 'asc' | 'desc';
type PickFilter = 'ALL' | 'WIN' | 'LOSS';

/* ─── Tooltip descriptions ─── */
const TIPS: Record<string, string> = {
    // Stat cards
    total_picks:    'Total number of stock recommendations made across all snapshots',
    unique_tickers: 'Number of distinct stocks recommended (some stocks appear in multiple snapshots)',
    win_rate:       'Percentage of picks that are currently profitable (price went up since recommendation)',
    avg_return:     'Average profit/loss across all picks. Positive = making money on average',
    alpha:          'How much our picks beat the S&P 500 (SPY). Positive alpha = outperforming the market',
    max_gain:       'The single best-performing pick across all recommendations',
    max_loss:       'The single worst-performing pick across all recommendations',
    snapshots:      'Number of dates when recommendations were recorded',
    // Chart
    picks_avg:      'Average return of all Smart Money picks recommended on each date',
    spy_line:       'S&P 500 (SPY) return over the same period — the market benchmark',
    // Date table
    date:           'The date when this batch of recommendations was made',
    num_picks:      'How many stocks were recommended on this date',
    date_avg_return:'Average return of picks from this specific date',
    date_spy:       'S&P 500 return since this date — used as a comparison benchmark',
    date_alpha:     'Picks avg return minus SPY return. Positive = beating the market',
    date_win_rate:  'Percentage of picks from this date that are currently profitable',
    // Pick table
    ticker:         'Stock ticker symbol (e.g. AAPL = Apple)',
    name:           'Full company name',
    rec_date:       'Date when this stock was recommended',
    entry_price:    'Stock price at the time of recommendation',
    current_price:  'Most recent closing price',
    return_pct:     'Profit or loss since recommendation. Green = gain, Red = loss',
    final_score:    'AI confidence score at recommendation time. Higher = stronger conviction',
    recommendation: 'AI recommendation type at the time (Buy, Strong Buy, Hold, etc.)',
};

export function PerformanceView() {
    const [data, setData] = useState<CumulativePerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Pick table state
    const [pickSort, setPickSort] = useState<{ key: PickSortKey; dir: SortDir }>({ key: 'return_pct', dir: 'desc' });
    const [pickFilter, setPickFilter] = useState<PickFilter>('ALL');

    // Date table state
    const [dateSort, setDateSort] = useState<{ key: DateSortKey; dir: SortDir }>({ key: 'date', dir: 'desc' });

    // Pagination
    const PAGE_SIZE = 20;
    const [pickPage, setPickPage] = useState(0);
    const [datePage, setDatePage] = useState(0);

    // Chart
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        usAPI.getCumulativePerformance()
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    // Chart tooltip state
    const [chartTooltip, setChartTooltip] = useState<{ date: string; picks: number; spy: number } | null>(null);

    /* ─── Chart (dynamic import: lightweight-charts requires DOM) ─── */
    useEffect(() => {
        if (!data || !chartContainerRef.current) return;

        let cancelled = false;
        let cleanup: (() => void) | undefined;

        (async () => {
            const lc = await import('lightweight-charts');
            if (cancelled || !chartContainerRef.current) return;

            if (chartRef.current) chartRef.current.remove();

            const chart = lc.createChart(chartContainerRef.current, {
                width: chartContainerRef.current.clientWidth,
                height: 400,
                layout: {
                    background: { color: 'transparent' },
                    textColor: '#6b7280',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 11,
                },
                grid: {
                    vertLines: { color: 'rgba(255,255,255,0.04)' },
                    horzLines: { color: 'rgba(255,255,255,0.04)' },
                },
                rightPriceScale: {
                    borderColor: 'rgba(255,255,255,0.06)',
                    scaleMargins: { top: 0.1, bottom: 0.1 },
                },
                timeScale: {
                    borderColor: 'rgba(255,255,255,0.06)',
                    timeVisible: false,
                    rightOffset: 5,
                    barSpacing: 12,
                },
                crosshair: {
                    mode: lc.CrosshairMode.Normal,
                    vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3, labelBackgroundColor: '#2563eb' },
                    horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3, labelBackgroundColor: '#1c1c1e' },
                },
            });
            chartRef.current = chart;

            // Picks — Baseline series (green above 0%, red below)
            const pickLine = chart.addSeries(lc.BaselineSeries, {
                baseValue: { type: 'price', price: 0 },
                topLineColor: '#10b981',
                topFillColor1: 'rgba(16, 185, 129, 0.25)',
                topFillColor2: 'rgba(16, 185, 129, 0.01)',
                bottomLineColor: '#ef4444',
                bottomFillColor1: 'rgba(239, 68, 68, 0.01)',
                bottomFillColor2: 'rgba(239, 68, 68, 0.25)',
                lineWidth: 2,
                priceFormat: { type: 'custom', formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
            });
            const pickData: LineData<Time>[] = (data.chart_data ?? []).map(d => ({
                time: d.date as Time,
                value: d.avg_return,
            }));
            pickLine.setData(pickData);

            // SPY — subtle area series
            const spyLine = chart.addSeries(lc.AreaSeries, {
                lineColor: 'rgba(107, 114, 128, 0.7)',
                topColor: 'rgba(107, 114, 128, 0.08)',
                bottomColor: 'rgba(107, 114, 128, 0.0)',
                lineWidth: 1,
                lineStyle: 2,
                crosshairMarkerVisible: false,
                priceFormat: { type: 'custom', formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
            });
            const spyData: LineData<Time>[] = (data.chart_data ?? []).map(d => ({
                time: d.date as Time,
                value: d.spy_return,
            }));
            spyLine.setData(spyData);

            chart.timeScale().fitContent();

            // Live crosshair tooltip
            chart.subscribeCrosshairMove((param) => {
                if (!param.time || !param.seriesData.size) {
                    setChartTooltip(null);
                    return;
                }
                const pickVal = param.seriesData.get(pickLine);
                const spyVal = param.seriesData.get(spyLine);
                setChartTooltip({
                    date: String(param.time),
                    picks: (pickVal as { value: number })?.value ?? 0,
                    spy: (spyVal as { value: number })?.value ?? 0,
                });
            });

            const handleResize = () => {
                if (chartContainerRef.current) {
                    chart.applyOptions({ width: chartContainerRef.current.clientWidth });
                }
            };
            window.addEventListener('resize', handleResize);
            cleanup = () => {
                window.removeEventListener('resize', handleResize);
                chart.remove();
                chartRef.current = null;
            };
        })();

        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, [data]);

    /* ─── Sort handlers ─── */
    const handlePickSort = useCallback((key: PickSortKey) => {
        setPickSort(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
        setPickPage(0);
    }, []);

    const handleDateSort = useCallback((key: DateSortKey) => {
        setDateSort(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
        setDatePage(0);
    }, []);

    /* ─── Derived data ─── */
    const filteredPicks = data?.picks
        .filter(p => {
            if (pickFilter === 'WIN') return p.return_pct > 0;
            if (pickFilter === 'LOSS') return p.return_pct <= 0;
            return true;
        })
        .sort((a, b) => {
            const k = pickSort.key;
            const dir = pickSort.dir === 'asc' ? 1 : -1;
            if (k === 'ticker' || k === 'name' || k === 'rec_date') {
                return a[k].localeCompare(b[k]) * dir;
            }
            return ((a[k] as number) - (b[k] as number)) * dir;
        }) ?? [];

    const sortedDates = (data?.by_date ?? [])
        .slice()
        .sort((a, b) => {
            const k = dateSort.key;
            const dir = dateSort.dir === 'asc' ? 1 : -1;
            if (k === 'date') return a.date.localeCompare(b.date) * dir;
            return ((a[k] as number) - (b[k] as number)) * dir;
        }) ?? [];

    /* ─── Paginated slices ─── */
    const pickTotalPages = Math.ceil((filteredPicks?.length ?? 0) / PAGE_SIZE);
    const pagedPicks = filteredPicks?.slice(pickPage * PAGE_SIZE, (pickPage + 1) * PAGE_SIZE) ?? [];

    const dateTotalPages = Math.ceil((sortedDates?.length ?? 0) / PAGE_SIZE);
    const pagedDates = sortedDates?.slice(datePage * PAGE_SIZE, (datePage + 1) * PAGE_SIZE) ?? [];

    /* ─── Sub-components ─── */
    const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
        <span className="ml-1 text-[9px]">{!active ? '↕' : dir === 'asc' ? '↑' : '↓'}</span>
    );

    const PickThBtn = ({ column, label, tip, align = 'left' }: { column: PickSortKey; label: string; tip?: string; align?: string }) => (
        <th
            className={`px-3 py-3 text-[10px] uppercase tracking-wider font-bold cursor-pointer hover:text-indigo-400 transition-colors whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'} ${pickSort.key === column ? 'text-indigo-400' : 'text-gray-500'}`}
            onClick={() => handlePickSort(column)}
        >
            <span className="relative group">
                {label}<SortIcon active={pickSort.key === column} dir={pickSort.dir} />
                {tip && <Tip text={tip} />}
            </span>
        </th>
    );

    const DateThBtn = ({ column, label, tip, align = 'left' }: { column: DateSortKey; label: string; tip?: string; align?: string }) => (
        <th
            className={`px-3 py-3 text-[10px] uppercase tracking-wider font-bold cursor-pointer hover:text-indigo-400 transition-colors whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'} ${dateSort.key === column ? 'text-indigo-400' : 'text-gray-500'}`}
            onClick={() => handleDateSort(column)}
        >
            <span className="relative group">
                {label}<SortIcon active={dateSort.key === column} dir={dateSort.dir} />
                {tip && <Tip text={tip} />}
            </span>
        </th>
    );

    /* ─── Render ─── */
    if (loading) return (
        <div className="space-y-6">
            <div className="h-24 rounded-2xl bg-white/5 animate-pulse"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse"></div>
                ))}
            </div>
            <div className="h-[400px] rounded-2xl bg-white/5 animate-pulse"></div>
        </div>
    );

    if (error) return (
        <div className="space-y-6">
            <ErrorBanner message={error} onRetry={() => window.location.reload()} />
        </div>
    );

    if (!data || !data.summary.total_picks) return (
        <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <i className="fas fa-chart-line text-2xl text-indigo-500"></i>
            </div>
            <div className="text-gray-500 text-lg mb-2">No cumulative performance data available</div>
            <div className="text-xs text-gray-600">Run the analysis scripts to generate performance data.</div>
        </div>
    );

    const s = data.summary;

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                    Track Record
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                    Cumulative <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Results</span>
                </h2>
                <p className="text-gray-400">
                    Smart Money picks performance across {s.num_snapshots} snapshots vs SPY benchmark
                </p>
            </div>

            {/* ── Stats Cards (2×4) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Picks" value={s.total_picks} tip={TIPS.total_picks} />
                <StatCard label="Unique Tickers" value={s.unique_tickers} tip={TIPS.unique_tickers} />
                <StatCard
                    label="Win Rate"
                    value={`${s.win_rate}%`}
                    color={s.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}
                    tip={TIPS.win_rate}
                />
                <StatCard
                    label="Avg Return"
                    value={`${s.avg_return > 0 ? '+' : ''}${s.avg_return}%`}
                    color={s.avg_return >= 0 ? 'text-emerald-400' : 'text-red-400'}
                    tip={TIPS.avg_return}
                />
                <StatCard
                    label="Alpha vs SPY"
                    value={`${s.avg_alpha > 0 ? '+' : ''}${s.avg_alpha}%`}
                    color={s.avg_alpha >= 0 ? 'text-blue-400' : 'text-red-400'}
                    tip={TIPS.alpha}
                />
                <StatCard
                    label="Max Gain"
                    value={`+${s.max_gain}%`}
                    color="text-emerald-400"
                    small
                    tip={TIPS.max_gain}
                />
                <StatCard
                    label="Max Loss"
                    value={`${s.max_loss}%`}
                    color="text-red-400"
                    small
                    tip={TIPS.max_loss}
                />
                <StatCard label="Snapshots" value={s.num_snapshots ?? 0} tip={TIPS.snapshots} />
            </div>

            {/* ── Cumulative Return Chart ── */}
            <div className="rounded-2xl bg-gradient-to-b from-[#1c1c1e] to-[#161618] border border-white/10 overflow-hidden">
                {/* Chart header */}
                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-white">Return by Recommendation Date</h2>
                        <p className="text-[10px] text-gray-500 mt-0.5">Green = above 0% (profitable) / Red = below 0% (loss)</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px]">
                        <span className="relative group flex items-center gap-1.5 cursor-help">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500 inline-block" />
                            <span className="text-gray-400">Picks Avg</span>
                            <Tip text={TIPS.picks_avg} />
                        </span>
                        <span className="relative group flex items-center gap-1.5 cursor-help">
                            <span className="w-2.5 h-2.5 rounded-sm bg-gray-500/20 border border-gray-500 border-dashed inline-block" />
                            <span className="text-gray-400">SPY Benchmark</span>
                            <Tip text={TIPS.spy_line} />
                        </span>
                    </div>
                </div>

                {/* Live tooltip overlay */}
                {chartTooltip && (
                    <div className="px-5 flex items-center gap-5 text-[11px] font-mono">
                        <span className="text-gray-500">{chartTooltip.date}</span>
                        <span className={chartTooltip.picks >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            Picks: {chartTooltip.picks > 0 ? '+' : ''}{chartTooltip.picks.toFixed(2)}%
                        </span>
                        <span className="text-gray-400">
                            SPY: {chartTooltip.spy > 0 ? '+' : ''}{chartTooltip.spy.toFixed(2)}%
                        </span>
                        <span className={`font-bold ${chartTooltip.picks - chartTooltip.spy >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                            Alpha: {(chartTooltip.picks - chartTooltip.spy) > 0 ? '+' : ''}{(chartTooltip.picks - chartTooltip.spy).toFixed(2)}%
                        </span>
                    </div>
                )}

                {/* Chart canvas */}
                <div ref={chartContainerRef} className="w-full px-1" />
            </div>

            {/* ── By-Date Summary Table ── */}
            <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                    <h2 className="text-sm font-bold text-white">Performance by Snapshot Date</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white/5">
                            <tr>
                                <DateThBtn column="date" label="Date" tip={TIPS.date} />
                                <DateThBtn column="num_picks" label="# Picks" tip={TIPS.num_picks} align="right" />
                                <DateThBtn column="avg_return" label="Avg Return" tip={TIPS.date_avg_return} align="right" />
                                <DateThBtn column="spy_return" label="SPY" tip={TIPS.date_spy} align="right" />
                                <DateThBtn column="alpha" label="Alpha" tip={TIPS.date_alpha} align="right" />
                                <DateThBtn column="win_rate" label="Win Rate" tip={TIPS.date_win_rate} align="right" />
                            </tr>
                        </thead>
                        <tbody>
                            {pagedDates.map(d => (
                                <tr key={d.date} className="border-b border-white/5 hover:bg-indigo-500/5 transition-colors">
                                    <td className="px-3 py-2.5 font-mono text-gray-300">{d.date}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-400">{d.num_picks}</td>
                                    <td className={`px-3 py-2.5 text-right font-bold ${d.avg_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {d.avg_return > 0 ? '+' : ''}{d.avg_return}%
                                    </td>
                                    <td className={`px-3 py-2.5 text-right ${d.spy_return >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                                        {d.spy_return > 0 ? '+' : ''}{d.spy_return}%
                                    </td>
                                    <td className={`px-3 py-2.5 text-right font-bold ${d.alpha >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                        {d.alpha > 0 ? '+' : ''}{d.alpha}%
                                    </td>
                                    <td className={`px-3 py-2.5 text-right ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {d.win_rate}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {dateTotalPages > 1 && (
                    <Pagination current={datePage} total={dateTotalPages} count={sortedDates.length} pageSize={PAGE_SIZE} onChange={setDatePage} />
                )}
            </div>

            {/* ── Individual Picks Table ── */}
            <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-sm font-bold text-white">Individual Picks</h2>
                    <div className="flex gap-2">
                        {(['ALL', 'WIN', 'LOSS'] as PickFilter[]).map(f => (
                            <button
                                key={f}
                                onClick={() => { setPickFilter(f); setPickPage(0); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pickFilter === f
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {f === 'ALL' ? `All (${data.picks.length})`
                                    : f === 'WIN' ? `Win (${data.picks.filter(p => p.return_pct > 0).length})`
                                    : `Loss (${data.picks.filter(p => p.return_pct <= 0).length})`}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white/5">
                            <tr>
                                <PickThBtn column="ticker" label="Ticker" tip={TIPS.ticker} />
                                <PickThBtn column="name" label="Name" tip={TIPS.name} />
                                <PickThBtn column="rec_date" label="Rec Date" tip={TIPS.rec_date} />
                                <PickThBtn column="entry_price" label="Entry" tip={TIPS.entry_price} align="right" />
                                <PickThBtn column="current_price" label="Current" tip={TIPS.current_price} align="right" />
                                <PickThBtn column="return_pct" label="Return %" tip={TIPS.return_pct} align="right" />
                                <PickThBtn column="final_score" label="Score" tip={TIPS.final_score} align="right" />
                                <th className="px-3 py-3 text-[10px] uppercase tracking-wider font-bold text-gray-500">
                                    <span className="relative group cursor-help">
                                        Rec
                                        <Tip text={TIPS.recommendation} />
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedPicks.map((p, i) => (
                                <tr key={`${p.ticker}-${p.rec_date}-${i}`} className="border-b border-white/5 hover:bg-indigo-500/5 transition-colors">
                                    <td className="px-3 py-2.5 font-bold text-white">{p.ticker}</td>
                                    <td className="px-3 py-2.5 text-gray-400 max-w-[160px] truncate">{p.name}</td>
                                    <td className="px-3 py-2.5 font-mono text-gray-400">{p.rec_date}</td>
                                    <td className="px-3 py-2.5 text-right font-mono text-gray-300">${p.entry_price.toFixed(2)}</td>
                                    <td className="px-3 py-2.5 text-right font-mono text-gray-300">${p.current_price.toFixed(2)}</td>
                                    <td className={`px-3 py-2.5 text-right font-bold font-mono ${p.return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {p.return_pct > 0 ? '+' : ''}{p.return_pct.toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-amber-400">{p.final_score}</td>
                                    <td className="px-3 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            p.recommendation === '매수' || p.recommendation === '적극 매수'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : p.recommendation === '보유'
                                                ? 'bg-amber-500/20 text-amber-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {p.recommendation}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredPicks.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">No picks match the selected filter.</div>
                )}
                {pickTotalPages > 1 && (
                    <Pagination current={pickPage} total={pickTotalPages} count={filteredPicks.length} pageSize={PAGE_SIZE} onChange={setPickPage} />
                )}
            </div>
        </div>
    );
}


/* ─── StatCard ─── */
function StatCard({ label, value, color = 'text-white', small = false, tip }: {
    label: string;
    value: string | number;
    color?: string;
    small?: boolean;
    tip?: string;
}) {
    return (
        <div className="p-3 rounded-xl bg-[#1c1c1e] border border-white/10 relative group cursor-help">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">{label}</div>
            <div className={`${small ? 'text-sm' : 'text-xl'} font-black ${color} font-mono`}>{value}</div>
            {tip && <Tip text={tip} />}
        </div>
    );
}

export default function CumulativePerformancePage() {
    return <PerformanceView />;
}

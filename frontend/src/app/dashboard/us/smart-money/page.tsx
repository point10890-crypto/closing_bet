'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usAPI, SmartMoneyStock } from '@/lib/api';

const StockDetailModal = dynamic(() => import('@/components/us/StockDetailModal'), { ssr: false });
import { PerformanceView } from '../cumulative-performance/page';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import HelpButton from '@/components/ui/HelpButton';

type PageTab = 'picks' | 'performance';
type SortKey = 'composite_score' | 'swing_score' | 'trend_score' | 'price' | 'change_pct' | 'ticker';

const PAGE_SIZE = 20;

export default function SmartMoneyPage() {
    const [pageTab, setPageTab] = useState<PageTab>('picks');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stocks, setStocks] = useState<SmartMoneyStock[]>([]);
    const [sortBy, setSortBy] = useState<SortKey>('composite_score');
    const [sortAsc, setSortAsc] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await usAPI.getSmartMoney();
            setStocks(res.picks || []);
            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch {
            setError('Failed to load Smart Money data.');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortBy === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortBy(key);
            setSortAsc(false);
        }
        setPage(0);
    };

    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(0);
    };

    const filtered = stocks.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.ticker.toLowerCase().includes(q)
            || s.name.toLowerCase().includes(q)
            || s.sector?.toLowerCase().includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
        const aVal = a[sortBy] ?? 0;
        const bVal = b[sortBy] ?? 0;
        if (typeof aVal === 'string') {
            return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
        }
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const getChangeColor = (change: number) => {
        if (change > 0) return 'text-green-400';
        if (change < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    const getGradeColor = (grade: string) => {
        if (grade.includes('A')) return 'bg-green-500/20 text-green-400';
        if (grade.includes('B')) return 'bg-blue-500/20 text-blue-400';
        if (grade.includes('C')) return 'bg-yellow-500/20 text-yellow-400';
        return 'bg-gray-500/20 text-gray-400';
    };

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortBy !== column) return <span className="text-gray-600 ml-1">↕</span>;
        return <span className="text-blue-400 ml-1">{sortAsc ? '↑' : '↓'}</span>;
    };

    const ThButton = ({ column, label, align = 'left' }: { column: SortKey; label: string; align?: string }) => (
        <th
            className={`px-3 py-3 text-[10px] uppercase tracking-wider font-bold cursor-pointer hover:text-blue-400 transition-colors whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'} ${sortBy === column ? 'text-blue-400' : 'text-gray-500'}`}
            onClick={() => handleSort(column)}
        >
            {label}<SortIcon column={column} />
        </th>
    );

    if (pageTab === 'performance') {
        return (
            <div className="space-y-6">
                <div className="flex gap-2">
                    <button onClick={() => setPageTab('picks')}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all">
                        Current Picks
                    </button>
                    <button
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition-all">
                        Track Record
                    </button>
                </div>
                <PerformanceView />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tab Toggle */}
            <div className="flex gap-2">
                <button
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-all">
                    Current Picks
                </button>
                <button onClick={() => setPageTab('performance')}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all">
                    Track Record
                </button>
            </div>

            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-xs text-blue-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                    Institutional Flow
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                                Smart Money <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Top Picks</span>
                            </h2>
                            <HelpButton title="Smart Money 가이드" sections={[
                                { heading: '작동 원리', body: 'S&P 500 + NASDAQ 100 종목 중 기관 매집 신호가 감지된 종목을 스크리닝합니다.\n\n• Composite Score: Swing Score + Trend Score 가중 합산\n• Supply/Demand Stage: OBV(On-Balance Volume) 기반 수급 단계\n  - Strong Accumulation: 기관 강력 매집\n  - Accumulation: 매집 진행 중\n  - Distribution: 매도 압력 우위' },
                                { heading: '점수 해석', body: '• Composite Score 80+: 강력한 기관 매집 + 기술적 강세\n• Swing Score: 단기(2~4주) 스윙 트레이딩 적합도\n• Trend Score: 중장기 추세 강도\n• RSI 30~70: 정상 범위, 70+: 과매수, 30-: 과매도\n• Inst%: 기관 보유 비율 (높을수록 안정적)' },
                                { heading: '활용 팁', body: '• 테이블 헤더를 클릭하면 정렬 가능\n• 종목명을 클릭하면 상세 차트와 분석을 볼 수 있습니다\n• Track Record 탭에서 과거 추천 종목의 수익률을 확인하세요\n• Strong Accumulation + Score 80+ 조합이 가장 신뢰도 높음' },
                            ]} />
                        </div>
                        <p className="text-gray-400">S&P 500 + NASDAQ 100 기관 매집 신호 기반 종목</p>
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

            {/* Error Banner */}
            {error && <ErrorBanner message={error} onRetry={loadData} />}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Picks</div>
                    <div className="text-2xl font-black text-white">{stocks.length}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Avg Score</div>
                    <div className="text-2xl font-black text-blue-400">
                        {stocks.length > 0 ? (stocks.reduce((a, b) => a + (b.composite_score || 0), 0) / stocks.length).toFixed(1) : '--'}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Last Updated</div>
                    <div className="text-2xl font-black text-white">{lastUpdated || '--'}</div>
                </div>
            </div>

            {/* Search */}
            {!loading && stocks.length > 0 && (
                <div className="max-w-sm">
                    <SearchInput value={search} onChange={handleSearch} placeholder="Search ticker, name, sector..." />
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 p-8">
                    <div className="space-y-3">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="h-10 rounded bg-white/5 animate-pulse"></div>
                        ))}
                    </div>
                </div>
            ) : stocks.length === 0 ? (
                !error && (
                    <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <i className="fas fa-chart-pie text-2xl text-blue-500"></i>
                        </div>
                        <div className="text-gray-500 text-lg mb-2">No Smart Money data available</div>
                        <div className="text-xs text-gray-600">Run: python3 us_market/smart_money_screener_v2.py</div>
                    </div>
                )
            ) : (
                <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.02]">
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-center w-10">#</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-center w-16">Grade</th>
                                    <ThButton column="ticker" label="Ticker" />
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-left">Name</th>
                                    <ThButton column="price" label="Price" align="right" />
                                    <ThButton column="change_pct" label="Change" align="right" />
                                    <ThButton column="composite_score" label="Composite" align="right" />
                                    <ThButton column="swing_score" label="Swing" align="right" />
                                    <ThButton column="trend_score" label="Trend" align="right" />
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-left">Sector</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-center">Rec</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((stock, idx) => (
                                    <tr
                                        key={stock.ticker}
                                        onClick={() => setSelectedTicker(stock.ticker)}
                                        className="border-b border-white/5 hover:bg-blue-500/5 cursor-pointer transition-colors"
                                    >
                                        <td className="px-3 py-3 text-xs text-gray-500 font-mono text-center">{page * PAGE_SIZE + idx + 1}</td>
                                        <td className="px-3 py-3 text-center">
                                            {stock.grade && (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getGradeColor(stock.grade)}`}>
                                                    {stock.grade.split(' ')[0]}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-sm font-black text-white">{stock.ticker}</td>
                                        <td className="px-3 py-3 text-xs text-gray-400 max-w-[200px] truncate">{stock.name}</td>
                                        <td className="px-3 py-3 text-sm font-bold text-white text-right">${stock.price?.toFixed(2)}</td>
                                        <td className={`px-3 py-3 text-xs font-bold text-right ${getChangeColor(stock.change_pct)}`}>
                                            {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct?.toFixed(2)}%
                                        </td>
                                        <td className="px-3 py-3 text-sm font-black text-blue-400 text-right">{stock.composite_score?.toFixed(1)}</td>
                                        <td className="px-3 py-3 text-sm text-gray-400 text-right">{stock.swing_score?.toFixed(1)}</td>
                                        <td className="px-3 py-3 text-sm text-gray-400 text-right">{stock.trend_score?.toFixed(1)}</td>
                                        <td className="px-3 py-3">
                                            <span className="px-2 py-1 rounded-full bg-white/5 text-[10px] text-gray-400 font-bold whitespace-nowrap">
                                                {stock.sector || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {stock.recommendation && (
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${stock.recommendation === 'buy' || stock.recommendation === 'strong_buy'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : stock.recommendation === 'hold'
                                                            ? 'bg-yellow-500/20 text-yellow-400'
                                                            : 'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {stock.recommendation.toUpperCase().replace('_', ' ')}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <Pagination
                            current={page}
                            total={totalPages}
                            count={sorted.length}
                            pageSize={PAGE_SIZE}
                            onChange={setPage}
                        />
                    )}
                </div>
            )}

            {/* Stock Detail Modal */}
            {selectedTicker && (
                <StockDetailModal
                    ticker={selectedTicker}
                    onClose={() => setSelectedTicker(null)}
                />
            )}
        </div>
    );
}

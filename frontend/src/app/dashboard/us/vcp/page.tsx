'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const StockDetailModal = dynamic(() => import('@/components/us/StockDetailModal'), { ssr: false });
import SearchInput from '@/components/ui/SearchInput';

interface VCPStock {
    ticker: string;
    name: string;
    sector: string;
    price: number;
    change_pct: number;
    vcp_score: number;
    rs_rating: number;
    fund_score: number;
    stage: string;
    volume_ratio: number;
    pivot_tightness: string;
    vol_dry_up: string;
    contractions: number;
    base_depth: string;
    eps_growth: string;
    breakout: string;
    pivot_price: number;
    score: number;
}

type SortKey = 'score' | 'vcp_score' | 'rs_rating' | 'fund_score' | 'price' | 'contractions' | 'ticker';

export function VCPView() {
    const [loading, setLoading] = useState(true);
    const [stocks, setStocks] = useState<VCPStock[]>([]);
    const [sortBy, setSortBy] = useState<SortKey>('score');
    const [sortAsc, setSortAsc] = useState(false);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/us/super-performance');
            if (res.ok) {
                const data = await res.json();
                setStocks(data.stocks || []);
            }
        } catch (error) {
            console.error('Failed to load VCP:', error);
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
    };

    const filtered = stocks.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    });

    const sortedStocks = [...filtered].sort((a, b) => {
        const aVal = a[sortBy] ?? 0;
        const bVal = b[sortBy] ?? 0;
        if (typeof aVal === 'string') {
            return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
        }
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortBy !== column) return <span className="text-gray-600 ml-1">↕</span>;
        return <span className="text-emerald-400 ml-1">{sortAsc ? '↑' : '↓'}</span>;
    };

    const ThButton = ({ column, label, align = 'left' }: { column: SortKey; label: string; align?: string }) => (
        <th
            className={`px-3 py-3 text-[10px] uppercase tracking-wider font-bold cursor-pointer hover:text-emerald-400 transition-colors whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'} ${sortBy === column ? 'text-emerald-400' : 'text-gray-500'}`}
            onClick={() => handleSort(column)}
        >
            {label}<SortIcon column={column} />
        </th>
    );

    const getStageColor = (stage: string) => {
        if (stage.includes('Pivot')) return 'bg-yellow-500/20 text-yellow-400';
        if (stage.includes('Tightening')) return 'bg-emerald-500/20 text-emerald-400';
        if (stage.includes('Breakout') || stage.includes('Momentum')) return 'bg-blue-500/20 text-blue-400';
        return 'bg-gray-500/20 text-gray-400';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Minervini VCP
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                            Super <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Performance</span>
                        </h2>
                        <p className="text-gray-400">VCP 패턴 + Super Performance 종목</p>
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

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Stocks</div>
                    <div className="text-2xl font-black text-white">{stocks.length}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Breakout Ready</div>
                    <div className="text-2xl font-black text-emerald-400">
                        {stocks.filter(s => s.breakout === 'Yes').length}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-[#1c1c1e] border border-white/10">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Avg VCP Score</div>
                    <div className="text-2xl font-black text-teal-400">
                        {stocks.length > 0 ? (stocks.reduce((a, b) => a + (b.vcp_score || 0), 0) / stocks.length).toFixed(0) : '--'}
                    </div>
                </div>
            </div>

            {/* Search */}
            {!loading && stocks.length > 0 && (
                <div className="max-w-sm">
                    <SearchInput value={search} onChange={setSearch} placeholder="Search ticker or name..." />
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
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <i className="fas fa-rocket text-2xl text-emerald-500"></i>
                    </div>
                    <div className="text-gray-500 text-lg mb-2">No VCP patterns found</div>
                    <div className="text-xs text-gray-600">Run: python3 us_market/super_performance_scanner.py</div>
                </div>
            ) : (
                <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.02]">
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-center w-10">#</th>
                                    <ThButton column="ticker" label="Ticker" />
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-left">Name</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-left">Sector</th>
                                    <ThButton column="price" label="Price" align="right" />
                                    <ThButton column="vcp_score" label="VCP" align="right" />
                                    <ThButton column="rs_rating" label="RS" align="right" />
                                    <ThButton column="fund_score" label="Fund" align="right" />
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-left">Setup</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-right">Tightness</th>
                                    <ThButton column="contractions" label="Contractions" align="right" />
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-right">Base</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-right">EPS</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-center">Vol Dry</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-center">Breakout</th>
                                    <th className="px-3 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold text-right">Pivot</th>
                                    <ThButton column="score" label="Score" align="right" />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStocks.map((stock, idx) => (
                                    <tr
                                        key={stock.ticker}
                                        onClick={() => setSelectedTicker(stock.ticker)}
                                        className={`border-b border-white/5 hover:bg-emerald-500/5 cursor-pointer transition-colors ${stock.breakout === 'Yes' ? 'bg-emerald-500/[0.03]' : ''}`}
                                    >
                                        <td className="px-3 py-3 text-xs text-gray-500 font-mono text-center">{idx + 1}</td>
                                        <td className="px-3 py-3 text-sm font-black text-white">{stock.ticker}</td>
                                        <td className="px-3 py-3 text-xs text-gray-400 max-w-[160px] truncate">{stock.name}</td>
                                        <td className="px-3 py-3">
                                            <span className="px-2 py-1 rounded-full bg-white/5 text-[10px] text-gray-400 font-bold whitespace-nowrap">
                                                {stock.sector || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-sm font-bold text-white text-right">${stock.price?.toFixed(2)}</td>
                                        <td className="px-3 py-3 text-sm font-black text-emerald-400 text-right">{stock.vcp_score}</td>
                                        <td className="px-3 py-3 text-sm text-gray-300 text-right">{stock.rs_rating}</td>
                                        <td className="px-3 py-3 text-sm text-gray-400 text-right">{stock.fund_score}</td>
                                        <td className="px-3 py-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${getStageColor(stock.stage)}`}>
                                                {stock.stage}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-xs text-gray-400 text-right">{stock.pivot_tightness}</td>
                                        <td className="px-3 py-3 text-xs text-gray-400 text-right">{stock.contractions}</td>
                                        <td className="px-3 py-3 text-xs text-gray-400 text-right">{stock.base_depth}</td>
                                        <td className="px-3 py-3 text-xs text-gray-400 text-right">{stock.eps_growth}</td>
                                        <td className="px-3 py-3 text-center">
                                            {stock.vol_dry_up === 'Yes' ? (
                                                <span className="text-emerald-400 text-xs font-bold">Yes</span>
                                            ) : (
                                                <span className="text-gray-600 text-xs">No</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {stock.breakout === 'Yes' ? (
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">YES</span>
                                            ) : (
                                                <span className="text-gray-600 text-xs">No</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-xs text-gray-400 text-right">${stock.pivot_price?.toFixed(2)}</td>
                                        <td className="px-3 py-3 text-sm font-black text-teal-400 text-right">{stock.score?.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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

export default function VCPScannerPage() {
    return <VCPView />;
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { usAPI } from '@/lib/api';

interface HeatmapItem {
    x: string;  // ticker
    y: number;  // market cap / volume
    price: number;
    change: number;
    color: string;
}

interface SectorSeries {
    name: string;
    data: HeatmapItem[];
}

export function HeatmapView() {
    const [loading, setLoading] = useState(true);
    const [sectors, setSectors] = useState<SectorSeries[]>([]);
    const [dataDate, setDataDate] = useState('');
    const [tapped, setTapped] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Use getHeatmapData() which returns {series: SectorSeries[]}
            const res = await usAPI.getHeatmapData();
            const data = res as unknown as { series: SectorSeries[]; data_date?: string; period?: string };
            setSectors(data.series || []);
            if (data.data_date) setDataDate(data.data_date);
        } catch (error) {
            console.error('Failed to load heatmap:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Close tooltip on outside tap (mobile)
    useEffect(() => {
        if (!tapped) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-heatmap-cell]')) {
                setTapped(null);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [tapped]);

    const getChangeColor = (change: number) => {
        if (change >= 3) return 'bg-emerald-500';
        if (change >= 1.5) return 'bg-emerald-500/80';
        if (change >= 0.5) return 'bg-green-500/70';
        if (change >= 0) return 'bg-green-800/40';
        if (change >= -0.5) return 'bg-red-800/40';
        if (change >= -1.5) return 'bg-red-500/70';
        if (change >= -3) return 'bg-red-500/80';
        return 'bg-red-600';
    };

    const getChangeBorder = (change: number) => {
        if (change >= 1.5) return 'border-emerald-400/30';
        if (change >= 0) return 'border-green-400/10';
        if (change >= -1.5) return 'border-red-400/10';
        return 'border-red-400/30';
    };

    // Summary stats
    const allItems = sectors.flatMap(s => s.data);
    const gainers = allItems.filter(i => i.change > 0).length;
    const losers = allItems.filter(i => i.change < 0).length;
    const avgChange = allItems.length > 0 ? allItems.reduce((sum, i) => sum + i.change, 0) / allItems.length : 0;

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 font-medium mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Sector Heatmap
                </div>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-1">
                            Sector <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Heatmap</span>
                        </h2>
                        <p className="text-xs md:text-sm text-gray-500">
                            S&P 500 섹터별 주가 변동 {dataDate && <span className="text-gray-600">({dataDate})</span>}
                        </p>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs md:text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
                        <span className="hidden sm:inline ml-2">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Quick Summary */}
            {!loading && allItems.length > 0 && (
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                    <div className="p-2.5 md:p-3 rounded-xl bg-[#1c1c1e] border border-white/5">
                        <div className="text-[10px] md:text-xs text-gray-500 mb-0.5">Gainers</div>
                        <div className="text-base md:text-xl font-bold text-emerald-400">{gainers}</div>
                    </div>
                    <div className="p-2.5 md:p-3 rounded-xl bg-[#1c1c1e] border border-white/5">
                        <div className="text-[10px] md:text-xs text-gray-500 mb-0.5">Losers</div>
                        <div className="text-base md:text-xl font-bold text-red-400">{losers}</div>
                    </div>
                    <div className="p-2.5 md:p-3 rounded-xl bg-[#1c1c1e] border border-white/5">
                        <div className="text-[10px] md:text-xs text-gray-500 mb-0.5">Avg Change</div>
                        <div className={`text-base md:text-xl font-bold ${avgChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Heatmap Grid */}
            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, si) => (
                        <div key={si} className="space-y-2">
                            <div className="h-4 w-32 rounded bg-white/5 animate-pulse"></div>
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse"></div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : sectors.length === 0 ? (
                <div className="p-8 md:p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <i className="fas fa-th-large text-3xl md:text-4xl text-gray-600 mb-3"></i>
                    <div className="text-gray-500 text-sm md:text-lg">No heatmap data available</div>
                    <div className="text-[10px] md:text-xs text-gray-600 mt-2">데이터 업데이트 후 다시 시도하세요</div>
                </div>
            ) : (
                <div className="space-y-4 md:space-y-5">
                    {sectors.map((sector) => {
                        const sectorAvg = sector.data.length > 0
                            ? sector.data.reduce((s, d) => s + d.change, 0) / sector.data.length
                            : 0;

                        return (
                            <div key={sector.name} className="space-y-1.5 md:space-y-2">
                                {/* Sector Header */}
                                <div className="flex items-center justify-between px-0.5">
                                    <h3 className="text-[11px] md:text-sm font-bold text-gray-300 flex items-center gap-1.5">
                                        <span className="w-1 h-3 md:h-3.5 bg-emerald-500 rounded-full"></span>
                                        {sector.name}
                                        <span className="text-[10px] text-gray-600 font-normal">({sector.data.length})</span>
                                    </h3>
                                    <span className={`text-[10px] md:text-xs font-semibold ${sectorAvg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {sectorAvg >= 0 ? '+' : ''}{sectorAvg.toFixed(2)}%
                                    </span>
                                </div>

                                {/* Stock Cells - 모바일 4열, 태블릿 5열, 데스크탑 8-10열 */}
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1 md:gap-1.5">
                                    {sector.data.map((item) => {
                                        const cellKey = `${sector.name}-${item.x}`;
                                        const isActive = tapped === cellKey;

                                        return (
                                            <div
                                                key={item.x}
                                                data-heatmap-cell
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTapped(isActive ? null : cellKey);
                                                }}
                                                className={`relative rounded-lg ${getChangeColor(item.change)} border ${getChangeBorder(item.change)}
                                                    transition-all duration-150 cursor-pointer
                                                    ${isActive ? 'ring-2 ring-white/50 scale-[1.05] z-10 shadow-lg' : 'active:scale-95 md:hover:scale-[1.03]'}
                                                `}
                                            >
                                                {/* Main content */}
                                                <div className="flex flex-col items-center justify-center py-2.5 md:py-3 px-1">
                                                    <div className="text-[11px] md:text-sm font-black text-white leading-tight">
                                                        {item.x}
                                                    </div>
                                                    <div className="text-[9px] md:text-xs font-bold mt-0.5 text-white/90">
                                                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
                                                    </div>
                                                </div>

                                                {/* Tap / Hover Detail Popup */}
                                                {isActive && (
                                                    <div className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-black/95 rounded-lg text-[10px] shadow-xl z-20 whitespace-nowrap border border-white/15">
                                                        <div className="font-bold text-white">{item.x}</div>
                                                        <div className="text-gray-400">${item.price?.toFixed(2)}</div>
                                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-black/95 border-r border-b border-white/15 rotate-45"></div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Legend - Mobile: wrap, Desktop: single row */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 md:gap-4 pt-2 pb-2">
                {[
                    { color: 'bg-red-600', label: '<-3%' },
                    { color: 'bg-red-500/70', label: '-1.5%' },
                    { color: 'bg-red-800/40', label: '-0.5%' },
                    { color: 'bg-gray-700/40', label: '0%' },
                    { color: 'bg-green-800/40', label: '+0.5%' },
                    { color: 'bg-green-500/70', label: '+1.5%' },
                    { color: 'bg-emerald-500', label: '>+3%' },
                ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1 text-[9px] md:text-xs text-gray-500">
                        <span className={`w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-sm ${color}`}></span>
                        <span>{label}</span>
                    </div>
                ))}
            </div>

            {/* Tap instruction for mobile */}
            <div className="md:hidden text-center text-[10px] text-gray-600 pb-4">
                <i className="fas fa-hand-pointer mr-1"></i>
                종목을 탭하면 가격을 확인할 수 있습니다
            </div>
        </div>
    );
}

export default function SectorHeatmapPage() {
    return <HeatmapView />;
}

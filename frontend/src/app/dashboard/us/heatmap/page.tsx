'use client';

import { useEffect, useState } from 'react';
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
    const [period, setPeriod] = useState('5d');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await usAPI.getHeatmapData();
            const data = res as unknown as { series: SectorSeries[] };
            setSectors(data.series || []);
        } catch (error) {
            console.error('Failed to load heatmap:', error);
        } finally {
            setLoading(false);
        }
    };

    const getChangeColor = (change: number) => {
        if (change >= 2) return 'bg-green-500';
        if (change >= 0.5) return 'bg-green-400/80';
        if (change >= 0) return 'bg-green-400/50';
        if (change >= -0.5) return 'bg-red-400/50';
        if (change >= -2) return 'bg-red-400/80';
        return 'bg-red-500';
    };

    const getTextColor = (change: number) => {
        if (Math.abs(change) >= 0.5) return 'text-white';
        return 'text-gray-300';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Sector Analysis
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                            Sector <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Heatmap</span>
                        </h2>
                        <p className="text-gray-400">S&P 500 섹터별 주가 변동 현황</p>
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

            {/* Heatmap Grid */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-lg bg-white/5 animate-pulse"></div>
                    ))}
                </div>
            ) : sectors.length === 0 ? (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="text-gray-500 text-lg">No heatmap data available</div>
                    <div className="text-xs text-gray-600 mt-2">Run: python3 us_market/sector_heatmap.py</div>
                </div>
            ) : (
                <div className="space-y-6">
                    {sectors.map((sector) => (
                        <div key={sector.name} className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                                <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                                {sector.name}
                                <span className="text-xs text-gray-600 font-normal">({sector.data.length} stocks)</span>
                            </h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                                {sector.data.map((item) => (
                                    <div
                                        key={item.x}
                                        className={`p-3 rounded-lg ${getChangeColor(item.change)} transition-all hover:scale-105 cursor-pointer group relative`}
                                    >
                                        <div className={`text-sm font-black ${getTextColor(item.change)}`}>
                                            {item.x}
                                        </div>
                                        <div className={`text-xs font-bold ${getTextColor(item.change)}`}>
                                            {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                                        </div>
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                            <div className="font-bold text-white">{item.x}</div>
                                            <div className="text-gray-400">${item.price.toFixed(2)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-4">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded bg-red-500"></span>
                    <span>-2%+</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded bg-red-400/80"></span>
                    <span>-0.5%~-2%</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded bg-gray-500/50"></span>
                    <span>Flat</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded bg-green-400/80"></span>
                    <span>+0.5%~+2%</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded bg-green-500"></span>
                    <span>+2%+</span>
                </div>
            </div>
        </div>
    );
}

export default function SectorHeatmapPage() {
    return <HeatmapView />;
}

'use client';

import { useEffect, useState } from 'react';

interface OptionsFlow {
    ticker: string;
    type: string;
    strike: number;
    expiry: string;
    premium: number;
    volume: number;
    open_interest: number;
    sentiment: string;
}

export default function OptionsFlowPage() {
    const [loading, setLoading] = useState(true);
    const [flows, setFlows] = useState<OptionsFlow[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/us/options-flow');
            if (res.ok) {
                const data = await res.json();
                setFlows(data.flows || []);
            }
        } catch (error) {
            console.error('Failed to load options:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatPremium = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pink-500/20 bg-pink-500/5 text-xs text-pink-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping"></span>
                    Unusual Activity
                </div>
                <h2 className="text-3xl font-bold tracking-tighter text-white mb-2">
                    📊 Options <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Flow</span>
                </h2>
                <p className="text-gray-400">대규모 옵션 거래 활동</p>
            </div>

            {/* Options Table */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-[#1c1c1e] border border-white/10 animate-pulse"></div>
                    ))}
                </div>
            ) : flows.length === 0 ? (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-500/10 flex items-center justify-center">
                        <i className="fas fa-chart-line text-2xl text-pink-500"></i>
                    </div>
                    <div className="text-gray-500 text-lg mb-2">No options flow data</div>
                    <div className="text-xs text-gray-600">Run: python3 us_market/options_flow.py</div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5">
                                <th className="text-left py-3 px-4">Ticker</th>
                                <th className="text-center py-3 px-4">Type</th>
                                <th className="text-right py-3 px-4">Strike</th>
                                <th className="text-left py-3 px-4">Expiry</th>
                                <th className="text-right py-3 px-4">Premium</th>
                                <th className="text-right py-3 px-4">Volume</th>
                                <th className="text-center py-3 px-4">Sentiment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flows.slice(0, 50).map((flow, idx) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 font-bold text-white">{flow.ticker}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${flow.type === 'CALL' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {flow.type}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-400">${flow.strike}</td>
                                    <td className="py-3 px-4 text-gray-500">{flow.expiry}</td>
                                    <td className="py-3 px-4 text-right text-white font-bold">{formatPremium(flow.premium)}</td>
                                    <td className="py-3 px-4 text-right text-gray-400">{flow.volume?.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${flow.sentiment === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                                                flow.sentiment === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {flow.sentiment}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

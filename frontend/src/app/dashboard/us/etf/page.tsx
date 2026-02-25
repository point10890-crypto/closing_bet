'use client';

import { useEffect, useState } from 'react';
import { usAPI } from '@/lib/api';

interface ETFFlow {
    ticker: string;
    name: string;
    sector: string;
    flow_1d: number;
    flow_1w: number;
    flow_1m: number;
    aum: number;
}

export default function ETFFlowsPage() {
    const [loading, setLoading] = useState(true);
    const [flows, setFlows] = useState<ETFFlow[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await usAPI.getEtfFlowAnalysis();
            setFlows(data.flows || []);
        } catch (error) {
            console.error('Failed to load ETF:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatFlow = (val: number) => {
        if (!val) return '-';
        const prefix = val >= 0 ? '+' : '';
        if (Math.abs(val) >= 1000) return `${prefix}$${(val / 1000).toFixed(1)}B`;
        return `${prefix}$${val.toFixed(0)}M`;
    };

    const getFlowColor = (val: number) => {
        if (val > 0) return 'text-green-400';
        if (val < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-xs text-cyan-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></span>
                    Fund Flows
                </div>
                <h2 className="text-3xl font-bold tracking-tighter text-white mb-2">
                    ETF <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Flows</span>
                </h2>
                <p className="text-gray-400">섹터 ETF 자금 유입/유출</p>
            </div>

            {/* ETF Flow Table */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-[#1c1c1e] border border-white/10 animate-pulse"></div>
                    ))}
                </div>
            ) : flows.length === 0 ? (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center">
                        <i className="fas fa-coins text-2xl text-cyan-500"></i>
                    </div>
                    <div className="text-gray-500 text-lg mb-2">No ETF flow data</div>
                    <div className="text-xs text-gray-600">Run: python3 us_market/analyze_etf_flows.py</div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5">
                                <th className="text-left py-3 px-4">ETF</th>
                                <th className="text-left py-3 px-4">Sector</th>
                                <th className="text-right py-3 px-4">1D Flow</th>
                                <th className="text-right py-3 px-4">1W Flow</th>
                                <th className="text-right py-3 px-4">1M Flow</th>
                                <th className="text-right py-3 px-4">AUM</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flows.map((flow) => (
                                <tr key={flow.ticker} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="font-bold text-white">{flow.ticker}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[150px]">{flow.name}</div>
                                    </td>
                                    <td className="py-3 px-4 text-gray-400">{flow.sector}</td>
                                    <td className={`py-3 px-4 text-right font-bold ${getFlowColor(flow.flow_1d)}`}>
                                        {formatFlow(flow.flow_1d)}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-bold ${getFlowColor(flow.flow_1w)}`}>
                                        {formatFlow(flow.flow_1w)}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-bold ${getFlowColor(flow.flow_1m)}`}>
                                        {formatFlow(flow.flow_1m)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-400">
                                        ${(flow.aum / 1000).toFixed(1)}B
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

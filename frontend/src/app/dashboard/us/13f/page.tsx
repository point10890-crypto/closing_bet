'use client';

import { useEffect, useState } from 'react';

interface InstitutionalData {
    ticker: string;
    institutional_pct: number;
    insider_pct: number;
    short_pct: number;
    num_inst_holders: number;
    insider_buys: number;
    insider_sells: number;
    insider_sentiment: string;
    institutional_score: number;
    institutional_stage: string;
}

export default function Holdings13FPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<InstitutionalData[]>([]);
    const [sortBy, setSortBy] = useState<'score' | 'institutional' | 'insider'>('score');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/us/institutional');
            if (res.ok) {
                const json = await res.json();
                setData(json.holdings || []);
            }
        } catch (error) {
            console.error('Failed to load 13F:', error);
        } finally {
            setLoading(false);
        }
    };

    const sortedData = [...data].sort((a, b) => {
        switch (sortBy) {
            case 'institutional': return b.institutional_pct - a.institutional_pct;
            case 'insider': return b.insider_pct - a.insider_pct;
            default: return b.institutional_score - a.institutional_score;
        }
    });

    const getStageColor = (stage: string) => {
        if (stage.includes('Strong Institutional Support')) return 'bg-green-500/20 text-green-400';
        if (stage.includes('Support')) return 'bg-blue-500/20 text-blue-400';
        if (stage.includes('Concern')) return 'bg-red-500/20 text-red-400';
        return 'bg-gray-500/20 text-gray-400';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-xs text-blue-400 font-medium mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                        13F SEC Filings
                    </div>
                    <h2 className="text-3xl font-bold tracking-tighter text-white mb-2">
                        🏦 Institutional <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Holdings</span>
                    </h2>
                    <p className="text-gray-400">기관 투자자 보유 현황</p>
                </div>
                {/* Sort Toggle */}
                <div className="flex rounded-lg bg-white/5 border border-white/10 p-1">
                    {(['score', 'institutional', 'insider'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setSortBy(type)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortBy === type ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {type === 'score' ? 'Score' : type === 'institutional' ? 'Inst %' : 'Insider %'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-[#1c1c1e] border border-white/10 animate-pulse"></div>
                    ))}
                </div>
            ) : data.length === 0 ? (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="text-gray-500">No institutional data available</div>
                    <div className="text-xs text-gray-600 mt-2">Run: python3 us_market/analyze_13f.py</div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5">
                                <th className="text-left py-3 px-4">Ticker</th>
                                <th className="text-right py-3 px-4">Score</th>
                                <th className="text-right py-3 px-4">Inst %</th>
                                <th className="text-right py-3 px-4">Insider %</th>
                                <th className="text-center py-3 px-4">Sentiment</th>
                                <th className="text-left py-3 px-4">Stage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.slice(0, 50).map((item) => (
                                <tr key={item.ticker} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 font-bold text-white">{item.ticker}</td>
                                    <td className="py-3 px-4 text-right">
                                        <span className={`font-bold ${item.institutional_score >= 70 ? 'text-green-400' : item.institutional_score >= 50 ? 'text-blue-400' : 'text-red-400'}`}>
                                            {item.institutional_score}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-400">{item.institutional_pct.toFixed(1)}%</td>
                                    <td className="py-3 px-4 text-right text-gray-400">{item.insider_pct.toFixed(1)}%</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.insider_sentiment === 'Buying' ? 'bg-green-500/20 text-green-400' :
                                                item.insider_sentiment === 'Selling' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {item.insider_sentiment}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStageColor(item.institutional_stage)}`}>
                                            {item.institutional_stage}
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

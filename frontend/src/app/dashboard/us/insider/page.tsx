'use client';

import { useEffect, useState } from 'react';

interface InsiderTransaction {
    ticker: string;
    name: string;
    title: string;
    transaction_type: string;
    shares: number;
    value: number;
    date: string;
}

export default function InsiderPage() {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<InsiderTransaction[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/us/insider-trading');
            if (res.ok) {
                const data = await res.json();
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error('Failed to load insider:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatValue = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val.toFixed(0)}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/5 text-xs text-orange-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
                    SEC Form 4
                </div>
                <h2 className="text-3xl font-bold tracking-tighter text-white mb-2">
                    🕵️ Insider <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">Trading</span>
                </h2>
                <p className="text-gray-400">내부자 매수/매도 추적</p>
            </div>

            {/* Transactions Table */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-[#1c1c1e] border border-white/10 animate-pulse"></div>
                    ))}
                </div>
            ) : transactions.length === 0 ? (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <i className="fas fa-user-secret text-2xl text-orange-500"></i>
                    </div>
                    <div className="text-gray-500 text-lg mb-2">No insider trading data</div>
                    <div className="text-xs text-gray-600">Run: python3 us_market/insider_tracker.py</div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5">
                                <th className="text-left py-3 px-4">Ticker</th>
                                <th className="text-left py-3 px-4">Insider</th>
                                <th className="text-left py-3 px-4">Title</th>
                                <th className="text-center py-3 px-4">Type</th>
                                <th className="text-right py-3 px-4">Shares</th>
                                <th className="text-right py-3 px-4">Value</th>
                                <th className="text-left py-3 px-4">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice(0, 50).map((txn, idx) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 font-bold text-white">{txn.ticker}</td>
                                    <td className="py-3 px-4 text-gray-300 truncate max-w-[150px]">{txn.name}</td>
                                    <td className="py-3 px-4 text-gray-500 text-sm truncate max-w-[100px]">{txn.title}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txn.transaction_type?.toLowerCase().includes('buy') || txn.transaction_type?.toLowerCase().includes('purchase')
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {txn.transaction_type || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-400 font-mono">{txn.shares?.toLocaleString() || '-'}</td>
                                    <td className="py-3 px-4 text-right text-white font-bold">{txn.value ? formatValue(txn.value) : '-'}</td>
                                    <td className="py-3 px-4 text-gray-500 text-sm">{txn.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

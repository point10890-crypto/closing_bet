'use client';

import { useEffect, useState } from 'react';
import { skillsAPI } from '@/lib/api';

interface VCPResult {
    symbol: string;
    name?: string;
    sector?: string;
    composite_score: number;
    rating?: string;
    current_price?: number;
    pivot_price?: number;
    stop_price?: number;
    risk_pct?: number;
    contractions?: number;
    volume_pattern?: string;
    relative_strength?: number;
    entry_ready?: boolean;
}

export default function VCPScreenerPage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        skillsAPI.getVCP()
            .then(data => setReport(data))
            .catch(() => setError('No VCP report available. Run /skill-vcp-screener first.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-400">{error}</p>
                <p className="text-sm text-gray-600 mt-2">Use Claude command: <code className="text-rose-400">/skill-vcp-screener</code></p>
            </div>
        );
    }

    const results: VCPResult[] = report?.results || [];
    const metadata = report?.metadata || {};

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">US VCP Screener</h1>
                    <p className="text-gray-400 mt-1">Minervini Volatility Contraction Pattern</p>
                </div>
                {metadata.generated_at && (
                    <span className="text-xs text-gray-500">
                        Updated: {new Date(metadata.generated_at).toLocaleString()}
                    </span>
                )}
            </div>

            {/* Summary */}
            {report?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500">Universe</p>
                        <p className="text-xl font-bold text-white">{report.summary.universe_size || '-'}</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500">Candidates</p>
                        <p className="text-xl font-bold text-rose-400">{results.length}</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500">Entry Ready</p>
                        <p className="text-xl font-bold text-green-400">
                            {results.filter(r => r.entry_ready).length}
                        </p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500">Avg Score</p>
                        <p className="text-xl font-bold text-amber-400">
                            {results.length > 0 ? (results.reduce((s, r) => s + r.composite_score, 0) / results.length).toFixed(1) : '-'}
                        </p>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-700 bg-gray-900/50">
                            <th className="text-left p-3 text-gray-400">Symbol</th>
                            <th className="text-left p-3 text-gray-400">Sector</th>
                            <th className="text-right p-3 text-gray-400">Score</th>
                            <th className="text-right p-3 text-gray-400">Price</th>
                            <th className="text-right p-3 text-gray-400">Pivot</th>
                            <th className="text-right p-3 text-gray-400">Risk %</th>
                            <th className="text-right p-3 text-gray-400">RS</th>
                            <th className="text-center p-3 text-gray-400">Entry</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, i) => (
                            <tr key={i} className="border-b border-gray-800 hover:bg-gray-700/30">
                                <td className="p-3">
                                    <span className="text-white font-medium">{r.symbol}</span>
                                    {r.name && <span className="text-gray-500 ml-2 text-xs">{r.name}</span>}
                                </td>
                                <td className="p-3 text-gray-400 text-xs">{r.sector || '-'}</td>
                                <td className="p-3 text-right">
                                    <span className={`font-medium ${r.composite_score >= 80 ? 'text-green-400' : r.composite_score >= 60 ? 'text-amber-400' : 'text-gray-400'}`}>
                                        {r.composite_score?.toFixed(1)}
                                    </span>
                                </td>
                                <td className="p-3 text-right text-white">${r.current_price?.toFixed(2)}</td>
                                <td className="p-3 text-right text-cyan-400">${r.pivot_price?.toFixed(2)}</td>
                                <td className="p-3 text-right text-orange-400">{r.risk_pct?.toFixed(1)}%</td>
                                <td className="p-3 text-right text-purple-400">{r.relative_strength?.toFixed(0)}</td>
                                <td className="p-3 text-center">
                                    {r.entry_ready ? (
                                        <span className="text-green-400 text-xs font-medium">READY</span>
                                    ) : (
                                        <span className="text-gray-600 text-xs">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {results.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                    No VCP patterns found. Run <code className="text-rose-400">/skill-vcp-screener</code>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

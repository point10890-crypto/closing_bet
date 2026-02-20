'use client';

import { useEffect, useState } from 'react';
import { cryptoAPI, CryptoSignal } from '@/lib/api';

export default function CryptoSignalsPage() {
    const [signals, setSignals] = useState<CryptoSignal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [analysisResult, setAnalysisResult] = useState<Record<string, string>>({});
    const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [selectedSignal, setSelectedSignal] = useState<CryptoSignal | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await cryptoAPI.getVCPSignals(50);
            setSignals(res.signals || []);
        } catch (e: any) {
            setError(e.message || 'Failed to load signals');
        } finally {
            setLoading(false);
        }
    };

    const analyzeSignal = async (signal: CryptoSignal) => {
        setAnalyzingSymbol(signal.symbol);
        try {
            const res = await fetch('/api/crypto/signal-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: signal.symbol,
                    score: signal.score,
                    pivot_high: signal.pivot_high,
                    vol_ratio: signal.vol_ratio,
                    current_price: 0,
                    signal_type: signal.signal_type,
                }),
            });
            const data = await res.json();
            if (data.analysis) {
                setAnalysisResult(prev => ({ ...prev, [signal.symbol]: data.analysis }));
            }
        } catch {
            setAnalysisResult(prev => ({ ...prev, [signal.symbol]: 'Analysis failed.' }));
        } finally {
            setAnalyzingSymbol(null);
        }
    };

    const handleScan = async () => {
        setScanning(true);
        try {
            await cryptoAPI.runScan();
        } catch { /* ignore */ }
        // Poll for completion
        const poll = setInterval(async () => {
            try {
                const status = await cryptoAPI.getTaskStatus();
                const tasks = (status as any).tasks || {};
                const latest = Object.entries(tasks).find(([k]) => k.startsWith('scan_'));
                if (latest && (latest[1] as any).status !== 'running') {
                    clearInterval(poll);
                    setScanning(false);
                    loadData();
                }
            } catch {
                clearInterval(poll);
                setScanning(false);
            }
        }, 3000);
    };

    const scoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
        if (score >= 60) return 'text-green-400 bg-green-500/20 border-green-500/30';
        if (score >= 40) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading VCP Signals...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Crypto VCP Signals</h1>
                    <p className="text-gray-500 text-sm mt-1">Volatility Contraction Pattern &middot; {signals.length} signals found</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleScan} disabled={scanning}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                        {scanning ? <><i className="fas fa-spinner fa-spin mr-1"></i>Scanning...</> : <><i className="fas fa-search mr-1"></i>Scan Now</>}
                    </button>
                    <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i>Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">{error}</div>
            )}

            {/* Signals Table */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase">
                                <th className="text-left px-4 py-3 font-semibold">Symbol</th>
                                <th className="text-left px-4 py-3 font-semibold">Exchange</th>
                                <th className="text-left px-4 py-3 font-semibold">Type</th>
                                <th className="text-center px-4 py-3 font-semibold">Score</th>
                                <th className="text-left px-4 py-3 font-semibold">Timeframe</th>
                                <th className="text-right px-4 py-3 font-semibold">Pivot High</th>
                                <th className="text-right px-4 py-3 font-semibold">Vol Ratio</th>
                                <th className="text-center px-4 py-3 font-semibold">ML Prob</th>
                                <th className="text-left px-4 py-3 font-semibold">Date</th>
                                <th className="text-center px-4 py-3 font-semibold">AI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signals.map((s, i) => (
                                <tr key={`${s.symbol}-${i}`} className="border-b border-gray-700/30 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedSignal(s)}>
                                    <td className="px-4 py-3 font-bold text-white">{s.symbol}</td>
                                    <td className="px-4 py-3 text-gray-400">{s.exchange}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs font-semibold">{s.signal_type}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded border text-xs font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400">{s.timeframe}</td>
                                    <td className="px-4 py-3 text-right text-white">${s.pivot_high.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={s.vol_ratio >= 1.5 ? 'text-emerald-400' : 'text-gray-400'}>{s.vol_ratio.toFixed(2)}x</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {s.ml_win_prob != null ? (
                                            <span className={`text-xs font-semibold ${s.ml_win_prob >= 60 ? 'text-emerald-400' : s.ml_win_prob >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {s.ml_win_prob.toFixed(1)}%
                                            </span>
                                        ) : <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{s.created_at?.split('T')[0] || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => analyzeSignal(s)}
                                            disabled={analyzingSymbol === s.symbol}
                                            className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
                                        >
                                            {analyzingSymbol === s.symbol ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-brain"></i>}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {signals.length === 0 && (
                                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No VCP signals found. Run the scanner first.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Signal Detail Modal */}
            {selectedSignal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSignal(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">{selectedSignal.symbol}</h3>
                            <button onClick={() => setSelectedSignal(null)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-gray-500">Type:</span> <span className="text-orange-400 font-semibold ml-1">{selectedSignal.signal_type}</span></div>
                            <div><span className="text-gray-500">Score:</span> <span className="text-white font-bold ml-1">{selectedSignal.score}</span></div>
                            <div><span className="text-gray-500">Pivot High:</span> <span className="text-white ml-1">${selectedSignal.pivot_high.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>
                            <div><span className="text-gray-500">Vol Ratio:</span> <span className={`ml-1 ${selectedSignal.vol_ratio >= 1.5 ? 'text-emerald-400' : 'text-gray-300'}`}>{selectedSignal.vol_ratio.toFixed(2)}x</span></div>
                            <div><span className="text-gray-500">Exchange:</span> <span className="text-gray-300 ml-1">{selectedSignal.exchange}</span></div>
                            <div><span className="text-gray-500">Timeframe:</span> <span className="text-gray-300 ml-1">{selectedSignal.timeframe}</span></div>
                            {selectedSignal.ml_win_prob != null && (
                                <div className="col-span-2"><span className="text-gray-500">ML Win Prob:</span> <span className={`ml-1 font-bold ${selectedSignal.ml_win_prob >= 60 ? 'text-emerald-400' : selectedSignal.ml_win_prob >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{selectedSignal.ml_win_prob.toFixed(1)}%</span></div>
                            )}
                            <div className="col-span-2"><span className="text-gray-500">Date:</span> <span className="text-gray-300 ml-1">{selectedSignal.created_at || '-'}</span></div>
                        </div>
                        {analysisResult[selectedSignal.symbol] && (
                            <div className="mt-4 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 text-sm text-gray-300 whitespace-pre-wrap">
                                {analysisResult[selectedSignal.symbol]}
                            </div>
                        )}
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => { analyzeSignal(selectedSignal); }}
                                disabled={analyzingSymbol === selectedSignal.symbol}
                                className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 disabled:opacity-50">
                                {analyzingSymbol === selectedSignal.symbol ? <><i className="fas fa-spinner fa-spin mr-1"></i>Analyzing...</> : <><i className="fas fa-brain mr-1"></i>AI Analysis</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Analysis Results */}
            {Object.keys(analysisResult).length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">AI Analysis</h2>
                    {Object.entries(analysisResult).map(([sym, text]) => (
                        <div key={sym} className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4">
                            <div className="text-sm font-bold text-purple-400 mb-2">{sym}</div>
                            <div className="text-sm text-gray-300 whitespace-pre-wrap">{text}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

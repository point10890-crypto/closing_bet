'use client';

import { useEffect, useState } from 'react';
import { cryptoAPI, CryptoPredictionData } from '@/lib/api';

export default function CryptoPredictionPage() {
    const [data, setData] = useState<CryptoPredictionData | null>(null);
    const [history, setHistory] = useState<Array<{ date: string; bullish_probability: number; btc_price: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retraining, setRetraining] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [predRes, histRes] = await Promise.allSettled([
                cryptoAPI.getPrediction(),
                cryptoAPI.getPredictionHistory(),
            ]);
            if (predRes.status === 'fulfilled') setData(predRes.value);
            else setError('No prediction data available. Run crypto_prediction.py first.');
            if (histRes.status === 'fulfilled') setHistory(histRes.value.history || []);
        } catch (e: any) {
            setError(e.message || 'Failed to load prediction');
        } finally {
            setLoading(false);
        }
    };

    const handleRetrain = async () => {
        setRetraining(true);
        try {
            await cryptoAPI.runPrediction();
        } catch { /* ignore */ }
        const poll = setInterval(async () => {
            try {
                const status = await cryptoAPI.getTaskStatus();
                const tasks = (status as any).tasks || {};
                const latest = Object.entries(tasks).find(([k]) => k.startsWith('prediction_'));
                if (latest && (latest[1] as any).status !== 'running') {
                    clearInterval(poll);
                    setRetraining(false);
                    loadData();
                }
            } catch {
                clearInterval(poll);
                setRetraining(false);
            }
        }, 5000);
    };

    const probColor = (p: number) => {
        if (p >= 70) return 'text-emerald-400';
        if (p >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    const confBadge = (level: string) => {
        const map: Record<string, string> = {
            'High': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            'Medium': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            'Low': 'bg-red-500/20 text-red-400 border-red-500/30',
        };
        return map[level] || map['Low'];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Prediction...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">BTC Prediction</h1>
                    <p className="text-gray-500 text-sm mt-1">ML-based Direction Forecast &middot; Ensemble Models</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleRetrain} disabled={retraining}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                        {retraining ? <><i className="fas fa-spinner fa-spin mr-1"></i>Retraining...</> : <><i className="fas fa-redo mr-1"></i>Retrain</>}
                    </button>
                    <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i>Refresh
                    </button>
                </div>
            </div>

            {error && !data && (
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-yellow-400 text-sm">{error}</div>
            )}

            {data && (
                <>
                    {/* Prediction Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(data.predictions).map(([coin, pred]) => (
                            <div key={coin} className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-lg font-bold text-white">{coin}</span>
                                    <span className={`px-2 py-0.5 rounded border text-xs font-bold ${confBadge(pred.confidence_level)}`}>
                                        {pred.confidence_level}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-400 mb-1">Current: ${pred.current_price.toLocaleString()}</div>

                                {/* Probability Bar */}
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-red-400">Bearish {pred.bearish_probability.toFixed(1)}%</span>
                                        <span className="text-emerald-400">Bullish {pred.bullish_probability.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-red-500/30 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                            style={{ width: `${pred.bullish_probability}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Key Drivers */}
                                {pred.key_drivers && pred.key_drivers.length > 0 && (
                                    <div className="mt-4 space-y-1.5">
                                        <div className="text-xs text-gray-500 font-semibold">Key Drivers</div>
                                        {pred.key_drivers.slice(0, 5).map((d, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs">
                                                <span className="text-gray-300 truncate flex-1 mr-2">{d.feature}</span>
                                                <span className={d.direction === 'bullish' ? 'text-emerald-400' : d.direction === 'bearish' ? 'text-red-400' : 'text-gray-400'}>
                                                    {d.direction === 'bullish' ? '+' : d.direction === 'bearish' ? '-' : ''}{Math.abs(d.impact).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Model Info */}
                    <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                        <h3 className="text-sm font-bold text-gray-400 mb-3">Model Info</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-xs text-gray-500">Algorithm</div>
                                <div className="text-sm text-white font-medium">{data.model_info.algorithm}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Training Accuracy</div>
                                <div className="text-sm text-white font-medium">{data.model_info.training_accuracy.toFixed(1)}%</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Training Samples</div>
                                <div className="text-sm text-white font-medium">{data.model_info.training_samples.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Last Trained</div>
                                <div className="text-sm text-white font-medium">{data.model_info.last_trained?.split('T')[0] || '-'}</div>
                            </div>
                        </div>

                        {/* Ensemble Models */}
                        {data.model_info.ensemble_models && data.model_info.ensemble_models.length > 0 && (
                            <div className="mt-4 border-t border-gray-700/50 pt-4">
                                <div className="text-xs text-gray-500 font-semibold mb-2">Ensemble Models</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {data.model_info.ensemble_models.map((m, i) => (
                                        <div key={i} className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2 text-xs">
                                            <span className="text-gray-300">{m.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">Acc: {m.accuracy.toFixed(1)}%</span>
                                                <span className={m.bullish >= 50 ? 'text-emerald-400' : 'text-red-400'}>
                                                    {m.bullish >= 50 ? 'Bull' : 'Bear'} {m.bullish.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 30-Day Probability Trend Chart */}
            {history.length > 1 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">Bullish Probability Trend</h3>
                    <div className="relative h-40">
                        <svg viewBox="0 0 600 160" className="w-full h-full" preserveAspectRatio="none">
                            {/* 50% baseline */}
                            <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(255,255,255,0.1)" strokeDasharray="4,4" />
                            <text x="605" y="84" fill="rgba(255,255,255,0.3)" fontSize="10">50%</text>

                            {/* Area fill */}
                            <path
                                d={(() => {
                                    const pts = history.slice(-30);
                                    const stepX = 600 / Math.max(pts.length - 1, 1);
                                    let path = `M 0 ${160 - (pts[0].bullish_probability / 100) * 160}`;
                                    pts.forEach((p, i) => {
                                        if (i > 0) path += ` L ${i * stepX} ${160 - (p.bullish_probability / 100) * 160}`;
                                    });
                                    path += ` L ${(pts.length - 1) * stepX} 160 L 0 160 Z`;
                                    return path;
                                })()}
                                fill="url(#trendGradient)"
                            />

                            {/* Line */}
                            <path
                                d={(() => {
                                    const pts = history.slice(-30);
                                    const stepX = 600 / Math.max(pts.length - 1, 1);
                                    let path = `M 0 ${160 - (pts[0].bullish_probability / 100) * 160}`;
                                    pts.forEach((p, i) => {
                                        if (i > 0) path += ` L ${i * stepX} ${160 - (p.bullish_probability / 100) * 160}`;
                                    });
                                    return path;
                                })()}
                                fill="none" stroke="#f87171" strokeWidth="2"
                            />

                            {/* Dots */}
                            {history.slice(-30).map((p, i, arr) => {
                                const stepX = 600 / Math.max(arr.length - 1, 1);
                                const y = 160 - (p.bullish_probability / 100) * 160;
                                return <circle key={i} cx={i * stepX} cy={y} r={3} fill={p.bullish_probability >= 50 ? '#34d399' : '#f87171'} />;
                            })}

                            <defs>
                                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f87171" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                </div>
            )}

            {/* Prediction History */}
            {history.length > 0 && (
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">Prediction History</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase">
                                    <th className="text-left px-3 py-2">Date</th>
                                    <th className="text-right px-3 py-2">BTC Price</th>
                                    <th className="text-center px-3 py-2">Bullish Prob</th>
                                    <th className="text-center px-3 py-2">Signal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.slice(0, 20).map((h, i) => (
                                    <tr key={i} className="border-b border-gray-700/30 hover:bg-white/5">
                                        <td className="px-3 py-2 text-gray-300">{h.date}</td>
                                        <td className="px-3 py-2 text-right text-white">${h.btc_price.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={probColor(h.bullish_probability)}>{h.bullish_probability.toFixed(1)}%</span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${h.bullish_probability >= 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {h.bullish_probability >= 50 ? 'BULL' : 'BEAR'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

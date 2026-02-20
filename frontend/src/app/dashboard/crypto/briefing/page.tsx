'use client';

import { useEffect, useState } from 'react';
import { cryptoAPI, CryptoBriefingData } from '@/lib/api';

export default function CryptoBriefingPage() {
    const [data, setData] = useState<CryptoBriefingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await cryptoAPI.getBriefing();
            setData(res);
        } catch (e: any) {
            setError(e.message || 'Failed to load briefing');
        } finally {
            setLoading(false);
        }
    };

    const fmt = (n: number) => n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
    const pct = (n: number) => n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
    const clr = (n: number) => n >= 0 ? 'text-emerald-400' : 'text-red-400';

    const fgColor = (score: number) => {
        if (score >= 75) return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' };
        if (score >= 55) return { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' };
        if (score >= 45) return { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400' };
        if (score >= 25) return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' };
        return { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Crypto Briefing...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <p className="text-red-400 text-sm mb-3">{error || 'No data available'}</p>
                    <button onClick={loadData} className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20">Retry</button>
                </div>
            </div>
        );
    }

    const fg = fgColor(data.fear_greed.score);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Crypto Briefing</h1>
                    <p className="text-gray-500 text-sm mt-1">Daily Market Summary &middot; Fear &amp; Greed &middot; Funding Rates</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{data.timestamp ? new Date(data.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i>Refresh
                    </button>
                </div>
            </div>

            {/* Market Summary + Fear & Greed */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <div className="text-xs text-gray-400 mb-1">Total Market Cap</div>
                    <div className="text-xl font-bold text-white">{fmt(data.market_summary.total_market_cap)}</div>
                    <div className={`text-sm font-semibold mt-1 ${clr(data.market_summary.total_market_cap_change_24h)}`}>
                        {pct(data.market_summary.total_market_cap_change_24h)}
                    </div>
                </div>
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <div className="text-xs text-gray-400 mb-1">24h Volume</div>
                    <div className="text-xl font-bold text-white">{fmt(data.market_summary.total_volume_24h)}</div>
                    <div className="text-xs text-gray-500 mt-1">BTC Dom: {data.market_summary.btc_dominance.toFixed(1)}%</div>
                </div>
                <div className={`rounded-xl ${fg.bg} border ${fg.border} p-5`}>
                    <div className="text-xs text-gray-400 mb-1">Fear &amp; Greed</div>
                    <div className={`text-2xl font-black ${fg.text}`}>{data.fear_greed.score}</div>
                    <div className={`text-sm font-semibold ${fg.text}`}>{data.fear_greed.level}</div>
                    {data.fear_greed.change !== 0 && (
                        <div className={`text-xs mt-1 ${data.fear_greed.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {data.fear_greed.change >= 0 ? '+' : ''}{data.fear_greed.change} from yesterday
                        </div>
                    )}
                </div>
            </div>

            {/* Major Coins */}
            {Object.keys(data.major_coins).length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Major Coins</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                        {Object.entries(data.major_coins).map(([sym, coin]) => (
                            <div key={sym} className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4 hover:border-gray-600/50 transition-colors">
                                <div className="text-sm font-bold text-white mb-1">{sym}</div>
                                <div className="text-lg font-bold text-white">${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs font-semibold ${clr(coin.change_24h)}`}>24h {pct(coin.change_24h)}</span>
                                    <span className={`text-xs ${clr(coin.change_7d)}`}>7d {pct(coin.change_7d)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Movers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gainers */}
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-emerald-400 mb-3"><i className="fas fa-arrow-up mr-1"></i>Top Gainers</h3>
                    <div className="space-y-2">
                        {data.top_movers.gainers.map((g, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <div>
                                    <span className="text-white font-medium">{g.symbol}</span>
                                    <span className="text-gray-500 text-xs ml-2">{g.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-white">${g.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                    <span className="text-emerald-400 font-semibold ml-2">+{g.change_24h.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                        {data.top_movers.gainers.length === 0 && <p className="text-gray-500 text-xs">No data</p>}
                    </div>
                </div>
                {/* Losers */}
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                    <h3 className="text-sm font-bold text-red-400 mb-3"><i className="fas fa-arrow-down mr-1"></i>Top Losers</h3>
                    <div className="space-y-2">
                        {data.top_movers.losers.map((l, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <div>
                                    <span className="text-white font-medium">{l.symbol}</span>
                                    <span className="text-gray-500 text-xs ml-2">{l.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-white">${l.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                    <span className="text-red-400 font-semibold ml-2">{l.change_24h.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                        {data.top_movers.losers.length === 0 && <p className="text-gray-500 text-xs">No data</p>}
                    </div>
                </div>
            </div>

            {/* Funding Rates & Correlations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Funding Rates */}
                {Object.keys(data.funding_rates).length > 0 && (
                    <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                        <h3 className="text-sm font-bold text-gray-400 mb-3">Funding Rates</h3>
                        <div className="space-y-3">
                            {Object.entries(data.funding_rates).map(([sym, fr]) => (
                                <div key={sym} className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-white">{sym}</span>
                                    <div className="text-right">
                                        <span className={`text-sm font-semibold ${fr.rate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {fr.rate_pct >= 0 ? '+' : ''}{fr.rate_pct.toFixed(4)}%
                                        </span>
                                        <span className="text-xs text-gray-500 ml-2">Ann. {fr.annualized_pct}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Macro Correlations */}
                {Object.keys(data.macro_correlations.btc_pairs).length > 0 && (
                    <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                        <h3 className="text-sm font-bold text-gray-400 mb-3">BTC Correlations (90d)</h3>
                        <div className="space-y-3">
                            {Object.entries(data.macro_correlations.btc_pairs).map(([key, corr]) => {
                                const label = key.startsWith('BTC_') ? key.replace('BTC_', '') : key;
                                return (
                                    <div key={key} className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-white">BTC / {label}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${corr >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                    style={{ width: `${Math.abs(corr) * 100}%` }}
                                                />
                                            </div>
                                            <span className={`text-sm font-mono ${corr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {corr >= 0 ? '+' : ''}{corr.toFixed(3)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Sentiment Summary */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-5">
                <h3 className="text-sm font-bold text-gray-400 mb-3">Sentiment Summary</h3>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-lg font-bold ${
                        data.sentiment_summary.overall.toLowerCase().includes('bullish') ? 'text-emerald-400' :
                        data.sentiment_summary.overall.toLowerCase().includes('bearish') ? 'text-red-400' : 'text-gray-400'
                    }`}>
                        {data.sentiment_summary.overall}
                    </span>
                    {data.sentiment_summary.factors.map((f, i) => {
                        const factorColor = f.toLowerCase().includes('bullish') || f.toLowerCase().includes('greed')
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : f.toLowerCase().includes('bearish') || f.toLowerCase().includes('fear')
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-gray-700/50 text-gray-300';
                        return <span key={i} className={`px-2 py-1 rounded text-xs ${factorColor}`}>{f}</span>;
                    })}
                </div>
            </div>
        </div>
    );
}

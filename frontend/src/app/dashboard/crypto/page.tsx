'use client';

import { useEffect, useState } from 'react';
import { cryptoAPI, CryptoAsset, CryptoDominance } from '@/lib/api';

export default function CryptoPage() {
    const [cryptos, setCryptos] = useState<CryptoAsset[]>([]);
    const [dominance, setDominance] = useState<CryptoDominance | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [overviewRes, domRes] = await Promise.allSettled([
                cryptoAPI.getOverview(),
                cryptoAPI.getDominance(),
            ]);
            if (overviewRes.status === 'fulfilled') setCryptos(overviewRes.value.cryptos);
            if (domRes.status === 'fulfilled') setDominance(domRes.value);
            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            console.error('Failed to load crypto data:', e);
        } finally {
            setLoading(false);
        }
    };

    const getChangeColor = (val: number) => val >= 0 ? 'text-emerald-400' : 'text-red-400';
    const formatChange = (val: number) => val >= 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`;
    const formatPrice = (p: number) => p >= 1 ? p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(4);
    const formatVolume = (v: number) => {
        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
        return `$${v.toLocaleString()}`;
    };

    const getSentimentColor = (s: string) => {
        if (s === 'EXTREME_GREED') return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Extreme Greed' };
        if (s === 'GREED') return { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', label: 'Greed' };
        if (s === 'FEAR') return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', label: 'Fear' };
        if (s === 'EXTREME_FEAR') return { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', label: 'Extreme Fear' };
        return { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Neutral' };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Crypto Data...</p>
                </div>
            </div>
        );
    }

    const sentimentStyle = dominance ? getSentimentColor(dominance.sentiment) : getSentimentColor('NEUTRAL');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Crypto Market</h1>
                    <p className="text-gray-500 text-sm mt-1">Top Coins &middot; BTC Dominance &middot; Market Sentiment</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && <span className="text-xs text-gray-500">{lastUpdated}</span>}
                    <button onClick={loadData} className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold hover:bg-yellow-500/20 transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i>Refresh
                    </button>
                </div>
            </div>

            {/* BTC Sentiment Panel */}
            {dominance && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className={`rounded-xl ${sentimentStyle.bg} border ${sentimentStyle.border} p-5 md:col-span-2`}>
                        <div className="text-xs text-gray-400 mb-1">BTC Sentiment</div>
                        <div className={`text-xl font-black ${sentimentStyle.text}`}>{sentimentStyle.label}</div>
                        <div className="text-xs text-gray-500 mt-2">RSI {dominance.btc_rsi} &middot; 30D {dominance.btc_30d_change >= 0 ? '+' : ''}{dominance.btc_30d_change.toFixed(1)}%</div>
                    </div>
                    <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-5">
                        <div className="text-xs text-gray-400 mb-1">Bitcoin</div>
                        <div className="text-xl font-bold text-white">${dominance.btc_price.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-5">
                        <div className="text-xs text-gray-400 mb-1">Ethereum</div>
                        <div className="text-xl font-bold text-white">${dominance.eth_price.toLocaleString()}</div>
                    </div>
                </div>
            )}

            {/* Crypto Grid */}
            <div>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Top Cryptocurrencies</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cryptos.map((c) => (
                        <div key={c.ticker} className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4 hover:border-gray-600/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-white">{c.name}</span>
                                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">{c.ticker}</span>
                            </div>
                            <div className="text-lg font-bold text-white">${formatPrice(c.price)}</div>
                            <div className="flex items-center justify-between mt-2">
                                <span className={`text-sm font-semibold ${getChangeColor(c.change_pct)}`}>
                                    {formatChange(c.change_pct)}
                                </span>
                                <span className="text-xs text-gray-500">Vol {formatVolume(c.volume_24h)}</span>
                            </div>
                        </div>
                    ))}
                    {cryptos.length === 0 && (
                        <div className="col-span-full text-center text-gray-500 text-sm py-8">No crypto data available</div>
                    )}
                </div>
            </div>
        </div>
    );
}

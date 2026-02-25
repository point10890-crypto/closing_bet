'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usAPI, BriefingData, BriefingMarketData, BriefingFearGreed, BriefingSmartMoneyPick } from '@/lib/api';
import ErrorBanner from '@/components/ui/ErrorBanner';
import HelpButton from '@/components/ui/HelpButton';

// Fear & Greed Gauge Component
function FearGreedGauge({ data }: { data: BriefingFearGreed }) {
    const rotation = (data.score / 100) * 180 - 90;

    return (
        <div className="relative flex flex-col items-center justify-center h-full py-1">
            {/* Gauge Arc */}
            <div className="relative w-32 h-16 overflow-hidden">
                <div className="absolute w-32 h-32 rounded-full border-[12px] border-transparent"
                    style={{
                        borderTopColor: '#B71C1C',
                        borderRightColor: '#FF5722',
                        background: `conic-gradient(from 180deg, #B71C1C 0deg, #FF5722 45deg, #FFC107 90deg, #4CAF50 135deg, #00C853 180deg, transparent 180deg)`,
                        clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
                    }}
                />
                {/* Needle */}
                <div
                    className="absolute bottom-0 left-1/2 w-1 h-14 bg-white origin-bottom rounded-full shadow-lg transition-transform duration-1000 ease-out"
                    style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
                />
                {/* Center dot */}
                <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-white shadow-lg" />
            </div>

            {/* Score */}
            <div className="text-center mt-2">
                <div className="text-3xl font-black tracking-tighter" style={{ color: data.color }}>
                    {data.score}
                </div>
                <div className="text-sm font-bold mt-0.5 tracking-wide" style={{ color: data.color }}>
                    {data.level}
                </div>
            </div>

            {/* Scale labels */}
            <div className="w-full flex justify-between text-[8px] text-gray-500 mt-2 px-4">
                <span>Fear</span>
                <span>Neutral</span>
                <span>Greed</span>
            </div>
        </div>
    );
}

// Market Card Component
function MarketCard({ symbol, data, type = 'default' }: { symbol: string; data: BriefingMarketData; type?: string }) {
    const isPositive = data.change >= 0;
    const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
    const bgGlow = isPositive ? 'hover:border-emerald-500/30 hover:shadow-emerald-500/5' : 'hover:border-red-500/30 hover:shadow-red-500/5';

    return (
        <div className={`p-4 rounded-xl bg-[#1c1c1e]/80 border border-white/5 backdrop-blur-sm transition-all duration-300 ${bgGlow} hover:shadow-lg group flex flex-col gap-3`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium group-hover:text-gray-300 transition-colors w-24 truncate">{data.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{symbol}</div>
                </div>
                <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {Math.abs(data.change).toFixed(2)}%
                </div>
            </div>
            <div>
                <div className={`text-3xl font-bold tracking-tight ${colorClass}`}>
                    {formatPrice(data.price, type, symbol)}
                </div>
                {data.pct_from_high !== undefined && data.pct_from_high !== null && (
                    <div className={`text-[10px] font-medium mt-1 flex items-center gap-1.5 ${colorClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        High: {data.pct_from_high.toFixed(1)}%
                    </div>
                )}
            </div>
        </div>
    );
}

// Compact Market Item (Horizontal List Style)
function CompactMarketItem({ symbol, data, type = 'default' }: { symbol: string; data: BriefingMarketData; type?: string }) {
    const isPositive = data.change >= 0;
    const bgGlow = isPositive ? 'hover:border-emerald-500/30 hover:bg-emerald-500/5' : 'hover:border-red-500/30 hover:bg-red-500/5';

    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg bg-[#1c1c1e] border border-white/5 transition-all duration-200 ${bgGlow} group`}>
            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                <span className="text-[11px] text-gray-400 font-medium truncate group-hover:text-gray-200 transition-colors">
                    {data.name.replace('Treasury Yield', '').replace('Treasury', '').trim()}
                </span>
                <span className="text-[10px] text-gray-500 font-mono mt-0.5">{symbol}</span>
            </div>

            <div className="text-right flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-white tracking-tight tabular-nums">
                    {formatPrice(data.price, type, symbol)}
                </span>
                <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'} w-[54px] text-center tabular-nums`}>
                    {isPositive ? '+' : ''}{data.change.toFixed(2)}%
                </div>
            </div>
        </div>
    );
}

// Smart Money Card — now clickable via Link
function SmartMoneyCard({ pick }: { pick: BriefingSmartMoneyPick }) {
    const getRecommendationColor = (rec: string) => {
        if (rec.includes('매수') || rec.includes('Buy')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (rec.includes('관망') || rec.includes('Hold')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    };

    return (
        <Link href="/dashboard/us/smart-money"
            className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/[0.07] hover:border-white/10 transition-all group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                {pick.rank}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm tracking-tight">{pick.ticker}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getRecommendationColor(pick.ai_recommendation)}`}>
                        {pick.ai_recommendation}
                    </span>
                </div>
                <div className="text-[10px] text-gray-400 truncate group-hover:text-gray-300">{pick.name}</div>
            </div>
            <div className="text-right">
                <div className="text-sm font-bold text-amber-400">{pick.final_score}</div>
                <div className="text-[10px] text-emerald-400 font-medium">+{pick.target_upside}%</div>
            </div>
        </Link>
    );
}

// Section label for compact market data groups
function SectionLabel({ icon, label }: { icon: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <i className={`fas ${icon} text-[10px] text-gray-500`}></i>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{label}</span>
            <div className="flex-1 h-px bg-white/5"></div>
        </div>
    );
}

// Price formatting helper
function formatPrice(price: number, type: string, symbol: string): string {
    if (type === 'currency' && symbol.includes('KRW')) return `₩${price.toLocaleString()}`;
    if (type === 'percent') return `${price.toFixed(2)}%`;
    if (type === 'currency') return `$${price.toLocaleString()}`;
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Safe hostname extractor for citations
function safeHostname(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url.slice(0, 30);
    }
}

// Shared ReactMarkdown components for AI content
const mdComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="text-xl font-black text-white mt-6 mb-4">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="text-base font-black text-white mt-6 mb-3 pb-2 border-b border-white/10">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-sm font-bold text-amber-400 mt-5 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{children}
        </h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
        <p className="text-gray-300 mb-3 leading-relaxed text-sm">{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="text-amber-100 font-semibold">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
        <em className="text-gray-300 italic">{children}</em>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="space-y-1.5 my-3">{children}</ul>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
        <li className="text-gray-300 ml-4 pl-2 border-l-2 border-white/10 text-sm leading-relaxed hover:border-amber-500/50 hover:text-gray-100 transition-colors">
            {children}
        </li>
    ),
    hr: () => <hr className="border-white/10 my-4" />,
    table: ({ children }: { children?: React.ReactNode }) => (
        <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
            <table className="w-full text-sm">{children}</table>
        </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
        <thead className="bg-white/5 border-b border-white/10">{children}</thead>
    ),
    tbody: ({ children }: { children?: React.ReactNode }) => (
        <tbody className="divide-y divide-white/5">{children}</tbody>
    ),
    tr: ({ children }: { children?: React.ReactNode }) => (
        <tr className="hover:bg-white/5 transition-colors">{children}</tr>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
        <th className="px-3 py-2 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{children}</td>
    ),
};

export default function BriefingPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [briefing, setBriefing] = useState<BriefingData | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'sector'>('analysis');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await usAPI.getMarketBriefing();
            setBriefing(data);
        } catch {
            setError('Failed to load market briefing.');
        } finally {
            setLoading(false);
        }
    };

    const ai_analysis = briefing?.ai_analysis;
    const sector_rotation = briefing?.sector_rotation;

    const memoizedAnalysis = useMemo(() => {
        if (!ai_analysis?.content) return null;
        return <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{ai_analysis.content}</ReactMarkdown>;
    }, [ai_analysis?.content]);

    const memoizedSectorRotation = useMemo(() => {
        if (!sector_rotation?.content) return null;
        return <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{sector_rotation.content}</ReactMarkdown>;
    }, [sector_rotation?.content]);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse max-w-[1600px] mx-auto p-6">
                <div className="h-20 bg-[#1c1c1e] rounded-2xl w-1/3 mb-8"></div>
                <div className="grid grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-[#1c1c1e] rounded-2xl"></div>)}
                </div>
                <div className="grid grid-cols-3 gap-6 mt-6">
                    <div className="col-span-2 h-[600px] bg-[#1c1c1e] rounded-2xl"></div>
                    <div className="h-[600px] bg-[#1c1c1e] rounded-2xl"></div>
                </div>
            </div>
        );
    }

    if (!briefing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6">
                {error && <ErrorBanner message={error} onRetry={loadData} />}
                <div className="w-24 h-24 mb-6 rounded-3xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <i className="fas fa-chart-line text-5xl text-amber-500"></i>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">No Briefing Available</h2>
                <p className="text-gray-500 mb-8 text-lg">Generate your first market intelligence report to get started.</p>
                <div className="bg-black/40 rounded-xl p-6 border border-white/5 backdrop-blur-sm">
                    <code className="text-sm text-amber-400 font-mono">
                        python3 us_market/us_market_briefing.py
                    </code>
                </div>
            </div>
        );
    }

    const { market_data, vix, fear_greed, smart_money } = briefing;

    return (
        <div className="space-y-4 max-w-[1600px] mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-white/5">
                <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-400 font-medium mb-1 backdrop-blur-sm">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                        </span>
                        Market Intelligence v2.0
                    </div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight">
                            Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Briefing</span>
                        </h2>
                        <HelpButton title="Market Briefing 가이드" sections={[
                            { heading: '작동 원리', body: '실시간 시장 데이터를 종합하여 하루의 시장 상황을 한눈에 보여줍니다.\n\n• Fear & Greed Index: CNN 공포/탐욕 지수 (0=극도의 공포, 100=극도의 탐욕)\n• Market Data: 주요 지수, 환율, 원자재 실시간 가격\n• AI Summary: Gemini AI가 작성한 당일 시장 요약' },
                            { heading: '해석 방법', body: '• Fear & Greed 20 이하: 극도의 공포 → 역발상 매수 기회\n• Fear & Greed 80 이상: 극도의 탐욕 → 차익 실현 고려\n• VIX 20+: 변동성 확대, 포지션 축소 고려\n• Smart Money Top 5: 기관 매집 상위 종목 빠른 확인' },
                            { heading: '활용 팁', body: '• 매일 장 시작 전 Briefing을 확인하여 시장 분위기 파악\n• AI Summary의 핵심 키워드로 당일 투자 테마 확인\n• 환율(USD/KRW) 급변 시 외국인 수급 변화 예상\n• Smart Money 종목 클릭 시 상세 분석 페이지로 이동' },
                        ]} />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Updated</div>
                        <div className="text-xs font-mono text-gray-300">
                            {new Date(briefing.timestamp).toLocaleString('ko-KR', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                        </div>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <i className={`fas fa-sync-alt text-xs ${loading ? 'animate-spin' : ''}`}></i>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                {/* Fear & Greed */}
                <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 rounded-2xl bg-gradient-to-br from-[#1c1c1e] to-[#252528] border border-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i className="fas fa-theater-masks text-5xl text-white transform rotate-12"></i>
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-medium z-10 relative">
                        <i className="fas fa-gauge-high text-amber-500"></i>
                        Sentiment
                    </div>
                    <FearGreedGauge data={fear_greed} />
                </div>

                {/* VIX */}
                <div className="col-span-1 lg:col-span-2 p-4 rounded-2xl bg-[#1c1c1e] border border-white/5 hover:border-white/10 transition-colors shadow-lg flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Volatility (VIX)</div>
                        {vix?.change !== undefined && (
                            <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${vix.change >= 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {vix.change >= 0 ? '+' : ''}{vix.change.toFixed(2)}%
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-3xl font-bold tracking-tight" style={{ color: vix?.color || '#FFC107' }}>
                            {vix?.value?.toFixed(2) || 'N/A'}
                        </div>
                        <div className="text-xs font-medium mt-1 flex items-center gap-1.5" style={{ color: vix?.color || '#FFC107' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {vix?.level || 'N/A'}
                        </div>
                    </div>
                </div>

                {/* Main Indices - Spanning remaining columns */}
                <div className="col-span-1 md:col-span-2 lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {market_data?.indices && Object.entries(market_data.indices).slice(0, 3).map(([symbol, data]) => (
                        <MarketCard key={symbol} symbol={symbol} data={data} />
                    ))}
                </div>
            </div>

            {/* Bonds */}
            {market_data?.bonds && Object.keys(market_data.bonds).length > 0 && (
                <div className="space-y-2">
                    <SectionLabel icon="fa-landmark" label="Bonds" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.entries(market_data.bonds).map(([symbol, data]) => (
                            <CompactMarketItem key={symbol} symbol={symbol} data={data} type="percent" />
                        ))}
                    </div>
                </div>
            )}

            {/* Currencies */}
            {market_data?.currencies && Object.keys(market_data.currencies).length > 0 && (
                <div className="space-y-2">
                    <SectionLabel icon="fa-dollar-sign" label="Currencies" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.entries(market_data.currencies).map(([symbol, data]) => (
                            <CompactMarketItem key={symbol} symbol={symbol} data={data} type="currency" />
                        ))}
                    </div>
                </div>
            )}

            {/* Commodities */}
            {market_data?.commodities && Object.keys(market_data.commodities).length > 0 && (
                <div className="space-y-2">
                    <SectionLabel icon="fa-gem" label="Commodities" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.entries(market_data.commodities).map(([symbol, data]) => (
                            <CompactMarketItem key={symbol} symbol={symbol} data={data} type="currency" />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column: AI Analysis */}
                <div className="lg:col-span-8 space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'analysis'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                                }`}
                        >
                            <i className="fas fa-brain"></i>AI Analysis
                        </button>
                        <button
                            onClick={() => setActiveTab('sector')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'sector'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                                }`}
                        >
                            <i className="fas fa-industry"></i>Sector Rotation
                        </button>
                    </div>

                    {/* Content Panel */}
                    <div className="p-4 md:p-5 rounded-2xl bg-[#1c1c1e] border border-white/5 min-h-[400px] relative">
                        {/* Watermark/Background decoration */}
                        <div className="absolute top-6 right-6 opacity-[0.03] pointer-events-none">
                            <i className={`fas ${activeTab === 'analysis' ? 'fa-microchip' : 'fa-chart-pie'} text-8xl`}></i>
                        </div>

                        {activeTab === 'analysis' && ai_analysis?.content ? (
                            <div className="relative z-10">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-3 border-b border-white/5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                        <i className="fas fa-chart-line text-sm"></i>
                                    </div>
                                    Market Analysis
                                    <span className="text-[10px] font-normal text-gray-500 ml-auto bg-black/20 px-2 py-0.5 rounded-full">AI Generated</span>
                                </h2>
                                {memoizedAnalysis}
                                {ai_analysis.citations?.length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-white/5">
                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">Sourced Intelligence</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {ai_analysis.citations.slice(0, 5).map((cite, i) => (
                                                <a key={i} href={cite} target="_blank" rel="noopener noreferrer"
                                                    className="px-2 py-1 rounded bg-white/5 text-[10px] text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all border border-transparent hover:border-amber-500/20 truncate max-w-[150px] flex items-center gap-1.5">
                                                    <span className="w-3 h-3 rounded-full bg-white/10 flex items-center justify-center text-[8px]">{i + 1}</span>
                                                    {safeHostname(cite)}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'sector' && sector_rotation?.content ? (
                            <div className="relative z-10">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-3 border-b border-white/5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                        <i className="fas fa-exchange-alt text-sm"></i>
                                    </div>
                                    Sector Rotation
                                    <span className="text-[10px] font-normal text-gray-500 ml-auto bg-black/20 px-2 py-0.5 rounded-full">AI Generated</span>
                                </h2>
                                {memoizedSectorRotation}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <i className="fas fa-robot text-4xl text-gray-700 mb-4"></i>
                                <h3 className="text-lg font-medium text-gray-400">AI analysis not available</h3>
                                <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
                                    The AI market analysis has not been generated for this period.
                                    Please run the briefing script.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Smart Money & Performance */}
                <div className="lg:col-span-4 space-y-4 lg:pt-[44px]">
                    {/* Smart Money Picks */}
                    <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-amber-500/5 to-[#1c1c1e] border border-amber-500/10 shadow-lg relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <i className="fas fa-crosshairs text-xs"></i>
                                </span>
                                Smart Money Top 5
                            </h3>
                            <Link href="/dashboard/us/smart-money" className="text-[10px] text-amber-400 hover:text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full hover:bg-amber-500/20 transition-all">
                                View Full List →
                            </Link>
                        </div>

                        {smart_money?.top_picks?.picks ? (
                            <div className="space-y-2 relative z-10">
                                {smart_money.top_picks.picks.slice(0, 5).map((pick) => (
                                    <SmartMoneyCard key={pick.ticker} pick={pick} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 relative z-10">
                                <i className="fas fa-chart-pie text-3xl mb-2 opacity-50"></i>
                                <p className="text-xs">No picks available</p>
                            </div>
                        )}
                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
                    </div>

                    {/* Performance Summary */}
                    {smart_money?.performance && (
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/5 shadow-lg">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <i className="fas fa-chart-bar text-xs"></i>
                                </span>
                                Recent Performance
                            </h3>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/10 text-center">
                                    <div className="text-2xl font-black text-emerald-400 tracking-tight">
                                        +{smart_money.performance.overall_avg}%
                                    </div>
                                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-medium mt-0.5">Avg Return</div>
                                </div>
                                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/10 text-center">
                                    <div className="text-2xl font-black text-amber-400 tracking-tight">
                                        {smart_money.performance.overall_win_rate}%
                                    </div>
                                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-medium mt-0.5">Win Rate</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {smart_money.performance.recent_dates?.map((d: { date: string; avg_return: number; win_rate: number }) => (
                                    <div key={d.date} className="flex justify-between items-center text-xs p-2 rounded-lg bg-white/5 border border-transparent hover:border-white/10 transition-all">
                                        <span className="text-gray-400 font-mono">{d.date}</span>
                                        <div className="flex items-center gap-1.5">
                                            {d.avg_return >= 0 ? (
                                                <i className="fas fa-arrow-up text-[9px] text-emerald-500"></i>
                                            ) : (
                                                <i className="fas fa-arrow-down text-[9px] text-red-500"></i>
                                            )}
                                            <span className={`font-bold ${d.avg_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {Math.abs(d.avg_return)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Korean Indices */}
                    {market_data?.korean_indices && Object.keys(market_data.korean_indices).length > 0 && (
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/5 shadow-lg">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 text-sm">
                                    🇰🇷
                                </span>
                                Korean Market
                            </h3>
                            <div className="space-y-2">
                                {Object.entries(market_data.korean_indices).map(([symbol, data]) => (
                                    <div key={symbol} className="flex justify-between items-center p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                                        <div>
                                            <div className="text-xs font-bold text-white">{data.name}</div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{symbol}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white tabular-nums">
                                                {data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className={`text-[10px] font-bold ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Futures */}
                    {market_data?.futures && Object.keys(market_data.futures).length > 0 && (
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/5 shadow-lg">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center text-purple-500">
                                    <i className="fas fa-clock text-xs"></i>
                                </span>
                                Futures (Pre-Market)
                            </h3>
                            <div className="space-y-2">
                                {Object.entries(market_data.futures).map(([symbol, data]) => (
                                    <div key={symbol} className="flex justify-between items-center p-1.5 hover:bg-white/5 rounded transition-colors">
                                        <span className="text-gray-400 text-xs font-medium">{data.name}</span>
                                        <span className={`text-xs font-bold ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

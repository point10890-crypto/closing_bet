'use client';

import { useEffect, useState } from 'react';
import { usAPI, TopPicksReportData } from '@/lib/api';
import HelpButton from '@/components/ui/HelpButton';
import StockDetailModal from '@/components/us/StockDetailModal';

interface ParsedAISummary {
    thesis: string;
    catalysts: Array<{ point: string; evidence: string }>;
    risks?: Array<{ point: string; evidence: string }>;
}

function parseAISummary(raw: string): ParsedAISummary | null {
    try {
        // Strip markdown code fences
        let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Handle truncated JSON by closing open structures
        if (!cleaned.endsWith('}')) {
            // Find last complete object/array structure
            const lastBrace = cleaned.lastIndexOf('}');
            if (lastBrace > 0) {
                cleaned = cleaned.substring(0, lastBrace + 1);
                // Ensure all arrays and objects are closed
                const openBrackets = (cleaned.match(/\[/g) || []).length - (cleaned.match(/\]/g) || []).length;
                const openBraces = (cleaned.match(/\{/g) || []).length - (cleaned.match(/\}/g) || []).length;
                cleaned += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
            }
        }
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

export default function TopPicksReport() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TopPicksReportData | null>(null);
    const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

    useEffect(() => {
        usAPI.getTopPicksReport()
            .then(setData)
            .catch(() => null)
            .finally(() => setLoading(false));
    }, []);

    const getGradeColor = (grade: string) => {
        if (grade.includes('A급')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        if (grade.includes('B급')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        if (grade.includes('C급')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    };

    const getRecColor = (rec: string) => {
        if (rec.includes('매수')) return 'text-green-400';
        if (rec.includes('관망') || rec.includes('홀드')) return 'text-yellow-400';
        return 'text-gray-400';
    };

    const getSDStageColor = (stage: string) => {
        if (stage === 'Strong Accumulation') return 'bg-emerald-500/20 text-emerald-400';
        if (stage === 'Accumulation') return 'bg-green-500/20 text-green-400';
        if (stage === 'Distribution') return 'bg-red-500/20 text-red-400';
        return 'bg-gray-500/20 text-gray-400';
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />)}
            </div>
        );
    }

    const picks = data?.top_picks ?? [];

    // Grade distribution
    const gradeDistribution: Record<string, number> = {};
    picks.forEach(p => {
        const g = p.grade.includes('A') ? 'A' : p.grade.includes('B') ? 'B' : p.grade.includes('C') ? 'C' : 'D';
        gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
    });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-400 font-medium mb-4">
                    <i className="fas fa-robot"></i>
                    AI Analysis Report
                </div>
                <div className="flex items-center gap-3">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                        Top <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Picks</span>
                    </h2>
                    <HelpButton title="Top Picks 가이드" sections={[
                        { heading: '작동 원리', body: 'S&P 500 + NASDAQ 100 종목을 대상으로 퀀트 스크리닝 + AI 분석을 수행합니다.\n\n• Quant Score (0~100): 기관 매집률, RSI, 상대강도, 기술적 지표 등 정량 분석\n• AI Bonus (0~20): Gemini AI가 재무제표, 뉴스, 산업 전망을 분석한 가산점\n• Final Score = Quant Score + AI Bonus' },
                        { heading: '등급 해석', body: '• A급 (80점+): 퀀트+AI 모두 강력 긍정, 최우선 관심 종목\n• B급 (65~79점): 대부분 긍정적, 선별적 접근\n• C급 (50~64점): 일부 긍정 신호, 추가 리서치 필요\n\n매수/관망 추천은 AI가 종합 판단한 결과이며, 반드시 본인의 분석을 병행하세요.' },
                        { heading: '활용 팁', body: '종목명을 클릭하면 상세 차트와 기술적 분석을 볼 수 있습니다. 펼치기(▼) 버튼으로 AI의 투자 논거(Thesis), 촉매(Catalysts), 리스크(Risks)를 확인하세요. Target Upside는 애널리스트 목표가 대비 현재가 괴리율입니다.' },
                    ]} />
                </div>
                <p className="text-gray-400 text-lg">AI 종합 분석 기반 Top 10 추천 종목</p>
            </div>

            {/* Summary Banner */}
            <div className="p-4 rounded-2xl bg-[#1c1c1e] border border-indigo-500/20 flex flex-wrap items-center gap-6">
                <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Analyzed</div>
                    <div className="text-xl font-black text-white">{data?.total_analyzed ?? 0} <span className="text-sm text-gray-500 font-normal">stocks</span></div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Generated</div>
                    <div className="text-sm text-gray-400">{data?.generated_at ? new Date(data.generated_at).toLocaleString('ko-KR') : '--'}</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex gap-3">
                    {Object.entries(gradeDistribution).sort().map(([grade, count]) => (
                        <div key={grade} className="text-center">
                            <div className={`text-sm font-bold ${grade === 'A' ? 'text-emerald-400' : grade === 'B' ? 'text-blue-400' : grade === 'C' ? 'text-yellow-400' : 'text-gray-400'}`}>
                                {count}
                            </div>
                            <div className="text-[10px] text-gray-600">{grade}급</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Ranked Pick Cards */}
            <div className="space-y-4">
                {picks.map((pick) => {
                    const isExpanded = expandedTicker === pick.ticker;
                    const parsed = isExpanded && pick.ai_summary ? parseAISummary(pick.ai_summary) : null;

                    return (
                        <div key={pick.ticker} className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-indigo-500/30 transition-all">
                            {/* Main Row */}
                            <div className="flex items-start gap-4">
                                {/* Rank */}
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                                    <span className="text-lg font-black text-indigo-400">#{pick.rank}</span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span
                                            className="text-xl font-black text-white hover:text-indigo-400 cursor-pointer transition-colors"
                                            onClick={() => setSelectedTicker(pick.ticker)}
                                        >
                                            {pick.ticker}
                                        </span>
                                        <span className="text-sm text-gray-500 truncate">{pick.name}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getGradeColor(pick.grade)}`}>
                                            {pick.grade.replace(/📈|📊|📉/g, '').trim()}
                                        </span>
                                        <span className={`text-xs font-bold ${getRecColor(pick.ai_recommendation ?? pick.signal ?? '')}`}>
                                            {pick.ai_recommendation ?? pick.signal ?? '-'}
                                        </span>
                                    </div>

                                    {/* Score Breakdown Bar */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden flex">
                                            <div
                                                className="h-full bg-blue-500"
                                                style={{ width: `${pick.quant_score}%` }}
                                                title={`Quant: ${pick.quant_score}`}
                                            />
                                            <div
                                                className="h-full bg-purple-500"
                                                style={{ width: `${pick.ai_bonus}%` }}
                                                title={`AI: ${pick.ai_bonus}`}
                                            />
                                        </div>
                                        <span className="text-sm font-black text-white w-12 text-right">{(pick.final_score ?? pick.composite_score ?? 0).toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-600 mb-3">
                                        <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Quant {(pick.quant_score ?? 0).toFixed(1)}
                                        <span className="w-2 h-2 rounded-sm bg-purple-500 inline-block ml-2" /> AI +{pick.ai_bonus ?? 0}
                                    </div>

                                    {/* Metrics */}
                                    <div className="flex flex-wrap gap-3 text-xs">
                                        <span className="text-gray-400">Price: <span className="text-white font-bold">${(pick.current_price ?? pick.price ?? 0).toFixed(2)}</span></span>
                                        {pick.target_upside != null && (
                                        <span className="text-gray-400">Target: <span className={`font-bold ${pick.target_upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pick.target_upside > 0 ? '+' : ''}{pick.target_upside.toFixed(1)}%</span></span>
                                        )}
                                        <span className="text-gray-400">RSI: <span className="text-white font-bold">{(pick.rsi ?? 0).toFixed(1)}</span></span>
                                        {pick.inst_pct != null && <span className="text-gray-400">Inst: <span className="text-white font-bold">{pick.inst_pct.toFixed(1)}%</span></span>}
                                        {pick.sd_stage && <span className={`px-2 py-0.5 rounded-full ${getSDStageColor(pick.sd_stage)}`}>{pick.sd_stage}</span>}
                                    </div>
                                </div>

                                {/* Expand Button */}
                                <button
                                    onClick={() => setExpandedTicker(isExpanded ? null : pick.ticker)}
                                    className="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                                >
                                    <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-500 text-xs`}></i>
                                </button>
                            </div>

                            {/* Expanded AI Analysis */}
                            {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    {parsed ? (
                                        <div className="space-y-4">
                                            {/* Thesis */}
                                            <div>
                                                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Investment Thesis</h4>
                                                <p className="text-sm text-gray-300 leading-relaxed">{parsed.thesis}</p>
                                            </div>

                                            {/* Catalysts */}
                                            {parsed.catalysts && parsed.catalysts.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">Catalysts</h4>
                                                    <div className="space-y-2">
                                                        {parsed.catalysts.map((c, i) => (
                                                            <div key={i} className="pl-3 border-l-2 border-green-500/30">
                                                                <div className="text-sm text-white font-medium">{c.point}</div>
                                                                <div className="text-xs text-gray-500 mt-0.5">{c.evidence}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Risks */}
                                            {parsed.risks && parsed.risks.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Risks</h4>
                                                    <div className="space-y-2">
                                                        {parsed.risks.map((r, i) => (
                                                            <div key={i} className="pl-3 border-l-2 border-red-500/30">
                                                                <div className="text-sm text-white font-medium">{r.point}</div>
                                                                <div className="text-xs text-gray-500 mt-0.5">{r.evidence}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">AI 분석 데이터를 파싱할 수 없습니다.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {picks.length === 0 && (
                <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <i className="fas fa-robot text-3xl text-gray-600 mb-4"></i>
                    <p className="text-gray-500">No top picks report available.</p>
                    <p className="text-xs text-gray-600 mt-1">Run: python3 us_market/update_all.py</p>
                </div>
            )}

            {/* Stock Detail Modal */}
            {selectedTicker && (
                <StockDetailModal
                    ticker={selectedTicker}
                    onClose={() => setSelectedTicker(null)}
                />
            )}
        </div>
    );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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

const RATING_KR: Record<string, string> = {
    'No VCP': 'VCP 아님',
    'Weak': '약함',
    'Developing': '형성 중',
    'Good': '양호',
    'Strong': '강함',
    'Textbook': '교과서적',
};

const SECTOR_KR: Record<string, string> = {
    'Information Technology': '정보기술', 'Technology': '기술', 'Healthcare': '헬스케어',
    'Financials': '금융', 'Consumer Cyclical': '경기소비재', 'Consumer Defensive': '필수소비재',
    'Communication Services': '통신서비스', 'Industrials': '산업재', 'Energy': '에너지',
    'Basic Materials': '소재', 'Utilities': '유틸리티', 'Real Estate': '부동산',
};

function translateRating(rating: string): string {
    return RATING_KR[rating] || rating;
}

export default function VCPScreenerPage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [running, setRunning] = useState(false);

    const loadData = useCallback(() => {
        skillsAPI.getVCP()
            .then(data => { setReport(data); setError(''); })
            .catch(() => setError('VCP 리포트가 없습니다.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleRun = async () => {
        setRunning(true);
        try {
            await skillsAPI.runSkill('vcp-screener');
            const poll = setInterval(() => {
                skillsAPI.getStatus().then((s: any) => {
                    if (!s.running?.['vcp-screener']) { clearInterval(poll); setRunning(false); loadData(); }
                });
            }, 3000);
        } catch { setRunning(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-rose-500/20 border-t-rose-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Link href="/dashboard/skills" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
                    <span>&larr;</span> 스킬 허브
                </Link>
                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-10 text-center">
                    <p className="text-gray-400">{error}</p>
                    <button onClick={handleRun} disabled={running}
                        className="mt-4 px-6 py-2.5 rounded-xl font-medium bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all">
                        {running ? '실행 중...' : '실행'}
                    </button>
                </div>
            </div>
        );
    }

    const results: VCPResult[] = report?.results || [];
    const metadata = report?.metadata || {};

    return (
        <div className="space-y-6">
            <Link href="/dashboard/skills" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
                <span>&larr;</span> 스킬 허브
            </Link>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">미국 VCP 스크리너</h1>
                    <p className="text-gray-500 mt-1">미너비니 변동성 수축 패턴</p>
                </div>
                <div className="flex items-center gap-3">
                    {metadata.generated_at && (
                        <span className="text-xs text-gray-600">
                            업데이트: {new Date(metadata.generated_at).toLocaleString()}
                        </span>
                    )}
                    <button onClick={handleRun} disabled={running}
                        className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${running ? 'bg-blue-500/20 text-blue-400 animate-pulse cursor-wait' : 'bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'}`}>
                        {running ? '실행 중...' : '실행'}
                    </button>
                </div>
            </div>

            {/* Summary */}
            {report?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">유니버스</p>
                        <p className="text-2xl font-bold text-white mt-1">{report.summary.universe_size || '-'}</p>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">후보</p>
                        <p className="text-2xl font-bold text-rose-400 mt-1">{results.length}</p>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">진입 가능</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">
                            {results.filter(r => r.entry_ready).length}
                        </p>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">평균 점수</p>
                        <p className="text-2xl font-bold text-amber-400 mt-1">
                            {results.length > 0 ? (results.reduce((s, r) => s + r.composite_score, 0) / results.length).toFixed(1) : '-'}
                        </p>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left p-4 text-xs uppercase tracking-wider text-gray-500">종목</th>
                            <th className="text-left p-4 text-xs uppercase tracking-wider text-gray-500">섹터</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider text-gray-500">점수</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider text-gray-500">현재가</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider text-gray-500">피봇</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider text-gray-500">위험 %</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider text-gray-500">RS</th>
                            <th className="text-center p-4 text-xs uppercase tracking-wider text-gray-500">진입</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {results.map((r, i) => (
                            <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                                <td className="p-4">
                                    <span className="text-white font-medium">{r.symbol}</span>
                                    {r.name && <span className="text-gray-600 ml-2 text-xs">{r.name}</span>}
                                </td>
                                <td className="p-4 text-gray-400 text-xs">{(r.sector && SECTOR_KR[r.sector]) || r.sector || '-'}</td>
                                <td className="p-4 text-right">
                                    <span className={`font-semibold ${r.composite_score >= 80 ? 'text-green-400' : r.composite_score >= 60 ? 'text-amber-400' : 'text-gray-400'}`}>
                                        {r.composite_score?.toFixed(1)}
                                    </span>
                                </td>
                                <td className="p-4 text-right text-white">${r.current_price?.toFixed(2)}</td>
                                <td className="p-4 text-right text-cyan-400">${r.pivot_price?.toFixed(2)}</td>
                                <td className="p-4 text-right text-orange-400">{r.risk_pct?.toFixed(1)}%</td>
                                <td className="p-4 text-right text-purple-400">{r.relative_strength?.toFixed(0)}</td>
                                <td className="p-4 text-center">
                                    {r.entry_ready ? (
                                        <span className="text-green-400 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">준비</span>
                                    ) : (
                                        <span className="text-gray-600 text-xs">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {results.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-10 text-center text-gray-500">
                                    VCP 패턴을 찾지 못했습니다. <code className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">/skill-vcp-screener</code> 실행
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

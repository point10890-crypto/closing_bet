'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Stock {
    id: number;
    name: string;
    url: string;
}

interface AnalyzeResult {
    name: string;
    result: string;
    date: string;
    url: string;
}

interface HistoryEntry {
    index: number;
    id: number;
    name: string;
    result: string;
    date: string;
}

function getResultColor(text: string) {
    if (text.includes('적극 매수')) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (text.includes('매수')) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (text.includes('적극 매도')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (text.includes('매도')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (text.includes('중립')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-gray-400 bg-white/5 border-white/10';
}

function StockAnalyzerContent() {
    const searchParams = useSearchParams();

    // Search state
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Stock[]>([]);
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);

    // Analysis state
    const [loading, setLoading] = useState(false);
    const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
    const [error, setError] = useState('');

    // History state
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // Toast state
    const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

    // Refs
    const debounceRef = useRef<NodeJS.Timeout>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const autoAnalyzed = useRef(false);

    const showToast = useCallback((message: string, isError: boolean) => {
        setToast({ message, isError });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Analyze stock
    const analyzeStock = useCallback(async (stock: Stock) => {
        setLoading(true);
        setAnalyzeResult(null);
        setError('');

        try {
            const res = await fetch('/api/stock-analyzer/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: stock.url, name: stock.name })
            });
            const data = await res.json();

            if (res.ok) {
                setAnalyzeResult(data);
                const entry: HistoryEntry = {
                    index: 0,
                    id: stock.id,
                    name: data.name,
                    result: data.result,
                    date: data.date
                };
                setHistory(prev => {
                    const updated = [{ ...entry, index: prev.length + 1 }, ...prev];
                    return updated;
                });
                showToast(`${data.name}: ${data.result}`, false);
            } else {
                setError(data.error || '분석 실패');
                showToast(data.error || '분석 실패', true);
            }
        } catch {
            setError('네트워크 오류');
            showToast('네트워크 오류', true);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    // Auto-analyze from URL params (CommandPalette redirect)
    useEffect(() => {
        if (autoAnalyzed.current) return;
        const name = searchParams.get('name');
        const url = searchParams.get('url');
        const id = searchParams.get('id');

        if (name && url) {
            autoAnalyzed.current = true;
            const stock: Stock = { id: Number(id) || 0, name, url };
            setSelectedStock(stock);
            setQuery(name);
            analyzeStock(stock);
        }
    }, [searchParams, analyzeStock]);

    // Search stocks with debounce
    const searchStocks = useCallback(async (q: string) => {
        if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
        try {
            const res = await fetch(`/api/stock-analyzer/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
                setSelectedIndex(0);
                setShowDropdown(data.length > 0);
            }
        } catch { setSearchResults([]); setShowDropdown(false); }
    }, []);

    const handleInput = (val: string) => {
        setQuery(val);
        setSelectedStock(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchStocks(val), 300);
    };

    const selectStock = (stock: Stock) => {
        setSelectedStock(stock);
        setQuery(stock.name);
        setSearchResults([]);
        setShowDropdown(false);
        setError('');
    };

    const clearSelection = () => {
        setSelectedStock(null);
        setQuery('');
        setAnalyzeResult(null);
        setError('');
        inputRef.current?.focus();
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || searchResults.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            selectStock(searchResults[selectedIndex]);
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = () => setShowDropdown(false);
        if (showDropdown) {
            setTimeout(() => document.addEventListener('click', handleClick), 0);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [showDropdown]);

    // Excel export
    const exportExcel = async () => {
        if (history.length === 0) return;
        const records = history.map(h => ({
            '순번': h.id,
            '종목': h.name,
            '분석결과': h.result,
            '조회시간': h.date
        }));
        try {
            const res = await fetch('/api/stock-analyzer/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records })
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const now = new Date();
                a.download = `${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_propicks_result.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(`${history.length}건 Excel 다운로드 완료`, false);
            } else {
                showToast('Excel 내보내기 실패', true);
            }
        } catch {
            showToast('Excel 내보내기 실패', true);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/5 text-xs text-orange-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                    ProPicks Analyzer
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                            Stock <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">Analyzer</span>
                        </h2>
                        <p className="text-gray-400 text-lg">Investing.com ProPicks 분석 결과 조회</p>
                    </div>
                    {history.length > 0 && (
                        <button onClick={exportExcel}
                            className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold rounded-xl hover:bg-emerald-500/20 transition-colors">
                            <i className="fas fa-file-excel mr-2"></i>Excel 내보내기
                        </button>
                    )}
                </div>
            </div>

            {/* Search Card */}
            <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">종목 검색</h3>
                <div className="relative">
                    <div className="flex items-center">
                        <i className="fas fa-search text-gray-500 text-sm mr-3"></i>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => handleInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full py-3 bg-transparent text-sm text-white placeholder-gray-500 outline-none border-b border-white/10 focus:border-orange-500/50 transition-colors"
                            placeholder="종목명을 입력하세요 (예: 삼성전자, SK하이닉스...)"
                            disabled={loading}
                        />
                        {query && !loading && (
                            <button onClick={clearSelection} className="text-gray-500 hover:text-white ml-2">
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        )}
                    </div>

                    {/* Dropdown results */}
                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0c] border border-white/10 rounded-xl max-h-64 overflow-y-auto z-50 shadow-2xl">
                            {searchResults.map((stock, i) => (
                                <button
                                    key={stock.id}
                                    onClick={(e) => { e.stopPropagation(); selectStock(stock); }}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                                        i === selectedIndex ? 'bg-orange-500/10 text-white' : 'text-gray-300 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-gray-600 w-8 text-right">#{stock.id}</span>
                                        <span className="text-sm">{stock.name}</span>
                                    </div>
                                    <i className="fas fa-chevron-right text-[10px] text-gray-600"></i>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Stock Bar */}
                {selectedStock && !loading && (
                    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="min-w-0 flex-1">
                            <div className="text-white font-bold">{selectedStock.name}</div>
                            <div className="text-xs text-gray-600 mt-1 truncate">{selectedStock.url}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button onClick={() => analyzeStock(selectedStock)}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-lg transition-colors active:scale-95">
                                분석 조회
                            </button>
                            <button onClick={clearSelection}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 text-sm rounded-lg border border-white/10 transition-colors">
                                취소
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="p-8 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                    <div className="w-10 h-10 border-[3px] border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 text-sm">분석 결과를 가져오는 중... (약 10~20초 소요)</p>
                    <p className="text-gray-600 text-xs mt-2">{selectedStock?.name}</p>
                </div>
            )}

            {/* Analysis Result */}
            {analyzeResult && !loading && (
                <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">분석 결과</h3>
                        <span className="text-xs text-gray-600">{analyzeResult.date}</span>
                    </div>
                    <div className="text-center py-4">
                        <p className="text-lg text-gray-300 mb-3">{analyzeResult.name}</p>
                        <div className={`inline-block px-8 py-4 rounded-xl text-3xl font-bold border ${getResultColor(analyzeResult.result)}`}>
                            {analyzeResult.result}
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
                    <i className="fas fa-exclamation-triangle text-red-400 text-2xl mb-3 block"></i>
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* History Table */}
            {history.length > 0 && (
                <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                            조회 기록 ({history.length}건)
                        </h3>
                        <button onClick={exportExcel}
                            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500/20 transition-colors">
                            <i className="fas fa-file-excel mr-2"></i>Excel 저장
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">#</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">순번</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">종목</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">분석 결과</th>
                                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">조회 시간</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 text-sm text-gray-400">{history.length - i}</td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{h.id}</td>
                                        <td className="px-4 py-3 text-sm text-white">{h.name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-3 py-1 rounded text-xs font-bold border ${getResultColor(h.result)}`}>
                                                {h.result}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">{h.date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && !analyzeResult && !error && !selectedStock && history.length === 0 && (
                <div className="text-center py-20">
                    <i className="fas fa-chart-bar text-4xl text-gray-700 mb-4 block"></i>
                    <p className="text-gray-500 text-sm">
                        종목을 검색하고 &quot;분석 조회&quot; 버튼을 클릭하면<br />
                        자동으로 분석 결과를 가져옵니다.
                    </p>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-medium text-white shadow-2xl transition-all ${
                    toast.isError ? 'bg-red-600' : 'bg-emerald-600'
                }`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}

export default function StockAnalyzerPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
        }>
            <StockAnalyzerContent />
        </Suspense>
    );
}

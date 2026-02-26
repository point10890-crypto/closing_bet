'use client';

import { useEffect, useState } from 'react';
import { skillsAPI } from '@/lib/api';

interface ThemeResult {
    theme: string;
    heat_score?: number;
    lifecycle_score?: number;
    confidence_score?: number;
    composite_score?: number;
    etfs?: string[];
    representative_stocks?: string[];
    description?: string;
}

export default function ThemesPage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        skillsAPI.getThemes()
            .then(data => setReport(data))
            .catch(() => setError('No theme report. Run /skill-theme-detector first.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-400">{error}</p>
            </div>
        );
    }

    const themes: ThemeResult[] = report?.results || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Theme Detector</h1>
                <p className="text-gray-400 mt-1">3D Scoring: Heat x Lifecycle x Confidence</p>
            </div>

            {/* Themes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {themes.map((theme, i) => (
                    <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
                        <div className="flex items-start justify-between">
                            <h3 className="text-lg font-semibold text-white">{theme.theme}</h3>
                            {theme.composite_score !== undefined && (
                                <span className={`text-lg font-bold ${
                                    theme.composite_score >= 70 ? 'text-green-400' :
                                    theme.composite_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                    {theme.composite_score.toFixed(0)}
                                </span>
                            )}
                        </div>

                        {theme.description && (
                            <p className="text-sm text-gray-400 mt-2">{theme.description}</p>
                        )}

                        {/* Score Bars */}
                        <div className="mt-4 space-y-2">
                            {theme.heat_score !== undefined && (
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Heat</span>
                                        <span>{theme.heat_score.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-900 rounded-full">
                                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${theme.heat_score}%` }} />
                                    </div>
                                </div>
                            )}
                            {theme.lifecycle_score !== undefined && (
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Lifecycle</span>
                                        <span>{theme.lifecycle_score.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-900 rounded-full">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${theme.lifecycle_score}%` }} />
                                    </div>
                                </div>
                            )}
                            {theme.confidence_score !== undefined && (
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Confidence</span>
                                        <span>{theme.confidence_score.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-900 rounded-full">
                                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${theme.confidence_score}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ETFs & Stocks */}
                        <div className="mt-3 flex flex-wrap gap-1">
                            {(theme.etfs || []).map((etf, j) => (
                                <span key={j} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{etf}</span>
                            ))}
                            {(theme.representative_stocks || []).slice(0, 5).map((stock, j) => (
                                <span key={j} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{stock}</span>
                            ))}
                        </div>
                    </div>
                ))}
                {themes.length === 0 && (
                    <div className="col-span-2 text-center p-8 text-gray-500">
                        No themes detected. Run <code className="text-amber-400">/skill-theme-detector</code>
                    </div>
                )}
            </div>

            {report?._report_time && (
                <p className="text-xs text-gray-600 text-right">
                    Report: {new Date(report._report_time).toLocaleString()}
                </p>
            )}
        </div>
    );
}

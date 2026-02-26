'use client';

import { useEffect, useState } from 'react';
import { skillsAPI } from '@/lib/api';

const REGIME_STYLES: Record<string, { color: string; bg: string; label: string }> = {
    expansion: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Expansion' },
    risk_on: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Risk On' },
    recovery: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Recovery' },
    neutral: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Neutral' },
    caution: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Caution' },
    risk_off: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Risk Off' },
    contraction: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Contraction' },
    crisis: { color: 'text-red-500', bg: 'bg-red-500/20', label: 'Crisis' },
};

export default function RegimePage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        skillsAPI.getMacroRegime()
            .then(data => setReport(data))
            .catch(() => setError('No macro regime report. Run /skill-macro-regime first.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
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

    const results = report?.results?.[0] || report?.results || {};
    const regime = (results?.regime || results?.classification || 'neutral').toLowerCase();
    const style = REGIME_STYLES[regime] || REGIME_STYLES.neutral;
    const components = results?.components || results?.signals || {};
    const score = results?.composite_score ?? results?.score ?? 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Macro Regime Detector</h1>
                <p className="text-gray-400 mt-1">6-Component Macro Environment Classification</p>
            </div>

            {/* Current Regime */}
            <div className={`${style.bg} border border-gray-700 rounded-lg p-8 text-center`}>
                <p className="text-sm text-gray-400 mb-2">Current Regime</p>
                <p className={`text-5xl font-bold ${style.color}`}>{style.label}</p>
                <p className="text-2xl font-medium text-gray-400 mt-2">Score: {score.toFixed?.(1) ?? score}</p>
            </div>

            {/* Components */}
            {Object.keys(components).length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-300 mb-3">Regime Components</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(components).map(([key, comp]: [string, any]) => (
                            <div key={key} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-sm text-gray-400 capitalize">{key.replace(/_/g, ' ')}</p>
                                <div className="mt-2">
                                    {typeof comp === 'object' ? (
                                        <>
                                            <p className="text-xl font-bold text-white">{comp.signal || comp.regime || comp.value || '-'}</p>
                                            {comp.score !== undefined && (
                                                <p className="text-xs text-gray-500 mt-1">Score: {comp.score}</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xl font-bold text-white">{String(comp)}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {report?._report_time && (
                <p className="text-xs text-gray-600 text-right">
                    Report: {new Date(report._report_time).toLocaleString()}
                </p>
            )}
        </div>
    );
}

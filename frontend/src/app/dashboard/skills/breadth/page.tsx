'use client';

import { useEffect, useState } from 'react';
import { skillsAPI } from '@/lib/api';

const HEALTH_ZONES = [
    { min: 80, label: 'Strong', color: 'text-green-400', bg: 'bg-green-500', exposure: '90-100%' },
    { min: 60, label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500', exposure: '75-90%' },
    { min: 40, label: 'Neutral', color: 'text-yellow-400', bg: 'bg-yellow-500', exposure: '60-75%' },
    { min: 20, label: 'Weakening', color: 'text-orange-400', bg: 'bg-orange-500', exposure: '40-60%' },
    { min: 0, label: 'Critical', color: 'text-red-400', bg: 'bg-red-500', exposure: '25-40%' },
];

function getHealthZone(score: number) {
    return HEALTH_ZONES.find(z => score >= z.min) || HEALTH_ZONES[HEALTH_ZONES.length - 1];
}

export default function BreadthPage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        skillsAPI.getMarketBreadth()
            .then(data => setReport(data))
            .catch(() => setError('No market breadth report. Run /skill-market-breadth first.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-400">{error}</p>
                <p className="text-sm text-gray-600 mt-2">No API key needed - uses free public data</p>
            </div>
        );
    }

    const results = report?.results?.[0] || report?.results || {};
    const score = results?.composite_score ?? results?.score ?? 0;
    const zone = getHealthZone(score);
    const components = results?.components || results?.scoring?.components || {};

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Market Breadth Analyzer</h1>
                <p className="text-gray-400 mt-1">6-Component Market Health Score (No API key required)</p>
            </div>

            {/* Main Score */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-400 mb-2">Composite Health Score</p>
                <p className={`text-6xl font-bold ${zone.color}`}>{score.toFixed(0)}</p>
                <p className={`text-lg font-medium mt-2 ${zone.color}`}>{zone.label}</p>
                <p className="text-sm text-gray-500 mt-1">Recommended Equity Exposure: {zone.exposure}</p>
            </div>

            {/* Score Bar */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="h-4 bg-gray-900 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${zone.bg} rounded-full transition-all duration-1000`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>Critical (0)</span>
                    <span>Neutral (50)</span>
                    <span>Strong (100)</span>
                </div>
            </div>

            {/* Components */}
            {Object.keys(components).length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-300 mb-3">Score Components</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(components).map(([key, comp]: [string, any]) => (
                            <div key={key} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-sm text-gray-400 capitalize">{key.replace(/_/g, ' ')}</p>
                                <div className="flex items-end justify-between mt-2">
                                    <p className="text-2xl font-bold text-white">
                                        {typeof comp === 'object' ? (comp.score ?? comp.value ?? '-') : comp}
                                    </p>
                                    {typeof comp === 'object' && comp.weight && (
                                        <span className="text-xs text-gray-600">weight: {(comp.weight * 100).toFixed(0)}%</span>
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

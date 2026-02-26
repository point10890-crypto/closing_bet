'use client';

import { useEffect, useState } from 'react';
import { skillsAPI, SkillInfo } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
    screening: 'Screening',
    timing: 'Market Timing',
    analysis: 'Analysis',
    earnings: 'Earnings',
    strategy: 'Strategy & Risk',
    institutional: 'Institutional',
    edge: 'Edge Discovery',
    dividend: 'Dividend',
    risk: 'Risk',
    meta: 'Meta',
};

const CATEGORY_COLORS: Record<string, string> = {
    screening: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    timing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    analysis: 'bg-green-500/20 text-green-400 border-green-500/30',
    earnings: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    strategy: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    institutional: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    edge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    dividend: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    risk: 'bg-red-500/20 text-red-400 border-red-500/30',
    meta: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function SkillsHubPage() {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        skillsAPI.getCatalog()
            .then(data => {
                setSkills(data.skills);
                setCategories(data.categories);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === 'all' ? skills : skills.filter(s => s.category === filter);
    const grouped = filtered.reduce((acc, s) => {
        const cat = s.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(s);
        return acc;
    }, {} as Record<string, SkillInfo[]>);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Trading Skills Hub</h1>
                    <p className="text-gray-400 mt-1">{skills.length} skills integrated from claude-trading-skills</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {skills.filter(s => s.has_report).length} reports available
                    </span>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filter === 'all' ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    All ({skills.length})
                </button>
                {categories.sort().map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            filter === cat ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {CATEGORY_LABELS[cat] || cat} ({skills.filter(s => s.category === cat).length})
                    </button>
                ))}
            </div>

            {/* Skills Grid by Category */}
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catSkills]) => (
                <div key={category}>
                    <h2 className="text-lg font-semibold text-gray-300 mb-3">
                        {CATEGORY_LABELS[category] || category}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catSkills.map(skill => (
                            <div
                                key={skill.id}
                                className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-medium text-white">{skill.name}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">{skill.id}</p>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[skill.category] || 'bg-gray-700 text-gray-400'}`}>
                                        {CATEGORY_LABELS[skill.category] || skill.category}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 mt-3 text-xs">
                                    {skill.has_script ? (
                                        <span className="text-green-400">Script</span>
                                    ) : (
                                        <span className="text-gray-600">Prompt-only</span>
                                    )}
                                    {skill.api_key_required && (
                                        <span className="text-yellow-500">{skill.api_key_required}</span>
                                    )}
                                    {skill.running && (
                                        <span className="text-blue-400 animate-pulse">Running...</span>
                                    )}
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                    {skill.has_report ? (
                                        <span className="text-xs text-green-400">
                                            Report: {new Date(skill.last_report_time!).toLocaleDateString()}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-600">No report yet</span>
                                    )}
                                    {skill.has_script && (
                                        <span className="text-xs text-gray-500">
                                            /skill-{skill.id}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

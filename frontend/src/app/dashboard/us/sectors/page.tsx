'use client';

import { useState } from 'react';
import { HeatmapView } from '../heatmap/page';
import { RotationView } from '../sector-rotation/page';

type Tab = 'heatmap' | 'rotation';

export default function SectorsPage() {
    const [tab, setTab] = useState<Tab>('heatmap');

    return (
        <div className="space-y-6">
            {/* Tab Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTab('heatmap')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'heatmap'
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                >
                    Heatmap
                </button>
                <button
                    onClick={() => setTab('rotation')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'rotation'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                >
                    Rotation
                </button>
            </div>

            {/* Tab Content */}
            {tab === 'heatmap' ? <HeatmapView /> : <RotationView />}
        </div>
    );
}

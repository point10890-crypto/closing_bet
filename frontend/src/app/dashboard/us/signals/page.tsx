'use client';

import { useState } from 'react';
import { VCPView } from '../vcp/page';
import { NewsView } from '../news/page';

type Tab = 'vcp' | 'news';

export default function SignalsPage() {
    const [tab, setTab] = useState<Tab>('vcp');

    return (
        <div className="space-y-6">
            {/* Tab Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTab('vcp')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'vcp'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                >
                    VCP Scanner
                </button>
                <button
                    onClick={() => setTab('news')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'news'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                >
                    News
                </button>
            </div>

            {/* Tab Content */}
            {tab === 'vcp' ? <VCPView /> : <NewsView />}
        </div>
    );
}

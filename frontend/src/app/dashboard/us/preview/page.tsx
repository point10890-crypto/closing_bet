'use client';

import { useEffect, useState } from 'react';
import { fetchAPI } from '@/lib/api';
import MarketOverview from '@/components/us-preview/MarketOverview';
import FearGreedGauge from '@/components/us-preview/FearGreedGauge';
import TopPicks from '@/components/us-preview/TopPicks';
import Prediction from '@/components/us-preview/Prediction';
import SectorHeatmap from '@/components/us-preview/SectorHeatmap';
import Briefing from '@/components/us-preview/Briefing';

export default function USPreviewPage() {
  const [marketData, setMarketData] = useState<any>(null);
  const [fearGreed, setFearGreed] = useState<any>(null);
  const [topPicks, setTopPicks] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [sectorData, setSectorData] = useState<any>(null);
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchAPI<any>('/api/us/preview/market-data'),
        fetchAPI<any>('/api/us/preview/top-picks'),
        fetchAPI<any>('/api/us/preview/prediction'),
        fetchAPI<any>('/api/us/preview/sector-heatmap'),
        fetchAPI<any>('/api/us/preview/briefing'),
      ]);

      if (results[0].status === 'fulfilled') {
        const md = results[0].value;
        setMarketData(md);
        if (md.fear_greed) setFearGreed(md.fear_greed);
      }
      if (results[1].status === 'fulfilled') setTopPicks(results[1].value);
      if (results[2].status === 'fulfilled') setPrediction(results[2].value);
      if (results[3].status === 'fulfilled') setSectorData(results[3].value);
      if (results[4].status === 'fulfilled') setBriefing(results[4].value);

      setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Failed to load preview data:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">US Night Preview</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 uppercase">
              Preview
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">Market Data · Smart Money · ML Prediction · AI Briefing</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-gray-500">{lastUpdated}</span>}
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-colors disabled:opacity-50"
          >
            <i className={`fas fa-sync-alt mr-1 ${loading ? 'animate-spin' : ''}`}></i>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Market Overview */}
      <MarketOverview data={marketData} />

      {/* 3-Column: Fear&Greed, Prediction, Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FearGreedGauge data={fearGreed} />
        <Prediction data={prediction} />
        <SectorHeatmap data={sectorData} />
      </div>

      {/* Top Picks */}
      <TopPicks data={topPicks} />

      {/* AI Briefing */}
      <Briefing data={briefing} />

      {/* Footer Disclaimer */}
      <div className="text-center text-xs text-gray-600 py-4 border-t border-white/5">
        <i className="fas fa-info-circle mr-1"></i>
        본 자료는 교육 목적으로만 제공되며 투자 조언이 아닙니다. · Built with yfinance, Next.js, Flask
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

const DATA_SOURCES = [
  { label: 'S&P', param: 'SPX500', fullLabel: 'S&P 500' },
  { label: 'NDQ', param: 'NASDAQ100', fullLabel: 'NASDAQ' },
  { label: 'DOW', param: 'DJ30', fullLabel: 'Dow Jones' },
  { label: 'ALL', param: 'AllUSA', fullLabel: 'Full Market' },
];

const BLOCK_SIZES = [
  { label: 'Cap', param: 'market_cap_basic', fullLabel: 'Market Cap' },
  { label: 'Vol', param: 'volume|1', fullLabel: 'Volume' },
  { label: 'Emp', param: 'number_of_employees', fullLabel: 'Employees' },
];

export default function USHeatmapPage() {
  const [activeSource, setActiveSource] = useState('SPX500');
  const [blockSize, setBlockSize] = useState('market_cap_basic');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      exchanges: [],
      dataSource: activeSource,
      grouping: 'sector',
      blockSize: blockSize,
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSet498: activeSource === 'SPX500',
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    });

    containerRef.current.appendChild(script);
  }, [activeSource, blockSize]);

  return (
    <div className="min-h-0 bg-[#0a0a0a] text-white">
      {/* Header - compact on mobile */}
      <div className="flex flex-col gap-2 sm:gap-4 mb-2 sm:mb-4">
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap shrink-0">
              Live
            </span>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight truncate">
              US <span className="text-red-400">Heatmap</span>
            </h1>
          </div>
          {/* Finviz link - top right on mobile */}
          <a
            href="https://finviz.com/map.ashx?t=sec_all&st=w1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] sm:text-xs text-red-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
          >
            <i className="fas fa-external-link-alt text-[8px] sm:text-[10px]" />
            <span className="hidden sm:inline">Open Finviz</span>
            <span className="sm:hidden">Finviz</span>
          </a>
        </div>

        {/* Selectors Row - horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {/* Data Source Selector */}
          <div className="flex gap-0.5 sm:gap-1 bg-[#1c1c1e] rounded-lg sm:rounded-xl p-0.5 sm:p-1 border border-white/10 shrink-0">
            {DATA_SOURCES.map((s) => (
              <button
                key={s.param}
                onClick={() => setActiveSource(s.param)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
                  activeSource === s.param
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="sm:hidden">{s.label}</span>
                <span className="hidden sm:inline">{s.fullLabel}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 shrink-0 hidden xs:block" />

          {/* Block Size Selector */}
          <div className="flex gap-0.5 sm:gap-1 bg-[#1c1c1e] rounded-lg sm:rounded-xl p-0.5 sm:p-1 border border-white/10 shrink-0">
            {BLOCK_SIZES.map((b) => (
              <button
                key={b.param}
                onClick={() => setBlockSize(b.param)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
                  blockSize === b.param
                    ? 'bg-white/20 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="sm:hidden">{b.label}</span>
                <span className="hidden sm:inline">{b.fullLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TradingView Heatmap Widget - responsive height */}
      <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 bg-[#1c1c1e]"
           style={{ height: 'calc(100vh - 220px)', minHeight: '300px' }}>
        <div className="tradingview-widget-container" style={{ width: '100%', height: '100%' }}>
          <div ref={containerRef} className="tradingview-widget-container__widget" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      {/* Footer - minimal on mobile */}
      <div className="mt-2 sm:mt-3">
        <p className="text-[10px] sm:text-xs text-gray-600">
          Powered by TradingView
        </p>
      </div>
    </div>
  );
}

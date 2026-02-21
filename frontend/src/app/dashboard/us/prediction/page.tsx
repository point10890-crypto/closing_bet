'use client';

import { useEffect, useState } from 'react';
import { usAPI, IndexPredictionData } from '@/lib/api';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Tip from '@/components/ui/Tip';
import HelpButton from '@/components/ui/HelpButton';

const IMPACT_BAR_SCALE = 500;
const TARGET_PADDING_PCT = 10;

export default function IndexPredictionPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<IndexPredictionData | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await usAPI.getIndexPrediction();
            setData(res);
        } catch {
            setError('Failed to load prediction data.');
        } finally {
            setLoading(false);
        }
    };

    const getConfidenceColor = (level: string) => {
        if (level === 'High') return 'text-green-400';
        if (level === 'Moderate') return 'text-yellow-400';
        return 'text-gray-400';
    };

    const getProbabilityBarColor = (prob: number, isBullish: boolean) => {
        if (isBullish) {
            if (prob >= 65) return 'bg-green-500';
            if (prob >= 55) return 'bg-green-400/80';
            return 'bg-green-400/50';
        }
        if (prob >= 65) return 'bg-red-500';
        if (prob >= 55) return 'bg-red-400/80';
        return 'bg-red-400/50';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/20 bg-red-500/5 text-xs text-red-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                    ML Prediction
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                                Index <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">Prediction</span>
                            </h2>
                            <HelpButton title="Index Prediction 가이드" sections={[
                                { heading: '작동 원리', body: 'GradientBoosting 앙상블 모델이 SPY/QQQ의 다음 주 방향을 예측합니다.\n\n• 입력 피처: RSI, MACD, 볼린저밴드, VIX, 거래량 변화율, 섹터 상대강도 등 30+ 지표\n• 출력: Bullish/Bearish 확률 (0~100%)\n• Confidence Level: 예측 신뢰도 (High/Moderate/Low)' },
                                { heading: '해석 방법', body: '• Bullish 65%+: 강한 상승 신호, 롱 포지션 유리\n• Bullish 55~65%: 약한 상승 신호, 선별적 접근\n• 50% 근처: 방향성 불확실, 관망 권장\n• Key Drivers: 예측에 가장 크게 기여한 지표 확인\n• 과거 정확도(Accuracy)를 함께 참고하세요' },
                                { heading: '활용 팁', body: '• Regime이 Risk-Off/Crisis일 때 Bullish 예측은 신뢰도 하향 조정\n• Market Gate가 RED인데 ML이 Bullish면 → 단기 반등 가능성만 고려\n• SPY와 QQQ 예측이 일치하면 신뢰도 상승\n• Key Drivers에서 VIX가 상위면 변동성 주도 시장' },
                            ]} />
                        </div>
                        <p className="text-gray-400">ML-based next-week direction probability for S&P 500 / Nasdaq</p>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <i className={`fas fa-sync-alt mr-2 ${loading ? 'animate-spin' : ''}`}></i>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && <ErrorBanner message={error} onRetry={loadData} />}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse"></div>
                    ))}
                </div>
            ) : !data || !data.predictions || Object.keys(data.predictions).length === 0 ? (
                !error && (
                    <div className="p-12 rounded-2xl bg-[#1c1c1e] border border-white/10 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                            <i className="fas fa-brain text-2xl text-red-500"></i>
                        </div>
                        <div className="text-gray-500 text-lg mb-2">No prediction data available</div>
                        <div className="text-xs text-gray-600">Run: python3 us_market/index_predictor.py</div>
                        <div className="text-xs text-gray-600 mt-1">Requires: pip install scikit-learn scipy joblib</div>
                    </div>
                )
            ) : (
                <>
                    {/* Disclaimer Banner */}
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                        <span className="text-yellow-400 text-xs font-medium">
                            <i className="fas fa-exclamation-triangle mr-1"></i>
                            {data.disclaimer_ko}
                        </span>
                    </div>

                    {/* Prediction Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(data.predictions).map(([ticker, pred]) => (
                            <div key={ticker} className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 space-y-5">
                                {/* Ticker Header */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-white">{ticker.toUpperCase()}</h3>
                                        <span className="text-gray-500 text-sm">${pred.current_price?.toLocaleString() ?? '--'}</span>
                                    </div>
                                    <div className="relative group">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${getConfidenceColor(pred.confidence_level)} bg-white/5 cursor-help`}>
                                            {pred.confidence_level} Confidence
                                        </div>
                                        <Tip text="Confidence is derived from the gap between bullish and bearish probabilities. High = >65% one-sided, Moderate = 55-65%, Low = <55%." />
                                    </div>
                                </div>

                                {/* Probability Gauge */}
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                                        <span className="relative group cursor-help">
                                            Bearish {pred.bearish_probability ?? '--'}%
                                            <Tip text="Probability the index closes lower in 5 trading days, based on gradient-boosted ensemble model." />
                                        </span>
                                        <span className="relative group cursor-help">
                                            Bullish {pred.bullish_probability ?? '--'}%
                                            <Tip text="Probability the index closes higher in 5 trading days, based on gradient-boosted ensemble model." />
                                        </span>
                                    </div>
                                    <div className="h-6 bg-white/5 rounded-full overflow-hidden flex">
                                        <div
                                            className={`h-full ${getProbabilityBarColor(pred.bearish_probability, false)} transition-all`}
                                            style={{ width: `${pred.bearish_probability ?? 0}%` }}
                                        ></div>
                                        <div
                                            className={`h-full ${getProbabilityBarColor(pred.bullish_probability ?? 0, true)} transition-all`}
                                            style={{ width: `${pred.bullish_probability ?? 0}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-center mt-2">
                                        <span className={`text-lg font-black ${(pred.bullish_probability ?? 0) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(pred.predicted_return_pct ?? 0) >= 0 ? '+' : ''}{pred.predicted_return_pct ?? '--'}%
                                        </span>
                                        <span className="text-gray-500 text-xs ml-2">predicted return (5d)</span>
                                    </div>
                                </div>

                                {/* Target Range */}
                                <div>
                                    <div className="text-xs text-gray-500 mb-2">Target Range (5 days)</div>
                                    <div className="relative h-8 bg-white/5 rounded-lg overflow-hidden">
                                        <div className="absolute inset-y-0 bg-blue-500/20 rounded"
                                            style={{
                                                left: `${TARGET_PADDING_PCT}%`,
                                                right: `${TARGET_PADDING_PCT}%`,
                                            }}
                                        ></div>
                                        <div className="absolute inset-y-0 w-0.5 bg-white/50"
                                            style={{
                                                left: pred.target_range ? `${((pred.current_price - pred.target_range.low) / ((pred.target_range.high - pred.target_range.low) || 1)) * (100 - 2 * TARGET_PADDING_PCT) + TARGET_PADDING_PCT}%` : '50%'
                                            }}
                                        ></div>
                                        <div className="absolute inset-0 flex justify-between items-center px-3">
                                            <span className="text-xs text-red-400 font-mono">${pred.target_range?.low?.toLocaleString() ?? '--'}</span>
                                            <span className="text-xs text-blue-400 font-mono">${pred.target_range?.mid?.toLocaleString() ?? '--'}</span>
                                            <span className="text-xs text-green-400 font-mono">${pred.target_range?.high?.toLocaleString() ?? '--'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Key Drivers */}
                                <div>
                                    <div className="text-xs text-gray-500 mb-2 relative group inline-flex items-center gap-1 cursor-help">
                                        Key Drivers
                                        <i className="fas fa-info-circle text-gray-600"></i>
                                        <Tip text="Features ranked by SHAP-like importance. Impact bar shows relative contribution to the prediction direction." />
                                    </div>
                                    <div className="space-y-2">
                                        {pred.key_drivers?.map((driver, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-4 text-center ${driver.direction === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                                                        {driver.direction === 'bullish' ? '↑' : '↓'}
                                                    </span>
                                                    <span className="text-gray-300">{driver.feature.replace(/_/g, ' ')}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-500 font-mono">{driver.value?.toFixed(1) ?? '--'}</span>
                                                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${driver.direction === 'bullish' ? 'bg-green-500' : 'bg-red-500'}`}
                                                            style={{ width: `${Math.min(driver.impact * IMPACT_BAR_SCALE, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Model Info & Historical Performance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Model Info */}
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-red-500 rounded-full"></span>
                                Model Info
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Algorithm</span>
                                    <span className="text-white font-medium">{data.model_info?.algorithm || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 relative group cursor-help">
                                        CV Accuracy
                                        <Tip text="Cross-validated accuracy on training data. Higher is better but overfitting may occur above 70%." />
                                    </span>
                                    <span className="text-white font-medium">{data.model_info?.training_accuracy || 'N/A'}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Training Samples</span>
                                    <span className="text-white font-medium">{data.model_info?.training_samples || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Last Trained</span>
                                    <span className="text-white font-medium text-xs">
                                        {data.model_info?.last_trained ? new Date(data.model_info.last_trained).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Historical Performance */}
                        <div className="p-5 rounded-2xl bg-[#1c1c1e] border border-white/10">
                            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-red-500 rounded-full"></span>
                                Historical Performance
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total Predictions</span>
                                    <span className="text-white font-medium">{data.historical_performance?.total_predictions || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Direction Accuracy</span>
                                    <span className={`font-bold ${(data.historical_performance?.direction_accuracy || 0) >= 55 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {data.historical_performance?.direction_accuracy || 0}%
                                    </span>
                                </div>
                            </div>
                            {(data.historical_performance?.total_predictions || 0) < 10 && (
                                <div className="mt-3 text-xs text-gray-600">
                                    <i className="fas fa-info-circle mr-1"></i>
                                    Need more predictions for reliable accuracy (min 10)
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

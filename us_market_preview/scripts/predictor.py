#!/usr/bin/env python3
"""
Predicts SPY 5-day direction using GradientBoosting.
Output: output/prediction.json
"""
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
import json, os
from datetime import datetime

def predict_direction():
    spy = yf.Ticker('SPY').history(period='2y')
    vix = yf.Ticker('^VIX').history(period='2y')
    df = pd.DataFrame({'close': spy['Close'], 'volume': spy['Volume']})
    df['vix'] = vix['Close'].reindex(spy.index, method='ffill')

    delta = df['close'].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    df['rsi'] = 100 - (100 / (1 + gain / loss.replace(0, np.nan)))
    ema12 = df['close'].ewm(span=12).mean()
    ema26 = df['close'].ewm(span=26).mean()
    df['macd_hist'] = (ema12 - ema26) - (ema12 - ema26).ewm(span=9).mean()
    df['ret_5d'] = df['close'].pct_change(5) * 100
    df['vol_ratio'] = df['volume'] / df['volume'].rolling(20).mean()
    df['target'] = (df['close'].shift(-5) > df['close']).astype(int)

    features = ['rsi', 'macd_hist', 'ret_5d', 'vol_ratio', 'vix']
    df = df.dropna()
    X_train, X_pred = df[features].iloc[:-30], df[features].iloc[-1:]
    model = GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=42)
    model.fit(X_train, df['target'].iloc[:-30])
    prob = round(float(model.predict_proba(X_pred)[0][1]) * 100, 1)

    result = {
        'timestamp': datetime.now().isoformat(),
        'spy': {'bullish_probability': prob,
                'direction': 'Bullish' if prob >= 55 else ('Bearish' if prob < 45 else 'Neutral')}
    }
    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'prediction.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"Prediction: {prob}% Bullish")

if __name__ == '__main__':
    predict_direction()

#!/usr/bin/env python3
"""
FMP API Client for VCP Screener

Provides rate-limited access to Financial Modeling Prep API endpoints
for VCP (Volatility Contraction Pattern) screening.

Features:
- Rate limiting (0.3s between requests)
- Automatic retry on 429 errors
- Session caching for duplicate requests
- Batch quote support
- S&P 500 constituents fetching
"""

import os
import sys
import time
from datetime import datetime, timedelta
from typing import Optional

try:
    import requests
except ImportError:
    print("ERROR: requests library not found. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    import yfinance as yf
    _HAS_YFINANCE = True
except ImportError:
    _HAS_YFINANCE = False


class FMPClient:
    """Client for Financial Modeling Prep API with rate limiting and caching"""

    BASE_URL = "https://financialmodelingprep.com/api/v3"
    RATE_LIMIT_DELAY = 0.3  # 300ms between requests

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FMP_API_KEY")
        if not self.api_key:
            raise ValueError(
                "FMP API key required. Set FMP_API_KEY environment variable "
                "or pass api_key parameter."
            )
        self.session = requests.Session()
        self.cache = {}
        self.last_call_time = 0
        self.rate_limit_reached = False
        self.retry_count = 0
        self.max_retries = 1
        self.api_calls_made = 0

    def _rate_limited_get(self, url: str, params: Optional[dict] = None) -> Optional[dict]:
        if self.rate_limit_reached:
            return None

        if params is None:
            params = {}
        params["apikey"] = self.api_key

        elapsed = time.time() - self.last_call_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)

        try:
            response = self.session.get(url, params=params, timeout=30)
            self.last_call_time = time.time()
            self.api_calls_made += 1

            if response.status_code == 200:
                self.retry_count = 0
                return response.json()
            elif response.status_code == 429:
                self.retry_count += 1
                if self.retry_count <= self.max_retries:
                    print("WARNING: Rate limit exceeded. Waiting 60 seconds...", file=sys.stderr)
                    time.sleep(60)
                    return self._rate_limited_get(url, params)
                else:
                    print("ERROR: Daily API rate limit reached.", file=sys.stderr)
                    self.rate_limit_reached = True
                    return None
            else:
                print(
                    f"ERROR: API request failed: {response.status_code} - {response.text[:200]}",
                    file=sys.stderr,
                )
                return None
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Request exception: {e}", file=sys.stderr)
            return None

    def get_sp500_constituents(self) -> Optional[list[dict]]:
        """Fetch S&P 500 constituent list (FMP with Wikipedia fallback).

        Returns:
            List of dicts with keys: symbol, name, sector, subSector
            or None on failure.
        """
        cache_key = "sp500_constituents"
        if cache_key in self.cache:
            return self.cache[cache_key]

        url = f"{self.BASE_URL}/sp500_constituent"
        data = self._rate_limited_get(url)

        # Fallback: scrape Wikipedia S&P 500 list
        if not data:
            data = self._sp500_wikipedia_fallback()

        if data:
            self.cache[cache_key] = data
        return data

    def _sp500_wikipedia_fallback(self) -> Optional[list[dict]]:
        """Scrape S&P 500 constituents from Wikipedia."""
        try:
            import io
            import pandas as pd
            url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            resp = self.session.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            tables = pd.read_html(io.StringIO(resp.text))
            df = tables[0]
            result = []
            for _, row in df.iterrows():
                result.append({
                    "symbol": str(row.get("Symbol", "")).replace(".", "-"),
                    "name": str(row.get("Security", "")),
                    "sector": str(row.get("GICS Sector", "")),
                    "subSector": str(row.get("GICS Sub-Industry", "")),
                })
            print(f"  [Wikipedia fallback] S&P 500: {len(result)} constituents")
            return result
        except Exception as e:
            print(f"  [Wikipedia fallback] Failed: {e}", file=sys.stderr)
            return None

    def get_quote(self, symbols: str) -> Optional[list[dict]]:
        """Fetch real-time quote data for one or more symbols (comma-separated)"""
        cache_key = f"quote_{symbols}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        url = f"{self.BASE_URL}/quote/{symbols}"
        data = self._rate_limited_get(url)

        if not data and _HAS_YFINANCE:
            data = self._yfinance_quote(symbols)

        if data:
            self.cache[cache_key] = data
        return data

    def _yfinance_quote(self, symbols: str) -> Optional[list[dict]]:
        """Fetch quote data via yfinance when FMP fails."""
        try:
            result = []
            for sym in symbols.split(","):
                sym = sym.strip()
                ticker = yf.Ticker(sym)
                info = ticker.fast_info
                hist = ticker.history(period="5d")
                if hist.empty:
                    continue
                last = hist.iloc[-1]
                prev = hist.iloc[-2] if len(hist) > 1 else last

                # 52-week high/low and avg volume from longer history
                year_high = 0
                year_low = 0
                avg_volume = int(last["Volume"])
                try:
                    hist_1y = ticker.history(period="1y")
                    if not hist_1y.empty:
                        year_high = round(float(hist_1y["High"].max()), 2)
                        year_low = round(float(hist_1y["Low"].min()), 2)
                        avg_volume = int(hist_1y["Volume"].mean())
                except Exception:
                    pass

                result.append({
                    "symbol": sym,
                    "price": round(float(last["Close"]), 2),
                    "volume": int(last["Volume"]),
                    "avgVolume": avg_volume,
                    "yearHigh": year_high,
                    "yearLow": year_low,
                    "marketCap": int(getattr(info, "market_cap", 0) or 0),
                    "previousClose": round(float(prev["Close"]), 2),
                    "change": round(float(last["Close"] - prev["Close"]), 2),
                    "changesPercentage": round(float((last["Close"] - prev["Close"]) / prev["Close"] * 100), 2),
                })
            return result if result else None
        except Exception:
            return None

    def get_historical_prices(self, symbol: str, days: int = 365) -> Optional[dict]:
        """Fetch historical daily OHLCV data (FMP with yfinance fallback)"""
        cache_key = f"prices_{symbol}_{days}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        url = f"{self.BASE_URL}/historical-price-full/{symbol}"
        params = {"timeseries": days}
        data = self._rate_limited_get(url, params)

        if not data and _HAS_YFINANCE:
            data = self._yfinance_historical(symbol, days)

        if data:
            self.cache[cache_key] = data
        return data

    def _yfinance_historical(self, symbol: str, days: int) -> Optional[dict]:
        """Fetch historical prices via yfinance when FMP fails."""
        try:
            end = datetime.now()
            start = end - timedelta(days=int(days * 1.5))
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))
            if df.empty:
                return None
            historical = []
            for date, row in df.iterrows():
                historical.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "open": round(float(row["Open"]), 4),
                    "high": round(float(row["High"]), 4),
                    "low": round(float(row["Low"]), 4),
                    "close": round(float(row["Close"]), 4),
                    "volume": int(row["Volume"]),
                    "adjClose": round(float(row["Close"]), 4),
                })
            historical.reverse()
            return {"symbol": symbol, "historical": historical}
        except Exception:
            return None

    def get_batch_quotes(self, symbols: list[str]) -> dict[str, dict]:
        """Fetch quotes for a list of symbols. Tries FMP first batch, falls back to bulk yfinance."""
        results = {}

        # Try first FMP batch to see if API works
        first_batch = symbols[:5]
        first_batch_str = ",".join(first_batch)
        url = f"{self.BASE_URL}/quote/{first_batch_str}"
        first_data = self._rate_limited_get(url)
        fmp_works = first_data is not None and isinstance(first_data, list) and len(first_data) > 0

        if fmp_works:
            # FMP works — use batch mode
            for q in first_data:
                results[q["symbol"]] = q
            batch_size = 5
            for i in range(batch_size, len(symbols), batch_size):
                batch = symbols[i : i + batch_size]
                batch_str = ",".join(batch)
                quotes = self.get_quote(batch_str)
                if quotes:
                    for q in quotes:
                        results[q["symbol"]] = q
        elif _HAS_YFINANCE:
            # FMP unavailable — go straight to bulk yfinance
            print(f"  [yfinance bulk] FMP unavailable, fetching {len(symbols)} quotes via yfinance...")
            results = self._yfinance_bulk_quotes(symbols)
            print(f"  [yfinance bulk] Got {len(results)} quotes")

        return results

    def _yfinance_bulk_quotes(self, symbols: list[str]) -> dict[str, dict]:
        """Bulk-fetch quote data via yfinance.download() for speed."""
        results = {}
        try:
            sym_str = " ".join(symbols)
            # Download 1 year of data for all symbols at once
            df = yf.download(sym_str, period="1y", group_by="ticker", progress=False, threads=True)
            if df.empty:
                return results

            for sym in symbols:
                try:
                    if len(symbols) == 1:
                        sdf = df
                    else:
                        sdf = df[sym] if sym in df.columns.get_level_values(0) else None
                    if sdf is None or sdf.empty:
                        continue
                    sdf = sdf.dropna(subset=["Close"])
                    if len(sdf) < 5:
                        continue

                    last = sdf.iloc[-1]
                    prev = sdf.iloc[-2]
                    results[sym] = {
                        "symbol": sym,
                        "price": round(float(last["Close"]), 2),
                        "volume": int(last["Volume"]) if last["Volume"] == last["Volume"] else 0,
                        "avgVolume": int(sdf["Volume"].mean()),
                        "yearHigh": round(float(sdf["High"].max()), 2),
                        "yearLow": round(float(sdf["Low"].min()), 2),
                        "marketCap": 0,
                        "previousClose": round(float(prev["Close"]), 2),
                        "change": round(float(last["Close"] - prev["Close"]), 2),
                        "changesPercentage": round(float((last["Close"] - prev["Close"]) / prev["Close"] * 100), 2),
                    }
                except Exception:
                    continue
        except Exception as e:
            print(f"  [yfinance bulk] Error: {e}", file=sys.stderr)
        return results

    def get_batch_historical(self, symbols: list[str], days: int = 260) -> dict[str, list[dict]]:
        """Fetch historical prices for multiple symbols. FMP-first with bulk yfinance fallback."""
        results = {}

        # Test FMP with first symbol
        first_data = self.get_historical_prices(symbols[0], days=days) if symbols else None
        fmp_works = first_data is not None and "historical" in first_data

        if fmp_works:
            results[symbols[0]] = first_data["historical"]
            for symbol in symbols[1:]:
                data = self.get_historical_prices(symbol, days=days)
                if data and "historical" in data:
                    results[symbol] = data["historical"]
        elif _HAS_YFINANCE:
            # FMP unavailable — go straight to bulk yfinance
            print(f"  [yfinance bulk hist] FMP unavailable, fetching {len(symbols)} symbols...")
            results = self._yfinance_bulk_historical(symbols, days)
            print(f"  [yfinance bulk hist] Got {len(results)} symbols")

        return results

    def _yfinance_bulk_historical(self, symbols: list[str], days: int) -> dict[str, list[dict]]:
        """Bulk-fetch historical data via yfinance.download()."""
        results = {}
        try:
            end = datetime.now()
            start = end - timedelta(days=int(days * 1.5))
            sym_str = " ".join(symbols)
            df = yf.download(
                sym_str, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"),
                group_by="ticker", progress=False, threads=True
            )
            if df.empty:
                return results

            for sym in symbols:
                try:
                    if len(symbols) == 1:
                        sdf = df
                    else:
                        sdf = df[sym] if sym in df.columns.get_level_values(0) else None
                    if sdf is None or sdf.empty:
                        continue
                    sdf = sdf.dropna(subset=["Close"])
                    if len(sdf) < 20:
                        continue

                    historical = []
                    for date, row in sdf.iterrows():
                        historical.append({
                            "date": date.strftime("%Y-%m-%d"),
                            "open": round(float(row["Open"]), 4),
                            "high": round(float(row["High"]), 4),
                            "low": round(float(row["Low"]), 4),
                            "close": round(float(row["Close"]), 4),
                            "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
                            "adjClose": round(float(row["Close"]), 4),
                        })
                    historical.reverse()
                    results[sym] = historical
                except Exception:
                    continue
        except Exception as e:
            print(f"  [yfinance bulk hist] Error: {e}", file=sys.stderr)
        return results

    def calculate_sma(self, prices: list[float], period: int) -> float:
        """Calculate Simple Moving Average from a list of prices (most recent first)"""
        if len(prices) < period:
            return sum(prices) / len(prices)
        return sum(prices[:period]) / period

    def get_api_stats(self) -> dict:
        return {
            "cache_entries": len(self.cache),
            "api_calls_made": self.api_calls_made,
            "rate_limit_reached": self.rate_limit_reached,
        }

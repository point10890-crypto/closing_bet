#!/usr/bin/env python3
"""
FMP API Client for Earnings Trade Analyzer — Wrapper around shared module.

NOTE: This skill's get_historical_prices() returns list[dict] (just the
historical array) instead of the wrapper dict. A thin subclass preserves
backward compatibility for callers that expect this behavior.

All core logic lives in skills/_shared/fmp_client.py.
"""
import importlib.util
import os
from typing import Optional

_shared_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '_shared', 'fmp_client.py')
_spec = importlib.util.spec_from_file_location("_shared_fmp_client", _shared_path)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

_SharedFMPClient = _mod.FMPClient
ApiCallBudgetExceeded = _mod.ApiCallBudgetExceeded


class FMPClient(_SharedFMPClient):
    """Earnings-trade-analyzer variant: get_historical_prices returns list[dict]."""

    US_EXCHANGES = _SharedFMPClient.US_EXCHANGES

    def __init__(self, api_key: Optional[str] = None, max_api_calls: int = 200):
        super().__init__(api_key=api_key, max_api_calls=max_api_calls)

    def get_historical_prices(self, symbol: str, days: int = 250) -> Optional[list[dict]]:
        """Fetch historical prices, returning just the historical array (no wrapper dict)."""
        return self.get_historical_prices_list(symbol, days)


__all__ = ["FMPClient", "ApiCallBudgetExceeded"]

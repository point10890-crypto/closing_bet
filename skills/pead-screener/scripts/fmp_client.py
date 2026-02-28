#!/usr/bin/env python3
"""
FMP API Client for PEAD Screener — Thin wrapper around shared module.

All logic lives in skills/_shared/fmp_client.py.
"""
import importlib.util
import os

_shared_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '_shared', 'fmp_client.py')
_spec = importlib.util.spec_from_file_location("_shared_fmp_client", _shared_path)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

FMPClient = _mod.FMPClient
ApiCallBudgetExceeded = _mod.ApiCallBudgetExceeded

__all__ = ["FMPClient", "ApiCallBudgetExceeded"]

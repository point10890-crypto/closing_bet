#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR VCP SmartMoney Chatbot Module
스마트머니봇 - VCP 기반 한국 주식 투자 어드바이저
"""

# Load environment variables first
import os
from pathlib import Path
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

from core import KRStockChatbot
from memory import MemoryManager
from history import HistoryManager
from data_loader import fetch_all_data, load_smart_money_picks, get_market_gate_scores

__all__ = [
    "KRStockChatbot",
    "MemoryManager", 
    "HistoryManager",
    "fetch_all_data",
    "load_smart_money_picks",
    "get_market_gate_scores"
]

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
US Market - Full Pipeline Runner
Runs all data collection and analysis scripts in sequence.
"""

import os
import sys
import subprocess
import time
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Change to us_market directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

scripts = [
    ("create_us_daily_prices.py", "Data Collection", 900),
    ("analyze_volume.py", "Volume Analysis", 300),
    ("analyze_13f.py", "Institutional Analysis", 600),
    ("analyze_etf_flows.py", "ETF Flow Analysis", 300),
    ("smart_money_screener_v2.py", "Smart Money Screening", 600),
    ("sector_heatmap.py", "Sector Heatmap", 300),
    ("options_flow.py", "Options Flow", 300),
    ("insider_tracker.py", "Insider Tracker", 300),
    ("portfolio_risk.py", "Portfolio Risk", 300),
    ("ai_summary_generator.py", "AI Summaries", 900),
    ("final_report_generator.py", "Final Report", 60),
    ("macro_analyzer.py", "Macro Analysis", 300),
    ("economic_calendar.py", "Economic Calendar", 300),
]


def run_script(name, desc, timeout):
    logger.info(f"▶ [{desc}] Running {name}...")
    try:
        result = subprocess.run(
            [sys.executable, name],
            timeout=timeout,
            check=True,
            capture_output=True,
            text=True
        )
        logger.info(f"  ✅ {desc} Done")
        return True
    except subprocess.TimeoutExpired:
        logger.error(f"  ⏰ {desc} Timeout ({timeout}s)")
        return False
    except subprocess.CalledProcessError as e:
        logger.error(f"  ❌ {desc} Failed: {e}")
        if e.stderr:
            logger.error(f"     {e.stderr[:200]}")
        return False
    except Exception as e:
        logger.error(f"  ❌ {desc} Error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='US Market Full Pipeline')
    parser.add_argument('--quick', action='store_true', help='Skip AI-heavy scripts')
    parser.add_argument('--data-only', action='store_true', help='Only run data collection')
    args = parser.parse_args()

    start = time.time()
    success_count = 0
    fail_count = 0

    logger.info("=" * 60)
    logger.info("  US Market Analysis Pipeline")
    logger.info(f"  Mode: {'Quick' if args.quick else 'Data Only' if args.data_only else 'Full'}")
    logger.info(f"  Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)

    for name, desc, timeout in scripts:
        if args.data_only and desc not in ["Data Collection", "Volume Analysis"]:
            continue
        if args.quick and "AI" in desc:
            logger.info(f"  ⏭ Skipping {desc} (quick mode)")
            continue

        if run_script(name, desc, timeout):
            success_count += 1
        else:
            fail_count += 1

    elapsed = (time.time() - start) / 60
    logger.info("=" * 60)
    logger.info(f"  Pipeline Complete!")
    logger.info(f"  Success: {success_count} | Failed: {fail_count}")
    logger.info(f"  Total time: {elapsed:.1f} min")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

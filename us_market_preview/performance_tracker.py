"""
US Market Smart Money Screener - Performance Tracker
=====================================================
Tracks returns of historical top picks vs SPY benchmark.

Usage:
    python performance_tracker.py [--days 30]

Output:
    - us_market_preview/output/performance_report.json
    - Console summary with Win Rate, Avg Return, Alpha
"""

import os, sys, json, glob, datetime, argparse
from pathlib import Path

# Add project root
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

HISTORY_DIR = Path(__file__).resolve().parent / "history"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False
    print("[WARN] yfinance not installed. Using cached prices only.")


def load_snapshots():
    """Load all historical pick snapshots."""
    files = sorted(glob.glob(str(HISTORY_DIR / "picks_*.json")))
    snapshots = []
    for f in files:
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
                snapshots.append(data)
        except Exception as e:
            print(f"[WARN] Failed to load {f}: {e}")
    return snapshots


def fetch_prices(tickers: list) -> dict:
    """Fetch current prices via yfinance."""
    if not HAS_YF:
        return {}
    prices = {}
    try:
        data = yf.download(tickers, period="1d", progress=False)
        if 'Close' in data.columns.get_level_values(0) if hasattr(data.columns, 'get_level_values') else 'Close' in data.columns:
            close = data['Close']
            if hasattr(close, 'columns'):
                for t in close.columns:
                    val = close[t].dropna()
                    if len(val) > 0:
                        prices[t] = float(val.iloc[-1])
            else:
                if len(close.dropna()) > 0 and len(tickers) == 1:
                    prices[tickers[0]] = float(close.dropna().iloc[-1])
    except Exception as e:
        print(f"[WARN] yfinance error: {e}")
    return prices


def fetch_spy_prices(dates: list) -> dict:
    """Fetch SPY price on specific dates."""
    if not HAS_YF or not dates:
        return {}
    try:
        min_date = min(dates)
        spy = yf.download("SPY", start=min_date, progress=False)
        if spy.empty:
            return {}
        result = {}
        for d in dates:
            # Find closest trading day
            mask = spy.index <= d
            if mask.any():
                idx = spy.index[mask][-1]
                result[d] = float(spy['Close'].loc[idx])
        # Also get latest
        result['latest'] = float(spy['Close'].iloc[-1])
        return result
    except Exception as e:
        print(f"[WARN] SPY fetch error: {e}")
        return {}


def calculate_performance(snapshots: list) -> dict:
    """Calculate returns for all historical picks."""
    if not snapshots:
        return {"error": "No snapshots found", "snapshots": 0}

    # Collect all unique tickers
    all_tickers = set()
    for snap in snapshots:
        for p in snap.get('picks', []):
            all_tickers.add(p['ticker'])
    all_tickers.add('SPY')

    # Fetch current prices
    current_prices = fetch_prices(list(all_tickers))
    spy_current = current_prices.get('SPY', 0)

    # Fetch SPY historical prices for each snapshot date
    snapshot_dates = [s['date'] for s in snapshots]
    spy_hist = fetch_spy_prices(snapshot_dates)

    # Calculate per-snapshot and per-pick returns
    all_picks = []
    snapshot_results = []

    for snap in snapshots:
        snap_date = snap['date']
        picks = snap.get('picks', [])
        spy_entry = spy_hist.get(snap_date, 0)
        spy_return = ((spy_current / spy_entry) - 1) * 100 if spy_entry > 0 else 0

        snap_returns = []
        for p in picks:
            ticker = p['ticker']
            entry_price = p.get('price', 0)
            curr_price = current_prices.get(ticker, entry_price)
            ret = ((curr_price / entry_price) - 1) * 100 if entry_price > 0 else 0
            alpha = ret - spy_return

            pick_result = {
                'ticker': ticker,
                'name': p.get('name', ''),
                'sector': p.get('sector', ''),
                'snapshot_date': snap_date,
                'entry_price': entry_price,
                'current_price': curr_price,
                'return_pct': round(ret, 2),
                'spy_return_pct': round(spy_return, 2),
                'alpha': round(alpha, 2),
                'composite_score': p.get('composite_score', 0),
                'grade': p.get('grade', ''),
                'signal': p.get('signal', ''),
                'rsi': p.get('rsi', 0),
            }
            all_picks.append(pick_result)
            snap_returns.append(ret)

        avg_ret = sum(snap_returns) / len(snap_returns) if snap_returns else 0
        win_count = sum(1 for r in snap_returns if r > 0)
        win_rate = (win_count / len(snap_returns) * 100) if snap_returns else 0

        snapshot_results.append({
            'date': snap_date,
            'picks_count': len(picks),
            'avg_return': round(avg_ret, 2),
            'spy_return': round(spy_return, 2),
            'alpha': round(avg_ret - spy_return, 2),
            'win_rate': round(win_rate, 1),
            'win_count': win_count,
            'loss_count': len(snap_returns) - win_count,
        })

    # Overall stats
    total_picks = len(all_picks)
    unique_tickers = len(set(p['ticker'] for p in all_picks))
    returns = [p['return_pct'] for p in all_picks]
    winners = [r for r in returns if r > 0]
    losers = [r for r in returns if r <= 0]

    overall_win_rate = (len(winners) / total_picks * 100) if total_picks > 0 else 0
    avg_return = sum(returns) / total_picks if total_picks > 0 else 0
    avg_alpha = sum(p['alpha'] for p in all_picks) / total_picks if total_picks > 0 else 0

    # Best/Worst
    best = max(all_picks, key=lambda x: x['return_pct']) if all_picks else None
    worst = min(all_picks, key=lambda x: x['return_pct']) if all_picks else None

    # Grade breakdown
    grade_stats = {}
    for p in all_picks:
        g = p['grade'] or 'N/A'
        if g not in grade_stats:
            grade_stats[g] = {'count': 0, 'returns': [], 'alphas': []}
        grade_stats[g]['count'] += 1
        grade_stats[g]['returns'].append(p['return_pct'])
        grade_stats[g]['alphas'].append(p['alpha'])

    grade_results = {}
    for g, s in grade_stats.items():
        win = sum(1 for r in s['returns'] if r > 0)
        grade_results[g] = {
            'count': s['count'],
            'win_rate': round(win / s['count'] * 100, 1) if s['count'] > 0 else 0,
            'avg_return': round(sum(s['returns']) / s['count'], 2) if s['count'] > 0 else 0,
            'avg_alpha': round(sum(s['alphas']) / s['count'], 2) if s['count'] > 0 else 0,
        }

    # Sector breakdown
    sector_stats = {}
    for p in all_picks:
        sec = p.get('sector', 'N/A') or 'N/A'
        if sec not in sector_stats:
            sector_stats[sec] = {'count': 0, 'returns': [], 'alphas': []}
        sector_stats[sec]['count'] += 1
        sector_stats[sec]['returns'].append(p['return_pct'])
        sector_stats[sec]['alphas'].append(p['alpha'])

    sector_results = {}
    for sec, s in sector_stats.items():
        win = sum(1 for r in s['returns'] if r > 0)
        sector_results[sec] = {
            'count': s['count'],
            'win_rate': round(win / s['count'] * 100, 1) if s['count'] > 0 else 0,
            'avg_return': round(sum(s['returns']) / s['count'], 2) if s['count'] > 0 else 0,
            'avg_alpha': round(sum(s['alphas']) / s['count'], 2) if s['count'] > 0 else 0,
        }

    report = {
        'generated_at': datetime.datetime.now().isoformat(),
        'summary': {
            'total_picks': total_picks,
            'unique_tickers': unique_tickers,
            'snapshots': len(snapshots),
            'tracking_period': f"{snapshots[0]['date']} ~ {snapshots[-1]['date']}" if snapshots else '',
            'win_rate': round(overall_win_rate, 1),
            'avg_return': round(avg_return, 2),
            'avg_alpha': round(avg_alpha, 2),
            'max_gain': {'pct': best['return_pct'], 'ticker': best['ticker']} if best else None,
            'max_loss': {'pct': worst['return_pct'], 'ticker': worst['ticker']} if worst else None,
            'total_winners': len(winners),
            'total_losers': len(losers),
        },
        'snapshots': snapshot_results,
        'picks': sorted(all_picks, key=lambda x: x['return_pct'], reverse=True),
        'by_grade': grade_results,
        'by_sector': sector_results,
    }

    return report


def main():
    parser = argparse.ArgumentParser(description='US Smart Money Performance Tracker')
    parser.add_argument('--days', type=int, default=90, help='Track picks from last N days')
    args = parser.parse_args()

    print("=" * 60)
    print("  US Market Smart Money - Performance Tracker")
    print("=" * 60)

    snapshots = load_snapshots()
    print(f"\nLoaded {len(snapshots)} snapshots from {HISTORY_DIR}")

    if not snapshots:
        print("[ERROR] No snapshot files found. Save picks first.")
        return

    report = calculate_performance(snapshots)

    # Save report
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / "performance_report.json"
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to: {report_path}")

    # Print summary
    s = report.get('summary', {})
    print(f"\n{'='*40}")
    print(f"  Total Picks:     {s.get('total_picks', 0)}")
    print(f"  Unique Tickers:  {s.get('unique_tickers', 0)}")
    print(f"  Snapshots:       {s.get('snapshots', 0)}")
    print(f"  Period:          {s.get('tracking_period', 'N/A')}")
    print(f"  Win Rate:        {s.get('win_rate', 0):.1f}%")
    print(f"  Avg Return:      {s.get('avg_return', 0):+.2f}%")
    print(f"  Avg Alpha:       {s.get('avg_alpha', 0):+.2f}%")
    mg = s.get('max_gain')
    ml = s.get('max_loss')
    if mg:
        print(f"  Max Gain:        {mg['pct']:+.2f}% ({mg['ticker']})")
    if ml:
        print(f"  Max Loss:        {ml['pct']:+.2f}% ({ml['ticker']})")
    print(f"{'='*40}")


if __name__ == '__main__':
    main()

import urllib.request, json

def fetch(path):
    try:
        r = urllib.request.urlopen(f'http://localhost:5001{path}', timeout=10)
        return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}

d = fetch('/api/us/decision-signal')
print('=== 1. Decision Signal ===')
print(f'  Action: {d["action"]} | Score: {d["score"]} | Timing: {d["timing"]}')
for k,v in d.get('components',{}).items():
    print(f'    {k}: {v}')
print(f'  Top Picks: {len(d.get("top_picks",[]))}')

d = fetch('/api/us/top-picks-report')
print('\n=== 2. Top Picks Report ===')
print(f'  Analyzed: {d.get("total_analyzed",0)} | Top: {len(d.get("top_picks",[]))}')
for p in d.get('top_picks',[])[:3]:
    print(f'  #{p["rank"]} {p["ticker"]} Score:{p["final_score"]:.1f} | {p["ai_recommendation"]}')

d = fetch('/api/us/index-prediction')
print('\n=== 3. Index Prediction ===')
for k,v in d.get('predictions',{}).items():
    print(f'  {k}: Bullish {v["bullish_probability"]:.1f}% | Return {v["predicted_return_pct"]:.2f}%')

d = fetch('/api/us/market-regime')
print('\n=== 4. Market Regime ===')
print(f'  Regime: {d["regime"]} | Confidence: {d["confidence"]}% | Score: {d["weighted_score"]}')

d = fetch('/api/us/risk-alerts')
print('\n=== 5. Risk Alerts ===')
ps = d.get('portfolio_summary',{})
print(f'  Risk: {ps.get("risk_level")} | VaR: ${abs(ps.get("portfolio_var_95_5d",0)):,.0f} | CVaR: ${abs(ps.get("portfolio_cvar_95_5d",0)):,.0f}')
print(f'  Alerts: {len(d.get("alerts",[]))}')

d = fetch('/api/us/sector-rotation')
print('\n=== 6. Sector Rotation ===')
rs = d.get('rotation_signals',{})
print(f'  Phase: {rs.get("current_phase")} | Confidence: {rs.get("phase_confidence")}%')
print(f'  Leading: {rs.get("leading_sectors",[])}')

d = fetch('/api/us/market-briefing')
print('\n=== 7. Market Briefing ===')
print(f'  Version: {d.get("version","?")} | VIX: {d.get("vix",{}).get("value","?")}')
fg = d.get('fear_greed',{})
print(f'  Fear/Greed: {fg.get("score","?")} ({fg.get("level","?")})')

d = fetch('/api/us/backtest')
print('\n=== 8. Backtest ===')
if d.get('returns'):
    r = d['returns']
    print(f'  Return: {r["total_return"]:.1f}% | Sharpe: {r["sharpe_ratio"]:.2f} | WinRate: {r["win_rate"]:.1f}%')

d = fetch('/api/us/earnings-impact')
print('\n=== 9. Earnings Impact ===')
ue = d.get('upcoming_earnings',[])
print(f'  Upcoming: {len(ue)}')
for e in ue[:2]:
    print(f'    {e["ticker"]} ({e["sector"]}) {e["earnings_date"]} | {e["signal"]}')

d = fetch('/api/us/data-status')
print(f'\n=== 10. Data Status ===')
print(f'  Total: {d["count"]} files')
fresh = sum(1 for f in d['files'] if f['freshness']=='fresh')
stale = sum(1 for f in d['files'] if f['freshness']=='stale')
old = sum(1 for f in d['files'] if f['freshness']=='old')
print(f'  Fresh: {fresh} | Stale: {stale} | Old: {old}')

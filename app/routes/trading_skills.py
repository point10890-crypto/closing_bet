"""Trading Skills API Blueprint

Serves results from 38 trading skills (claude-trading-skills).
Skills produce JSON/Markdown reports in reports/<skill-name>/ directory.
This blueprint reads the latest report for each skill and serves via API.
"""

import os
import json
import glob
import subprocess
import threading
import time
from datetime import datetime
from flask import Blueprint, jsonify, request

skills_bp = Blueprint('skills', __name__)

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_REPORTS_DIR = os.path.join(_BASE_DIR, 'reports')
_SKILLS_DIR = os.path.join(_BASE_DIR, 'skills')
_PYTHON = os.path.join(_BASE_DIR, '.venv', 'Scripts', 'python.exe')

# Track running skills
_running_skills = {}  # {skill_name: {'started_at': datetime, 'pid': int}}

# All 38 skills with metadata
SKILLS_CATALOG = {
    # === Market Analysis & Research ===
    'vcp-screener': {'name': 'VCP Screener', 'category': 'screening', 'script': 'screen_vcp.py', 'api_key': 'FMP_API_KEY'},
    'market-breadth-analyzer': {'name': 'Market Breadth', 'category': 'timing', 'script': 'market_breadth_analyzer.py', 'api_key': None},
    'macro-regime-detector': {'name': 'Macro Regime', 'category': 'analysis', 'script': 'macro_regime_detector.py', 'api_key': None},
    'market-top-detector': {'name': 'Market Top', 'category': 'timing', 'script': 'market_top_detector.py', 'api_key': 'FMP_API_KEY'},
    'ftd-detector': {'name': 'FTD Detector', 'category': 'timing', 'script': 'ftd_detector.py', 'api_key': 'FMP_API_KEY'},
    'uptrend-analyzer': {'name': 'Uptrend Analyzer', 'category': 'analysis', 'script': 'uptrend_analyzer.py', 'api_key': None},
    'us-market-bubble-detector': {'name': 'Bubble Detector', 'category': 'risk', 'script': 'bubble_scorer.py', 'api_key': None},
    'theme-detector': {'name': 'Theme Detector', 'category': 'analysis', 'script': 'theme_detector.py', 'api_key': 'FMP_API_KEY'},
    'sector-analyst': {'name': 'Sector Analyst', 'category': 'analysis', 'script': None, 'api_key': None},
    'breadth-chart-analyst': {'name': 'Breadth Chart', 'category': 'analysis', 'script': None, 'api_key': None},
    'technical-analyst': {'name': 'Technical Analyst', 'category': 'analysis', 'script': None, 'api_key': None},
    'market-news-analyst': {'name': 'News Analyst', 'category': 'analysis', 'script': None, 'api_key': None},
    'us-stock-analysis': {'name': 'Stock Analysis', 'category': 'analysis', 'script': None, 'api_key': None},
    'market-environment-analysis': {'name': 'Market Environment', 'category': 'analysis', 'script': 'market_utils.py', 'api_key': None},

    # === Screening ===
    'canslim-screener': {'name': 'CANSLIM', 'category': 'screening', 'script': 'screen_canslim.py', 'api_key': 'FMP_API_KEY'},
    'pead-screener': {'name': 'PEAD Screener', 'category': 'screening', 'script': 'screen_pead.py', 'api_key': 'FMP_API_KEY'},
    'pair-trade-screener': {'name': 'Pair Trade', 'category': 'screening', 'script': 'analyze_spread.py', 'api_key': 'FMP_API_KEY'},
    'value-dividend-screener': {'name': 'Value Dividend', 'category': 'screening', 'script': 'screen_dividend_stocks.py', 'api_key': 'FMP_API_KEY'},
    'dividend-growth-pullback-screener': {'name': 'Dividend Pullback', 'category': 'screening', 'script': 'screen_dividend_growth_rsi.py', 'api_key': 'FMP_API_KEY'},

    # === Earnings ===
    'earnings-trade-analyzer': {'name': 'Earnings Trade', 'category': 'earnings', 'script': 'analyze_earnings_trades.py', 'api_key': 'FMP_API_KEY'},
    'earnings-calendar': {'name': 'Earnings Calendar', 'category': 'earnings', 'script': 'fetch_earnings_fmp.py', 'api_key': 'FMP_API_KEY'},
    'economic-calendar-fetcher': {'name': 'Economic Calendar', 'category': 'earnings', 'script': 'get_economic_calendar.py', 'api_key': 'FMP_API_KEY'},

    # === Strategy & Risk ===
    'backtest-expert': {'name': 'Backtest Expert', 'category': 'strategy', 'script': 'evaluate_backtest.py', 'api_key': None},
    'scenario-analyzer': {'name': 'Scenario Analyzer', 'category': 'strategy', 'script': None, 'api_key': None},
    'options-strategy-advisor': {'name': 'Options Strategy', 'category': 'strategy', 'script': 'black_scholes.py', 'api_key': None},
    'stanley-druckenmiller-investment': {'name': 'Druckenmiller', 'category': 'strategy', 'script': 'allocation_engine.py', 'api_key': 'FMP_API_KEY'},
    'strategy-pivot-designer': {'name': 'Strategy Pivot', 'category': 'strategy', 'script': 'detect_stagnation.py', 'api_key': None},
    'portfolio-manager': {'name': 'Portfolio Manager', 'category': 'strategy', 'script': None, 'api_key': 'ALPACA_API_KEY'},

    # === Institutional ===
    'institutional-flow-tracker': {'name': 'Institutional Flow', 'category': 'institutional', 'script': 'track_institutional_flow.py', 'api_key': 'FMP_API_KEY'},

    # === Edge Discovery ===
    'edge-candidate-agent': {'name': 'Edge Candidate', 'category': 'edge', 'script': 'auto_detect_candidates.py', 'api_key': None},
    'edge-concept-synthesizer': {'name': 'Edge Synthesizer', 'category': 'edge', 'script': 'synthesize_edge_concepts.py', 'api_key': None},
    'edge-hint-extractor': {'name': 'Edge Hints', 'category': 'edge', 'script': 'build_hints.py', 'api_key': None},
    'edge-strategy-designer': {'name': 'Edge Strategy', 'category': 'edge', 'script': 'design_strategy_drafts.py', 'api_key': None},

    # === Dividend Workflows ===
    'kanchi-dividend-sop': {'name': 'Kanchi Dividend SOP', 'category': 'dividend', 'script': 'build_entry_signals.py', 'api_key': 'FMP_API_KEY'},
    'kanchi-dividend-review-monitor': {'name': 'Dividend Monitor', 'category': 'dividend', 'script': 'build_review_queue.py', 'api_key': 'FMP_API_KEY'},
    'kanchi-dividend-us-tax-accounting': {'name': 'Dividend Tax', 'category': 'dividend', 'script': 'build_tax_planning_sheet.py', 'api_key': None},

    # === Meta ===
    'dual-axis-skill-reviewer': {'name': 'Skill Reviewer', 'category': 'meta', 'script': 'run_dual_axis_review.py', 'api_key': None},
    'weekly-trade-strategy': {'name': 'Weekly Strategy', 'category': 'strategy', 'script': None, 'api_key': 'FMP_API_KEY'},
}


def _get_latest_report(skill_name: str) -> dict | None:
    """Get the latest JSON report for a skill."""
    report_dir = os.path.join(_REPORTS_DIR, skill_name)
    if not os.path.isdir(report_dir):
        return None

    # Exclude history/tracking files — only pick timestamped report files
    all_json = sorted(glob.glob(os.path.join(report_dir, '*.json')), reverse=True)
    json_files = [f for f in all_json if 'history' not in os.path.basename(f).lower()]
    if not json_files:
        return None

    try:
        with open(json_files[0], 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        data['_report_file'] = os.path.basename(json_files[0])
        data['_report_time'] = datetime.fromtimestamp(
            os.path.getmtime(json_files[0])
        ).isoformat()
        return data
    except (json.JSONDecodeError, OSError):
        return None


@skills_bp.route('/catalog')
def skills_catalog():
    """List all 38 skills with metadata and latest report status."""
    catalog = []
    for skill_id, meta in SKILLS_CATALOG.items():
        report = _get_latest_report(skill_id)
        has_script = meta['script'] is not None
        skill_dir = os.path.join(_SKILLS_DIR, skill_id)

        catalog.append({
            'id': skill_id,
            'name': meta['name'],
            'category': meta['category'],
            'has_script': has_script,
            'api_key_required': meta.get('api_key'),
            'has_skill_md': os.path.isfile(os.path.join(skill_dir, 'SKILL.md')),
            'has_report': report is not None,
            'last_report_time': report.get('_report_time') if report else None,
            'running': skill_id in _running_skills,
        })

    return jsonify({
        'total': len(catalog),
        'skills': catalog,
        'categories': list(set(m['category'] for m in SKILLS_CATALOG.values())),
    })


@skills_bp.route('/report/<skill_name>')
def skill_report(skill_name):
    """Get the latest report for a specific skill."""
    if skill_name not in SKILLS_CATALOG:
        return jsonify({'error': f'Unknown skill: {skill_name}'}), 404

    report = _get_latest_report(skill_name)
    if not report:
        return jsonify({
            'error': 'No report available',
            'skill': skill_name,
            'hint': f'Run the skill first: /skill-{skill_name.replace("-", "-")}',
        }), 404

    return jsonify(report)


@skills_bp.route('/run/<skill_name>', methods=['POST'])
def run_skill(skill_name):
    """Trigger a skill execution (async)."""
    if skill_name not in SKILLS_CATALOG:
        return jsonify({'error': f'Unknown skill: {skill_name}'}), 404

    meta = SKILLS_CATALOG[skill_name]
    if not meta['script']:
        return jsonify({'error': f'Skill {skill_name} has no script (prompt-only)'}), 400

    if skill_name in _running_skills:
        return jsonify({'status': 'already_running', 'skill': skill_name}), 409

    # Build command
    script_path = os.path.join(_SKILLS_DIR, skill_name, 'scripts', meta['script'])
    if not os.path.isfile(script_path):
        return jsonify({'error': f'Script not found: {meta["script"]}'}), 404

    output_dir = os.path.join(_REPORTS_DIR, skill_name)
    os.makedirs(output_dir, exist_ok=True)

    cmd = [_PYTHON, script_path, '--output-dir', output_dir]

    # Add API key if required
    if meta.get('api_key'):
        api_key = os.environ.get(meta['api_key'], '')
        if api_key:
            cmd.extend(['--api-key', api_key])

    # Run in background thread
    def _execute():
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        try:
            proc = subprocess.Popen(
                cmd, cwd=_BASE_DIR, env=env,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            _running_skills[skill_name] = {
                'started_at': datetime.now().isoformat(),
                'pid': proc.pid,
            }
            proc.wait(timeout=600)  # 10 min timeout
        except subprocess.TimeoutExpired:
            proc.kill()
        except Exception:
            pass
        finally:
            _running_skills.pop(skill_name, None)

    thread = threading.Thread(target=_execute, daemon=True, name=f'skill-{skill_name}')
    thread.start()

    return jsonify({
        'status': 'started',
        'skill': skill_name,
        'output_dir': output_dir,
    })


@skills_bp.route('/status')
def skills_status():
    """Get running skills and report freshness."""
    status = {
        'running': dict(_running_skills),
        'reports': {},
    }

    for skill_id in SKILLS_CATALOG:
        report_dir = os.path.join(_REPORTS_DIR, skill_id)
        if os.path.isdir(report_dir):
            json_files = sorted(glob.glob(os.path.join(report_dir, '*.json')), reverse=True)
            if json_files:
                mtime = os.path.getmtime(json_files[0])
                age_hours = (time.time() - mtime) / 3600
                status['reports'][skill_id] = {
                    'file': os.path.basename(json_files[0]),
                    'updated_at': datetime.fromtimestamp(mtime).isoformat(),
                    'age_hours': round(age_hours, 1),
                    'fresh': age_hours < 24,
                }

    return jsonify(status)


# === Convenience endpoints for key skills ===

@skills_bp.route('/market-breadth')
def market_breadth():
    """Latest market breadth analysis (no API key needed)."""
    report = _get_latest_report('market-breadth-analyzer')
    if not report:
        return jsonify({'error': 'No market breadth report. Run /skill-market-breadth first.'}), 404

    # Transform to frontend BreadthPage format
    composite = report.get('composite', {})
    components = report.get('components', {})
    result = {
        'results': [{
            'composite_score': composite.get('composite_score', 0),
            'score': composite.get('composite_score', 0),
            'zone': composite.get('zone', 'Unknown'),
            'exposure_guidance': composite.get('exposure_guidance', ''),
            'components': {
                k: {'score': v.get('score', 0), 'signal': v.get('signal', ''), 'weight': w}
                for k, v, w in [
                    (k, components.get(k, {}), composite.get('component_scores', {}).get(k, {}).get('weight', 0))
                    for k in components
                ]
            },
        }],
        '_report_time': report.get('_report_time'),
    }
    return jsonify(result)


@skills_bp.route('/macro-regime')
def macro_regime():
    """Latest macro regime classification."""
    report = _get_latest_report('macro-regime-detector')
    if not report:
        return jsonify({'error': 'No macro regime report. Run /skill-macro-regime first.'}), 404

    # Transform to frontend RegimePage format
    composite = report.get('composite', {})
    regime_data = report.get('regime', {})
    components = report.get('components', {})
    result = {
        'results': [{
            'regime': regime_data.get('classification', composite.get('zone', 'neutral')),
            'classification': regime_data.get('classification', composite.get('zone', 'neutral')),
            'composite_score': composite.get('composite_score', 0),
            'score': composite.get('composite_score', 0),
            'components': {
                k: {'signal': v.get('signal', ''), 'score': v.get('score', 0), 'regime': v.get('regime', '')}
                for k, v in components.items()
            },
        }],
        '_report_time': report.get('_report_time'),
    }
    return jsonify(result)


@skills_bp.route('/market-top')
def market_top():
    """Latest market top probability."""
    report = _get_latest_report('market-top-detector')
    if not report:
        return jsonify({'error': 'No market top report. Run /skill-market-top first.'}), 404
    return jsonify(report)


@skills_bp.route('/ftd')
def ftd():
    """Latest Follow-Through Day signals."""
    report = _get_latest_report('ftd-detector')
    if not report:
        return jsonify({'error': 'No FTD report. Run /skill-ftd-detector first.'}), 404
    return jsonify(report)


@skills_bp.route('/bubble')
def bubble():
    """Latest bubble risk assessment."""
    report = _get_latest_report('us-market-bubble-detector')
    if not report:
        return jsonify({'error': 'No bubble report. Run /skill-bubble-detector first.'}), 404
    return jsonify(report)


@skills_bp.route('/themes')
def themes():
    """Latest active themes."""
    report = _get_latest_report('theme-detector')
    if not report:
        return jsonify({'error': 'No theme report. Run /skill-theme-detector first.'}), 404

    # Transform themes dict → results array for frontend ThemesPage
    raw_themes = report.get('themes', {})
    all_themes = raw_themes.get('all', []) if isinstance(raw_themes, dict) else []
    results = []
    for t in all_themes:
        results.append({
            'theme': t.get('name', ''),
            'heat_score': t.get('heat', 0),
            'lifecycle_score': t.get('maturity', 0),
            'confidence_score': {'High': 90, 'Medium': 60, 'Low': 30}.get(t.get('confidence', ''), 50),
            'composite_score': (t.get('heat', 0) + t.get('maturity', 0)) / 2,
            'etfs': t.get('proxy_etfs', []),
            'representative_stocks': t.get('representative_stocks', []),
            'description': f"{t.get('direction', '')} | Stage: {t.get('stage', '')} | {t.get('heat_label', '')}",
        })
    return jsonify({
        'results': results,
        '_report_time': report.get('_report_time'),
    })


@skills_bp.route('/vcp')
def vcp():
    """Latest VCP screening results."""
    report = _get_latest_report('vcp-screener')
    if not report:
        return jsonify({'error': 'No VCP report. Run /skill-vcp-screener first.'}), 404

    # Transform to frontend VCPScreenerPage format
    candidates = report.get('results', report.get('candidates', []))
    results = []
    for c in candidates:
        results.append({
            'symbol': c.get('symbol', ''),
            'name': c.get('name', ''),
            'sector': c.get('sector', ''),
            'composite_score': c.get('composite_score', c.get('score', 0)),
            'rating': c.get('rating', ''),
            'current_price': c.get('current_price', c.get('price', 0)),
            'pivot_price': c.get('pivot_price', 0),
            'stop_price': c.get('stop_price', 0),
            'risk_pct': c.get('risk_pct', 0),
            'contractions': c.get('contractions', 0),
            'relative_strength': c.get('relative_strength', c.get('rs_rank', 0)),
            'entry_ready': c.get('entry_ready', False),
        })
    return jsonify({
        'results': results,
        'summary': report.get('summary', {}),
        'metadata': report.get('metadata', {}),
        '_report_time': report.get('_report_time'),
    })


@skills_bp.route('/earnings-trade')
def earnings_trade():
    """Latest earnings trade analysis."""
    report = _get_latest_report('earnings-trade-analyzer')
    if not report:
        return jsonify({'error': 'No earnings trade report. Run /skill-earnings-trade first.'}), 404
    return jsonify(report)

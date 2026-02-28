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
from flask import Blueprint, jsonify

skills_bp = Blueprint('skills', __name__)

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_REPORTS_DIR = os.path.join(_BASE_DIR, 'reports')
_SKILLS_DIR = os.path.join(_BASE_DIR, 'skills')
_PYTHON = os.path.join(_BASE_DIR, '.venv', 'Scripts', 'python.exe')

# Track running skills
_running_skills = {}  # {skill_name: {'started_at': datetime, 'pid': int}}
_recent_results = {}  # {skill_name: {'finished_at': str, 'success': bool, 'exit_code': int}}

# All 38 skills with metadata
# cli_flags: per-script overrides for CLI arguments
#   'api_flag': flag name for API key (default: '--api-key')
#   'no_output_dir': True if script doesn't accept --output-dir
#   'auto_args': extra args for auto/scheduler runs
#   'needs_input': True if script requires user-provided input data
SKILLS_CATALOG = {
    # === Market Analysis & Research ===
    'vcp-screener': {'name': 'VCP Screener', 'category': 'screening', 'script': 'screen_vcp.py', 'api_key': 'FMP_API_KEY'},
    'market-breadth-analyzer': {'name': 'Market Breadth', 'category': 'timing', 'script': 'market_breadth_analyzer.py', 'api_key': None},
    'macro-regime-detector': {'name': 'Macro Regime', 'category': 'analysis', 'script': 'macro_regime_detector.py', 'api_key': None},
    'market-top-detector': {'name': 'Market Top', 'category': 'timing', 'script': 'market_top_detector.py', 'api_key': 'FMP_API_KEY'},
    'ftd-detector': {'name': 'FTD Detector', 'category': 'timing', 'script': 'ftd_detector.py', 'api_key': 'FMP_API_KEY'},
    'uptrend-analyzer': {'name': 'Uptrend Analyzer', 'category': 'analysis', 'script': 'uptrend_analyzer.py', 'api_key': None},
    'us-market-bubble-detector': {'name': 'Bubble Detector', 'category': 'risk', 'script': 'bubble_scorer.py', 'api_key': None,
                                   'cli_flags': {'auto_args': ['--auto']}},
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
    'pair-trade-screener': {'name': 'Pair Trade', 'category': 'screening', 'script': 'analyze_spread.py', 'api_key': 'FMP_API_KEY',
                             'cli_flags': {'no_output_dir': True, 'api_flag': '--fmp-api-key', 'needs_input': True}},
    'value-dividend-screener': {'name': 'Value Dividend', 'category': 'screening', 'script': 'screen_dividend_stocks.py', 'api_key': 'FMP_API_KEY',
                                 'cli_flags': {'no_output_dir': True, 'api_flag': '--fmp-api-key'}},
    'dividend-growth-pullback-screener': {'name': 'Dividend Pullback', 'category': 'screening', 'script': 'screen_dividend_growth_rsi.py', 'api_key': 'FMP_API_KEY',
                                           'cli_flags': {'no_output_dir': True, 'api_flag': '--fmp-api-key'}},

    # === Earnings ===
    'earnings-trade-analyzer': {'name': 'Earnings Trade', 'category': 'earnings', 'script': 'analyze_earnings_trades.py', 'api_key': 'FMP_API_KEY'},
    'earnings-calendar': {'name': 'Earnings Calendar', 'category': 'earnings', 'script': 'fetch_earnings_fmp.py', 'api_key': 'FMP_API_KEY',
                           'cli_flags': {'no_output_dir': True}},
    'economic-calendar-fetcher': {'name': 'Economic Calendar', 'category': 'earnings', 'script': 'get_economic_calendar.py', 'api_key': 'FMP_API_KEY',
                                   'cli_flags': {'no_output_dir': True}},

    # === Strategy & Risk ===
    'backtest-expert': {'name': 'Backtest Expert', 'category': 'strategy', 'script': 'evaluate_backtest.py', 'api_key': None,
                         'cli_flags': {'needs_input': True}},
    'scenario-analyzer': {'name': 'Scenario Analyzer', 'category': 'strategy', 'script': None, 'api_key': None},
    'options-strategy-advisor': {'name': 'Options Strategy', 'category': 'strategy', 'script': 'black_scholes.py', 'api_key': None,
                                  'cli_flags': {'no_output_dir': True, 'needs_input': True}},
    'stanley-druckenmiller-investment': {'name': 'Druckenmiller', 'category': 'strategy', 'script': 'allocation_engine.py', 'api_key': 'FMP_API_KEY',
                                          'cli_flags': {'no_output_dir': True}},
    'strategy-pivot-designer': {'name': 'Strategy Pivot', 'category': 'strategy', 'script': 'detect_stagnation.py', 'api_key': None,
                                 'cli_flags': {'needs_input': True}},
    'portfolio-manager': {'name': 'Portfolio Manager', 'category': 'strategy', 'script': None, 'api_key': 'ALPACA_API_KEY'},

    # === Institutional ===
    'institutional-flow-tracker': {'name': 'Institutional Flow', 'category': 'institutional', 'script': 'track_institutional_flow.py', 'api_key': 'FMP_API_KEY'},

    # === Edge Discovery ===
    'edge-candidate-agent': {'name': 'Edge Candidate', 'category': 'edge', 'script': 'auto_detect_candidates.py', 'api_key': None,
                              'cli_flags': {'needs_input': True}},
    'edge-concept-synthesizer': {'name': 'Edge Synthesizer', 'category': 'edge', 'script': 'synthesize_edge_concepts.py', 'api_key': None,
                                  'cli_flags': {'no_output_dir': True, 'needs_input': True}},
    'edge-hint-extractor': {'name': 'Edge Hints', 'category': 'edge', 'script': 'build_hints.py', 'api_key': None,
                             'cli_flags': {'needs_input': True}},
    'edge-strategy-designer': {'name': 'Edge Strategy', 'category': 'edge', 'script': 'design_strategy_drafts.py', 'api_key': None,
                                'cli_flags': {'needs_input': True}},

    # === Dividend Workflows ===
    'kanchi-dividend-sop': {'name': 'Kanchi Dividend SOP', 'category': 'dividend', 'script': 'build_entry_signals.py', 'api_key': None,
                             'cli_flags': {'needs_input': True}},
    'kanchi-dividend-review-monitor': {'name': 'Dividend Monitor', 'category': 'dividend', 'script': 'build_review_queue.py', 'api_key': None,
                                        'cli_flags': {'no_output_dir': True, 'needs_input': True}},
    'kanchi-dividend-us-tax-accounting': {'name': 'Dividend Tax', 'category': 'dividend', 'script': 'build_tax_planning_sheet.py', 'api_key': None,
                                           'cli_flags': {'needs_input': True}},

    # === Meta ===
    'dual-axis-skill-reviewer': {'name': 'Skill Reviewer', 'category': 'meta', 'script': 'run_dual_axis_review.py', 'api_key': None,
                                  'cli_flags': {'needs_input': True}},
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

        cli_flags = meta.get('cli_flags', {})
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
            'needs_input': cli_flags.get('needs_input', False),
            'auto_runnable': has_script and not cli_flags.get('needs_input', False),
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

    cli_flags = meta.get('cli_flags', {})
    if cli_flags.get('needs_input'):
        return jsonify({'error': f'Skill {skill_name} requires input data (not auto-runnable)'}), 400

    # Build command
    script_path = os.path.join(_SKILLS_DIR, skill_name, 'scripts', meta['script'])
    if not os.path.isfile(script_path):
        return jsonify({'error': f'Script not found: {meta["script"]}'}), 404

    output_dir = os.path.join(_REPORTS_DIR, skill_name)
    os.makedirs(output_dir, exist_ok=True)

    cmd = [_PYTHON, script_path]

    # Add --output-dir unless script doesn't support it
    if not cli_flags.get('no_output_dir'):
        cmd.extend(['--output-dir', output_dir])

    # Add auto args if defined (e.g., bubble_scorer --auto --output json)
    if cli_flags.get('auto_args'):
        cmd.extend(cli_flags['auto_args'])

    # Add API key if required (use per-script flag name)
    if meta.get('api_key'):
        api_key = os.environ.get(meta['api_key'], '')
        if api_key:
            api_flag = cli_flags.get('api_flag', '--api-key')
            cmd.extend([api_flag, api_key])

    # Run in background thread
    def _execute():
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        exit_code = -1
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
            exit_code = proc.returncode
        except subprocess.TimeoutExpired:
            proc.kill()
            exit_code = -2  # timeout
        except Exception:
            pass
        finally:
            _running_skills.pop(skill_name, None)
            _recent_results[skill_name] = {
                'finished_at': datetime.now().isoformat(),
                'success': exit_code == 0,
                'exit_code': exit_code,
            }

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
        'recent': dict(_recent_results),
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
    return jsonify(report)


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
            'name': t.get('name', ''),
            'theme': t.get('name', ''),
            'heat': t.get('heat', 0),
            'heat_score': t.get('heat', 0),
            'heat_label': t.get('heat_label', ''),
            'heat_breakdown': t.get('heat_breakdown', {}),
            'direction': t.get('direction', 'neutral'),
            'confidence': t.get('confidence', ''),
            'stage': t.get('stage', ''),
            'maturity': t.get('maturity', 0),
            'lifecycle_score': t.get('maturity', 0),
            'confidence_score': {'High': 90, 'Medium': 60, 'Low': 30}.get(t.get('confidence', ''), 50),
            'composite_score': (t.get('heat', 0) + t.get('maturity', 0)) / 2,
            'proxy_etfs': t.get('proxy_etfs', []),
            'etfs': t.get('proxy_etfs', []),
            'representative_stocks': t.get('representative_stocks', []),
        })

    # Build summary from themes
    bullish = [t for t in results if t.get('direction') == 'bullish']
    bearish = [t for t in results if t.get('direction') == 'bearish']
    summary = {
        'bullish_count': len(bullish),
        'bearish_count': len(bearish),
        'top_bullish': bullish[0]['name'] if bullish else '',
        'top_bearish': bearish[0]['name'] if bearish else '',
    }

    # Industry rankings from raw report
    industry_rankings = report.get('industry_rankings', {})

    return jsonify({
        'results': results,
        'summary': summary,
        'industry_rankings': industry_rankings,
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
        # Extract nested fields
        vcp_pat = c.get('vcp_pattern', {}) if isinstance(c.get('vcp_pattern'), dict) else {}
        rs_data = c.get('relative_strength', {}) if isinstance(c.get('relative_strength'), dict) else {}
        pivot_prox = c.get('pivot_proximity', {}) if isinstance(c.get('pivot_proximity'), dict) else {}
        vol_pat = c.get('volume_pattern', {}) if isinstance(c.get('volume_pattern'), dict) else {}

        results.append({
            'symbol': c.get('symbol', ''),
            'name': c.get('company_name', c.get('name', '')),
            'sector': c.get('sector', ''),
            'composite_score': c.get('composite_score', c.get('score', 0)),
            'rating': c.get('rating', ''),
            'current_price': c.get('price', c.get('current_price', 0)),
            'pivot_price': vcp_pat.get('pivot_price', pivot_prox.get('pivot_price', 0)),
            'stop_price': c.get('stop_price', 0),
            'risk_pct': pivot_prox.get('risk_pct', c.get('risk_pct', 0)),
            'contractions': vcp_pat.get('num_contractions', c.get('contractions', 0)),
            'relative_strength': rs_data.get('rs_rank_estimate', rs_data.get('rs_percentile', 0)) if isinstance(rs_data, dict) else rs_data,
            'entry_ready': c.get('entry_ready', False),
            'valid_vcp': c.get('valid_vcp', False),
            'volume_dryup': vol_pat.get('contraction_volume_trend', ''),
            'guidance': c.get('guidance', ''),
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


@skills_bp.route('/uptrend')
def uptrend():
    """Latest uptrend analysis."""
    report = _get_latest_report('uptrend-analyzer')
    if not report:
        return jsonify({'error': 'No uptrend report. Run /skill-uptrend-analyzer first.'}), 404
    return jsonify(report)


@skills_bp.route('/canslim')
def canslim():
    """Latest CANSLIM screening results."""
    report = _get_latest_report('canslim-screener')
    if not report:
        return jsonify({'error': 'No CANSLIM report. Run /skill-canslim first.'}), 404
    candidates = report.get('results', report.get('candidates', []))
    results = []
    for c in (candidates if isinstance(candidates, list) else []):
        results.append({
            'symbol': c.get('symbol', ''),
            'name': c.get('name', c.get('company', '')),
            'composite_score': c.get('composite_score', c.get('score', 0)),
            'earnings_growth': c.get('earnings_growth', 0),
            'rs_rank': c.get('rs_rank', c.get('relative_strength', 0)),
            'industry_rank': c.get('industry_rank', 0),
            'institutional_support': c.get('institutional_support', 0),
        })
    return jsonify({
        'results': results,
        'summary': report.get('summary', {}),
        'metadata': report.get('metadata', {}),
        '_report_time': report.get('_report_time'),
    })


@skills_bp.route('/pead')
def pead():
    """Latest PEAD screening results."""
    report = _get_latest_report('pead-screener')
    if not report:
        return jsonify({'error': 'No PEAD report. Run /skill-pead-screener first.'}), 404
    candidates = report.get('results', report.get('candidates', []))
    results = []
    for c in (candidates if isinstance(candidates, list) else []):
        results.append({
            'symbol': c.get('symbol', ''),
            'name': c.get('name', ''),
            'surprise_pct': c.get('surprise_pct', c.get('earnings_surprise', 0)),
            'drift_score': c.get('drift_score', c.get('composite_score', 0)),
            'direction': c.get('direction', 'long'),
            'days_since_earnings': c.get('days_since_earnings', 0),
        })
    return jsonify({
        'results': results,
        'summary': report.get('summary', {}),
        '_report_time': report.get('_report_time'),
    })


@skills_bp.route('/pair-trade')
def pair_trade():
    """Latest pair trade screening results."""
    report = _get_latest_report('pair-trade-screener')
    if not report:
        return jsonify({'error': 'No pair trade report. Run /skill-pair-trade first.'}), 404
    return jsonify(report)


@skills_bp.route('/earnings-calendar')
def earnings_calendar():
    """Latest earnings calendar data."""
    report = _get_latest_report('earnings-calendar')
    if not report:
        return jsonify({'error': 'No earnings calendar. Run /skill-earnings-calendar first.'}), 404
    return jsonify(report)


@skills_bp.route('/econ-calendar')
def econ_calendar():
    """Latest economic calendar data."""
    report = _get_latest_report('economic-calendar-fetcher')
    if not report:
        return jsonify({'error': 'No economic calendar. Run /skill-econ-calendar first.'}), 404
    return jsonify(report)


@skills_bp.route('/druckenmiller')
def druckenmiller():
    """Latest Druckenmiller strategy allocation."""
    report = _get_latest_report('stanley-druckenmiller-investment')
    if not report:
        return jsonify({'error': 'No Druckenmiller report. Run /skill-druckenmiller first.'}), 404
    return jsonify(report)


@skills_bp.route('/institutional-flow')
def institutional_flow():
    """Latest institutional flow tracking."""
    report = _get_latest_report('institutional-flow-tracker')
    if not report:
        return jsonify({'error': 'No institutional flow report. Run /skill-institutional-flow first.'}), 404
    return jsonify(report)


# ================================================================
# Dashboard: Aggregated market pulse from all available skills
# ================================================================

def _extract_score(skill_name: str) -> dict | None:
    """Extract score summary from a skill report."""
    report = _get_latest_report(skill_name)
    if not report:
        return None

    composite = report.get('composite', {})
    quality = report.get('quality_score', {})
    # Use explicit None checks (0 is a valid score)
    score = None
    for candidate in [
        composite.get('composite_score'),
        quality.get('total_score'),
        report.get('score'),
        report.get('composite_score'),
        report.get('percentage'),
    ]:
        if candidate is not None:
            score = candidate
            break
    zone = ''
    for candidate in [
        composite.get('zone'),
        quality.get('signal'),
        report.get('zone'),
        report.get('regime'),
        report.get('phase'),
        report.get('market_state', {}).get('combined_state'),
    ]:
        if candidate is not None:
            zone = candidate
            break
    report_time = report.get('_report_time')

    if score is None:
        return None
    # Ensure numeric score (0 is valid, not falsy)
    if not isinstance(score, (int, float)):
        try:
            score = float(score)
        except (ValueError, TypeError):
            return None

    age_hours = 0
    if report_time:
        try:
            dt = datetime.fromisoformat(report_time)
            age_hours = (datetime.now() - dt).total_seconds() / 3600
        except (ValueError, TypeError):
            pass

    return {
        'score': round(score, 1) if isinstance(score, float) else score,
        'zone': zone,
        'report_time': report_time,
        'age_hours': round(age_hours, 1),
        'fresh': age_hours < 24,
    }


@skills_bp.route('/dashboard')
def dashboard():
    """Aggregated market pulse from all available skill results.

    Returns a combined view of:
    - Market timing signals (breadth, regime, top, FTD, uptrend)
    - Risk indicators (bubble)
    - Active themes count
    - Screening results counts (VCP, CANSLIM, PEAD)
    - Report freshness for all skills
    """
    # Core timing & analysis skills
    timing_skills = {
        'breadth': 'market-breadth-analyzer',
        'regime': 'macro-regime-detector',
        'market_top': 'market-top-detector',
        'ftd': 'ftd-detector',
        'uptrend': 'uptrend-analyzer',
        'bubble': 'us-market-bubble-detector',
    }

    pulse = {}
    for key, skill_name in timing_skills.items():
        result = _extract_score(skill_name)
        if result:
            pulse[key] = result

    # Themes summary
    theme_report = _get_latest_report('theme-detector')
    if theme_report:
        raw_themes = theme_report.get('themes', {})
        all_themes = raw_themes.get('all', []) if isinstance(raw_themes, dict) else []
        pulse['themes'] = {
            'count': len(all_themes),
            'top_themes': [t.get('name', '') for t in all_themes[:5]],
            'report_time': theme_report.get('_report_time'),
        }

    # Screening summary (counts only)
    screening_skills = {
        'vcp': 'vcp-screener',
        'canslim': 'canslim-screener',
        'pead': 'pead-screener',
    }
    screening = {}
    for key, skill_name in screening_skills.items():
        report = _get_latest_report(skill_name)
        if report:
            candidates = report.get('results', report.get('candidates', []))
            count = len(candidates) if isinstance(candidates, list) else 0
            screening[key] = {
                'count': count,
                'report_time': report.get('_report_time'),
            }
    if screening:
        pulse['screening'] = screening

    # Overall market signal
    scores = [v['score'] for v in pulse.values() if isinstance(v, dict) and 'score' in v]
    if scores:
        avg = sum(scores) / len(scores)
        if avg >= 70:
            signal = 'RISK_ON'
        elif avg >= 50:
            signal = 'NEUTRAL'
        elif avg >= 30:
            signal = 'CAUTION'
        else:
            signal = 'RISK_OFF'
        pulse['overall'] = {
            'signal': signal,
            'avg_score': round(avg, 1),
            'skills_reporting': len(scores),
        }

    # Report freshness summary
    total_with_reports = sum(1 for sid in SKILLS_CATALOG if _get_latest_report(sid))
    pulse['meta'] = {
        'total_skills': len(SKILLS_CATALOG),
        'skills_with_reports': total_with_reports,
        'running_skills': list(_running_skills.keys()),
        'timestamp': datetime.now().isoformat(),
    }

    return jsonify(pulse)


# ================================================================
# Workflow Chains (Notion document structure)
# ================================================================

# Chain 1: Daily Market Monitoring
# Economic Calendar → Earnings Calendar → Market News → Breadth Analyst
CHAIN_DAILY_MONITORING = [
    'economic-calendar-fetcher',
    'earnings-calendar',
    'market-news-analyst',
    'market-breadth-analyzer',
]

# Chain 2: Macro Positioning
# Regime Detector → Market Top → FTD → Bubble → Scenario Analyzer → Druckenmiller
CHAIN_MACRO_POSITIONING = [
    'macro-regime-detector',
    'market-top-detector',
    'ftd-detector',
    'us-market-bubble-detector',
    'scenario-analyzer',
    'stanley-druckenmiller-investment',
]

# Chain 3: Stock Research
# US Stock Analysis → Earnings Calendar → Market News → Backtest Expert
CHAIN_STOCK_RESEARCH = [
    'us-stock-analysis',
    'earnings-calendar',
    'market-news-analyst',
    'backtest-expert',
]

WORKFLOW_CHAINS = {
    'daily-monitoring': {
        'name': 'Daily Market Monitoring',
        'description': 'Pre-market flow: Economic Calendar → Earnings Calendar → Market News → Breadth Analysis',
        'skills': CHAIN_DAILY_MONITORING,
    },
    'macro-positioning': {
        'name': 'Macro Positioning',
        'description': 'Regime → Market Top → FTD → Bubble → Scenario → Druckenmiller Allocation',
        'skills': CHAIN_MACRO_POSITIONING,
    },
    'stock-research': {
        'name': 'Stock Research',
        'description': 'Stock Analysis → Earnings Calendar → Market News → Backtest Evaluation',
        'skills': CHAIN_STOCK_RESEARCH,
    },
}


@skills_bp.route('/chains')
def list_chains():
    """List all workflow chains with availability status."""
    result = {}
    for chain_id, chain in WORKFLOW_CHAINS.items():
        skills_status = []
        for skill_name in chain['skills']:
            report = _get_latest_report(skill_name)
            meta = SKILLS_CATALOG.get(skill_name, {})
            skills_status.append({
                'id': skill_name,
                'name': meta.get('name', skill_name),
                'has_report': report is not None,
                'report_time': report.get('_report_time') if report else None,
                'has_script': meta.get('script') is not None,
            })
        result[chain_id] = {
            'name': chain['name'],
            'description': chain['description'],
            'skills': skills_status,
            'complete': all(s['has_report'] for s in skills_status if s['has_script']),
            'available_count': sum(1 for s in skills_status if s['has_report']),
            'total_count': len(skills_status),
        }
    return jsonify(result)


@skills_bp.route('/chain/<chain_id>')
def chain_results(chain_id):
    """Get aggregated results from a workflow chain."""
    if chain_id not in WORKFLOW_CHAINS:
        return jsonify({'error': f'Unknown chain: {chain_id}'}), 404

    chain = WORKFLOW_CHAINS[chain_id]
    results = {}

    for skill_name in chain['skills']:
        report = _get_latest_report(skill_name)
        if report:
            # Extract key data based on skill type
            clean = {'_report_time': report.get('_report_time')}

            composite = report.get('composite', {})
            if composite:
                clean['composite_score'] = composite.get('composite_score')
                clean['zone'] = composite.get('zone')

            regime = report.get('regime', {})
            if regime:
                clean['regime'] = regime.get('classification')

            if 'themes' in report:
                raw = report['themes']
                if isinstance(raw, dict):
                    clean['theme_count'] = len(raw.get('all', []))

            candidates = report.get('results', report.get('candidates'))
            if isinstance(candidates, list):
                clean['candidate_count'] = len(candidates)

            results[skill_name] = clean
        else:
            results[skill_name] = None

    return jsonify({
        'chain': chain_id,
        'name': chain['name'],
        'description': chain['description'],
        'results': results,
    })


@skills_bp.route('/chain/<chain_id>/run', methods=['POST'])
def run_chain(chain_id):
    """Run all executable skills in a workflow chain sequentially."""
    if chain_id not in WORKFLOW_CHAINS:
        return jsonify({'error': f'Unknown chain: {chain_id}'}), 404

    chain = WORKFLOW_CHAINS[chain_id]
    started = []
    skipped = []

    for skill_name in chain['skills']:
        meta = SKILLS_CATALOG.get(skill_name, {})
        if not meta.get('script'):
            skipped.append({'id': skill_name, 'reason': 'prompt-only'})
            continue
        cli_flags = meta.get('cli_flags', {})
        if cli_flags.get('needs_input'):
            skipped.append({'id': skill_name, 'reason': 'needs_input'})
            continue
        if skill_name in _running_skills:
            skipped.append({'id': skill_name, 'reason': 'already_running'})
            continue

        script_path = os.path.join(_SKILLS_DIR, skill_name, 'scripts', meta['script'])
        if not os.path.isfile(script_path):
            skipped.append({'id': skill_name, 'reason': 'script_not_found'})
            continue

        output_dir = os.path.join(_REPORTS_DIR, skill_name)
        os.makedirs(output_dir, exist_ok=True)

        cmd = [_PYTHON, script_path]
        if not cli_flags.get('no_output_dir'):
            cmd.extend(['--output-dir', output_dir])
        if cli_flags.get('auto_args'):
            cmd.extend(cli_flags['auto_args'])
        if meta.get('api_key'):
            api_key_val = os.environ.get(meta['api_key'], '')
            if api_key_val:
                api_flag = cli_flags.get('api_flag', '--api-key')
                cmd.extend([api_flag, api_key_val])

        def _execute(sname, command):
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            exit_code = -1
            try:
                proc = subprocess.Popen(
                    command, cwd=_BASE_DIR, env=env,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                _running_skills[sname] = {
                    'started_at': datetime.now().isoformat(),
                    'pid': proc.pid,
                }
                proc.wait(timeout=600)
                exit_code = proc.returncode
            except subprocess.TimeoutExpired:
                proc.kill()
                exit_code = -2
            except Exception:
                pass
            finally:
                _running_skills.pop(sname, None)
                _recent_results[sname] = {
                    'finished_at': datetime.now().isoformat(),
                    'success': exit_code == 0,
                    'exit_code': exit_code,
                }

        thread = threading.Thread(
            target=_execute, args=(skill_name, cmd),
            daemon=True, name=f'chain-{chain_id}-{skill_name}'
        )
        thread.start()
        started.append(skill_name)

    return jsonify({
        'chain': chain_id,
        'started': started,
        'skipped': skipped,
    })

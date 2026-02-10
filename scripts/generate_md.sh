#!/bin/bash

mkdir -p MD_EXPORT

# Function to wrap file content in markdown block
wrap_file() {
    local file="$1"
    local lang="$2"
    local title=$(basename "$file")
    echo "### $title (file:///Users/seoheun/Documents/kr_market_package/$file)"
    echo '```'$lang
    cat "$file"
    echo '```'
    echo ""
}

# PART 1: Core & Root
{
    echo "# PART 1: Core & Root Files"
    wrap_file "flask_app.py" "python"
    wrap_file "config.py" "python"
    wrap_file "run.py" "python"
    wrap_file "models.py" "python"
    wrap_file "market_gate.py" "python"
} > MD_EXPORT/PART_01_Core_Root.md

# PART 2: Root Scripts
{
    echo "# PART 2: Root Level Scripts"
    wrap_file "scheduler.py" "python"
    wrap_file "screener.py" "python"
    wrap_file "kr_ai_analyzer.py" "python"
    wrap_file "signal_tracker.py" "python"
} > MD_EXPORT/PART_02_Root_Scripts.md

# PART 3: Blueprint 1
{
    echo "# PART 3: Blueprint Documentation (1/3)"
    wrap_file "blueprint/BLUEPRINT_01_OVERVIEW.md" "markdown"
    wrap_file "blueprint/BLUEPRINT_02_BACKEND_FLASK_CORE.md" "markdown"
    wrap_file "blueprint/BLUEPRINT_03_BACKEND_KR_API.md" "markdown"
} > MD_EXPORT/PART_03_Blueprint_1.md

# PART 4: Blueprint 2
{
    echo "# PART 4: Blueprint Documentation (2/3)"
    wrap_file "blueprint/BLUEPRINT_04_BACKEND_AI_ANALYSIS.md" "markdown"
    wrap_file "blueprint/BLUEPRINT_05_BACKEND_DATA_SIGNALS.md" "markdown"
    wrap_file "blueprint/BLUEPRINT_06_FRONTEND.md" "markdown"
} > MD_EXPORT/PART_04_Blueprint_2.md

# PART 5: Blueprint 3
{
    echo "# PART 5: Blueprint Documentation (3/3)"
    wrap_file "blueprint/BLUEPRINT_07_FRONTEND_PARTIALS.md" "markdown"
    wrap_file "blueprint/BLUEPRINT_08_FRONTEND_JAVASCRIPT.md" "markdown"
    wrap_file "blueprint/BLUEPRINT_09_SUPPORTING_MODULES.md" "markdown"
    wrap_file "blueprint/ANALYSIS_WORKFLOW.md" "markdown"
} > MD_EXPORT/PART_05_Blueprint_3.md

# PART 6: App Logic 1
{
    echo "# PART 6: Application Logic (1/2)"
    wrap_file "app/routes/kr_market.py" "python"
    wrap_file "app/routes/common.py" "python"
} > MD_EXPORT/PART_06_App_Logic_1.md

# PART 7: App Logic 2
{
    echo "# PART 7: Application Logic (2/2)"
    wrap_file "all_institutional_trend_data.py" "python"
    wrap_file "app/utils/helpers.py" "python"
    wrap_file "app/utils/scheduler.py" "python"
    wrap_file "app/utils/cache.py" "python"
} > MD_EXPORT/PART_07_App_Logic_2.md

# PART 8: Engine Logic 1
{
    echo "# PART 8: Engine Logic (1/2)"
    wrap_file "engine/collectors.py" "python"
    wrap_file "engine/generator.py" "python"
    wrap_file "engine/scorer.py" "python"
} > MD_EXPORT/PART_08_Engine_Logic_1.md

# PART 9: Engine Logic 2
{
    echo "# PART 9: Engine Logic (2/2)"
    wrap_file "engine/models.py" "python"
    wrap_file "engine/position_sizer.py" "python"
    wrap_file "engine/llm_analyzer.py" "python"
    wrap_file "engine/config.py" "python"
} > MD_EXPORT/PART_09_Engine_Logic_2.md

# PART 10: Frontend 1
{
    echo "# PART 10: Frontend - Data & VCP Pages"
    wrap_file "frontend/src/app/dashboard/kr/vcp/page.tsx" "tsx"
    wrap_file "frontend/src/app/dashboard/kr/page.tsx" "tsx"
    wrap_file "frontend/src/app/dashboard/data-status/page.tsx" "tsx"
} > MD_EXPORT/PART_10_Frontend_1.md

# PART 11: Frontend 2
{
    echo "# PART 11: Frontend - Closing Bet & Layout"
    wrap_file "frontend/src/app/dashboard/kr/closing-bet/page.tsx" "tsx"
    wrap_file "frontend/src/components/layout/Sidebar.tsx" "tsx"
    wrap_file "frontend/src/components/layout/Header.tsx" "tsx"
    wrap_file "frontend/src/lib/api.ts" "typescript"
    wrap_file "frontend/src/app/globals.css" "css"
} > MD_EXPORT/PART_11_Frontend_2.md

# PART 12: Scripts 1
{
    echo "# PART 12: Scripts & Automation (1/2)"
    wrap_file "scripts/analysis2.py" "python"
} > MD_EXPORT/PART_12_Scripts_1.md

# PART 13: Scripts 2
{
    echo "# PART 13: Scripts & Automation (2/2)"
    wrap_file "scripts/create_complete_daily_prices.py" "python"
    wrap_file "scripts/integrated_fundamental_data.py" "python"
    wrap_file "scripts/investigate_top_stocks.py" "python"
    wrap_file "scripts/update_portfolio_history.py" "python"
    wrap_file "scripts/track_performance.py" "python"
    wrap_file "scripts/run_analysis.py" "python"
    wrap_file "scripts/create_ticker_map.py" "python"
    wrap_file "scripts/run_closing_bet.py" "python"
} > MD_EXPORT/PART_13_Scripts_2.md

# PART 14: Chatbot
{
    echo "# PART 14: AI Chatbot Logic"
    wrap_file "chatbot/core.py" "python"
    wrap_file "chatbot/data_loader.py" "python"
    wrap_file "chatbot/prompts.py" "python"
    wrap_file "chatbot/history.py" "python"
    wrap_file "chatbot/memory.py" "python"
} > MD_EXPORT/PART_14_Chatbot.md

# PART 15: Backtest
{
    echo "# PART 15: Backtesting Engine"
    wrap_file "backtest/engine.py" "python"
    wrap_file "run_backtest_advanced.py" "python"
    wrap_file "run_backtest.py" "python"
    wrap_file "run_historical_backtest.py" "python"
    wrap_file "collect_historical_data.py" "python"
} > MD_EXPORT/PART_15_Backtest.md

# PART 16: Remaining
{
    echo "# PART 16: Remaining Documentation"
    wrap_file "README.md" "markdown"
    wrap_file "SETUP_GUIDE.md" "markdown"
    wrap_file "wave_transition_report.md" "markdown"
} > MD_EXPORT/PART_16_Remaining.md

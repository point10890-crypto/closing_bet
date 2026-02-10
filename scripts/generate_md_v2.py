import os

# Configuration
LIMIT = 700
EXPORT_DIR = "MD_EXPORT_V2"
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

os.makedirs(EXPORT_DIR, exist_ok=True)

# Files to include (ordered logically)
INCLUDES = [
    # Core & Startup
    "flask_app.py", "config.py", "run.py", "models.py", "market_gate.py",
    "scheduler.py", "screener.py", "kr_ai_analyzer.py", "signal_tracker.py",
    # Blueprint
    "blueprint/BLUEPRINT_01_OVERVIEW.md",
    "blueprint/BLUEPRINT_02_BACKEND_FLASK_CORE.md",
    "blueprint/BLUEPRINT_03_BACKEND_KR_API.md",
    "blueprint/BLUEPRINT_04_BACKEND_AI_ANALYSIS.md",
    "blueprint/BLUEPRINT_05_BACKEND_DATA_SIGNALS.md",
    "blueprint/BLUEPRINT_06_FRONTEND.md",
    "blueprint/BLUEPRINT_07_FRONTEND_PARTIALS.md",
    "blueprint/BLUEPRINT_08_FRONTEND_JAVASCRIPT.md",
    "blueprint/BLUEPRINT_09_SUPPORTING_MODULES.md",
    "blueprint/ANALYSIS_WORKFLOW.md",
    # App
    "app/routes/kr_market.py",
    "app/routes/common.py",
    "all_institutional_trend_data.py",
    "app/utils/helpers.py",
    "app/utils/scheduler.py",
    "app/utils/cache.py",
    # Engine
    "engine/collectors.py",
    "engine/generator.py",
    "engine/scorer.py",
    "engine/models.py",
    "engine/position_sizer.py",
    "engine/llm_analyzer.py",
    "engine/config.py",
    # Frontend
    "frontend/src/app/dashboard/kr/vcp/page.tsx",
    "frontend/src/app/dashboard/kr/page.tsx",
    "frontend/src/app/dashboard/data-status/page.tsx",
    "frontend/src/app/dashboard/kr/closing-bet/page.tsx",
    "frontend/src/components/layout/Sidebar.tsx",
    "frontend/src/components/layout/Header.tsx",
    "frontend/src/lib/api.ts",
    "frontend/src/app/globals.css",
    # Scripts
    "scripts/analysis2.py",
    "scripts/create_complete_daily_prices.py",
    "scripts/integrated_fundamental_data.py",
    "scripts/investigate_top_stocks.py",
    "scripts/update_portfolio_history.py",
    "scripts/track_performance.py",
    "scripts/run_analysis.py",
    "scripts/create_ticker_map.py",
    "scripts/run_closing_bet.py",
    # Chatbot & Backtest
    "chatbot/core.py",
    "chatbot/data_loader.py",
    "chatbot/prompts.py",
    "chatbot/history.py",
    "chatbot/memory.py",
    "backtest/engine.py",
    "run_backtest_advanced.py",
    "run_backtest.py",
    "run_historical_backtest.py",
    "collect_historical_data.py",
    # Doc
    "README.md", "SETUP_GUIDE.md", "wave_transition_report.md"
]

current_part = 1
current_lines = 0
current_content = []

def save_part():
    global current_part, current_lines, current_content
    if not current_content:
        return
    filename = os.path.join(EXPORT_DIR, f"PART_{current_part:02d}.md")
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"# PART {current_part}\n\n")
        f.writelines(current_content)
    print(f"Saved {filename} ({current_lines} lines)")
    current_part += 1
    current_lines = 0
    current_content = []

for rel_path in INCLUDES:
    abs_path = os.path.join(PROJECT_ROOT, rel_path)
    if not os.path.exists(abs_path):
        print(f"Warning: {rel_path} not found.")
        continue
    
    with open(abs_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    file_lines = len(lines)
    ext = os.path.splitext(rel_path)[1].replace(".", "")
    if ext == "py": lang = "python"
    elif ext == "md": lang = "markdown"
    elif ext == "tsx": lang = "tsx"
    elif ext == "ts": lang = "typescript"
    elif ext == "css": lang = "css"
    else: lang = ""

    # Check if adding this file exceeds limit
    if current_lines + file_lines > LIMIT and current_lines > 0:
        save_part()
    
    # Add file header
    current_content.append(f"### {rel_path} (file://{abs_path})\n")
    current_content.append(f"```{lang}\n")
    
    # If a single file is huge, we might need to split it (rare, but possible)
    if file_lines > LIMIT:
        # We start a new part if we already have content
        if current_lines > 0:
              save_part()
              current_content.append(f"### {rel_path} (Continued) (file://{abs_path})\n")
              current_content.append(f"```{lang}\n")

        # Split large file into chunks
        for i in range(0, file_lines, LIMIT):
            chunk = lines[i:i+LIMIT]
            current_content.extend(chunk)
            current_lines = len(chunk)
            # If not last chunk, close and save
            if i + LIMIT < file_lines:
                current_content.append(f"```\n")
                save_part()
                current_content.append(f"### {rel_path} (Continued) (file://{abs_path})\n")
                current_content.append(f"```{lang}\n")
    else:
        current_content.extend(lines)
        current_lines += file_lines
    
    current_content.append(f"```\n\n")

save_part()

# Manifest
with open(os.path.join(EXPORT_DIR, "MANIFEST.md"), "w", encoding="utf-8") as f:
    f.write("# Project MD Export Manifest (Granular 70% Edition)\n\n")
    f.write(f"Total Parts: {current_part - 1}\n\n")
    f.write("Restoration Instructions: Copy each part sequentially to your AI tool.\n")

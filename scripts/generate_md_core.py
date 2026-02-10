import os

# Configuration
LIMIT = 1000  # Return to 1000 lines for a cleaner, less fragmented look
EXPORT_DIR = "MD_EXPORT_CORE_ONLY"
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

os.makedirs(EXPORT_DIR, exist_ok=True)

# Files to include (Core 70% only)
INCLUDES = [
    # Core Backend
    "flask_app.py", "config.py", "run.py", "models.py",
    # Essential Routes
    "app/routes/kr_market.py",
    "app/routes/common.py",
    # AI & Core Engine
    "engine/generator.py",
    "engine/llm_analyzer.py",
    "engine/config.py",
    # Main Frontend Pages
    "frontend/src/app/dashboard/kr/vcp/page.tsx",
    "frontend/src/app/dashboard/kr/page.tsx",
    "frontend/src/app/dashboard/kr/closing-bet/page.tsx",
    "frontend/src/lib/api.ts",
    "frontend/src/app/globals.css",
    # Chatbot Core
    "chatbot/core.py",
    "chatbot/prompts.py",
    # Minimum Documentation
    "blueprint/BLUEPRINT_01_OVERVIEW.md",
    "README.md"
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
        f.write(f"# PART {current_part} (Core Logic)\n\n")
        f.writelines(current_content)
    print(f"Saved {filename} ({current_lines} lines)")
    current_part += 1
    current_lines = 0
    current_content = []

for rel_path in INCLUDES:
    abs_path = os.path.join(PROJECT_ROOT, rel_path)
    if not os.path.exists(abs_path):
        continue
    
    with open(abs_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    file_lines = len(lines)
    ext = os.path.splitext(rel_path)[1].replace(".", "")
    lang_map = {"py": "python", "md": "markdown", "tsx": "tsx", "ts": "typescript", "css": "css"}
    lang = lang_map.get(ext, "")

    if current_lines + file_lines > LIMIT and current_lines > 0:
        save_part()
    
    current_content.append(f"### {rel_path} (file://{abs_path})\n")
    current_content.append(f"```{lang}\n")
    
    if file_lines > LIMIT:
        if current_lines > 0:
              save_part()
              current_content.append(f"### {rel_path} (Continued) (file://{abs_path})\n")
              current_content.append(f"```{lang}\n")
        for i in range(0, file_lines, LIMIT):
            chunk = lines[i:i+LIMIT]
            current_content.extend(chunk)
            current_lines = len(chunk)
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

with open(os.path.join(EXPORT_DIR, "MANIFEST.md"), "w", encoding="utf-8") as f:
    f.write("# Project MD Export (Core Logic Only)\n\n")
    f.write("This export contains ONLY the heart of the system (~70% coverage).\n")
    f.write("Advanced automation scripts and secondary documentation have been omitted for simplicity.\n\n")
    f.write(f"Total Parts: {current_part - 1}\n")

# KR Market - AI Execution Prompt

**Copy and paste the following prompt into your AI Assistant (Cursor, Windsurf, etc.) to set up and run the project automatically:**

---

**@Agent** Please set up and run the KR Market Package for me by following these steps:

1.  **Environment Check**:
    - Ensure `python3` and `node` (v18+) are installed.
    - Check if `.env` exists. If not, copy `.env.example` to `.env`.

2.  **Configuration**:
    - **CRITICAL**: Check `.env` for `GEMINI_API_KEY`. If empty, ask me to provide it before proceeding.

3.  **Setup & Run**:
    - Give execute permission to the startup script: `chmod +x start.sh`
    - Run the script: `./start.sh`

4.  **Verification**:
    - Once running, confirm that the Dashboard is accessible at `http://localhost:4000/dashboard/kr`.

---

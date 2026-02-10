#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
통합 워치독 - 서버 감시 + 스케줄러 감시 + 텔레그램 알림
Flask(5001) / Next.js(4000) / Scheduler 가 죽으면 자동 재시작
상태 변경 시 텔레그램으로 알림 전송

사용법:
  python watchdog.py          # 전체 감시 (30초 간격)
  python watchdog.py --once   # 1회 점검 후 종료
"""
import sys
import os
import time
import subprocess
import socket
import argparse
import json
from datetime import datetime

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# ─── 고정 설정 ───
BASE_DIR = r"C:\closing_bet"
PYTHON = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

FLASK_PORT = 5001
NEXTJS_PORT = 4000
CHECK_INTERVAL = 30  # 초

LOG_FILE = os.path.join(BASE_DIR, "logs", "watchdog.log")
PID_FILE = os.path.join(BASE_DIR, "logs", "scheduler.pid")

# .env 로드
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except ImportError:
    pass


def log(msg):
    """로그 출력 + 파일 저장"""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def send_telegram(message):
    """텔레그램 알림 전송 (개인 + 채널 동시)"""
    import requests
    success = False

    # 1) 기존 개인 봇
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if token and chat_id:
        try:
            r = requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
                timeout=10
            )
            if r.status_code == 200:
                success = True
        except Exception as e:
            log(f"[TELEGRAM] Personal send failed: {e}")

    # 2) 채널 봇 (style_종가매매)
    ch_token = os.getenv("TELEGRAM_CHANNEL_BOT_TOKEN")
    ch_chat_id = os.getenv("TELEGRAM_CHANNEL_CHAT_ID")
    if ch_token and ch_chat_id:
        try:
            r = requests.post(
                f"https://api.telegram.org/bot{ch_token}/sendMessage",
                json={"chat_id": ch_chat_id, "text": message, "parse_mode": "HTML"},
                timeout=10
            )
            if r.status_code == 200:
                success = True
        except Exception as e:
            log(f"[TELEGRAM] Channel send failed: {e}")

    return success


def is_port_alive(port, host="127.0.0.1", timeout=3):
    """포트에 TCP 연결이 가능한지 확인"""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def is_process_alive(pid):
    """PID가 살아있는지 확인"""
    if not pid:
        return False
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
            capture_output=True, text=True, timeout=5
        )
        return str(pid) in result.stdout
    except Exception:
        return False


def get_scheduler_pid():
    """저장된 스케줄러 PID 읽기"""
    try:
        if os.path.exists(PID_FILE):
            with open(PID_FILE, "r") as f:
                return int(f.read().strip())
    except Exception:
        pass
    return None


def save_scheduler_pid(pid):
    """스케줄러 PID 저장"""
    try:
        os.makedirs(os.path.dirname(PID_FILE), exist_ok=True)
        with open(PID_FILE, "w") as f:
            f.write(str(pid))
    except Exception:
        pass


# ─── 서버 시작 함수 ───

def start_flask():
    """Flask 서버 시작"""
    log(f"[FLASK] Starting on port {FLASK_PORT}...")
    proc = subprocess.Popen(
        [PYTHON, "flask_app.py"],
        cwd=BASE_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    log(f"[FLASK] Started PID={proc.pid}")
    return proc


def start_nextjs():
    """Next.js 서버 시작 (production)"""
    log(f"[NEXT.JS] Starting on port {NEXTJS_PORT}...")
    npx = os.path.join(FRONTEND_DIR, "node_modules", ".bin", "next.cmd")
    if not os.path.exists(npx):
        npx = "npx"
    proc = subprocess.Popen(
        [npx, "next", "start", "-p", str(NEXTJS_PORT)],
        cwd=FRONTEND_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        shell=True,
    )
    log(f"[NEXT.JS] Started PID={proc.pid}")
    return proc


def start_scheduler():
    """스케줄러 데몬 시작"""
    log("[SCHEDULER] Starting daemon mode...")
    log_path = os.path.join(BASE_DIR, "logs", "scheduler.log")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    log_f = open(log_path, "a", encoding="utf-8")
    proc = subprocess.Popen(
        [PYTHON, "scheduler.py", "--daemon"],
        cwd=BASE_DIR,
        stdout=log_f,
        stderr=log_f,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    save_scheduler_pid(proc.pid)
    log(f"[SCHEDULER] Started PID={proc.pid}")
    return proc


# ─── 메인 감시 루프 ───

def check_and_restart():
    """서버 + 스케줄러 상태 확인, 필요 시 재시작 + 텔레그램 알림"""
    restarted = []

    # 1. Flask 체크
    if not is_port_alive(FLASK_PORT):
        log(f"[WARN] Flask(:{FLASK_PORT}) DOWN - restarting...")
        start_flask()
        time.sleep(5)
        if is_port_alive(FLASK_PORT):
            log(f"[OK] Flask(:{FLASK_PORT}) recovered")
            restarted.append("Flask(:5001)")
        else:
            log(f"[ERROR] Flask(:{FLASK_PORT}) failed to restart")

    # 2. Next.js 체크
    if not is_port_alive(NEXTJS_PORT):
        log(f"[WARN] Next.js(:{NEXTJS_PORT}) DOWN - restarting...")
        start_nextjs()
        time.sleep(8)
        if is_port_alive(NEXTJS_PORT):
            log(f"[OK] Next.js(:{NEXTJS_PORT}) recovered")
            restarted.append("Next.js(:4000)")
        else:
            log(f"[ERROR] Next.js(:{NEXTJS_PORT}) failed to restart")

    # 3. Scheduler 체크
    scheduler_pid = get_scheduler_pid()
    if not is_process_alive(scheduler_pid):
        log(f"[WARN] Scheduler(PID={scheduler_pid}) DOWN - restarting...")
        start_scheduler()
        time.sleep(3)
        new_pid = get_scheduler_pid()
        if is_process_alive(new_pid):
            log(f"[OK] Scheduler recovered (PID={new_pid})")
            restarted.append("Scheduler")
        else:
            log(f"[ERROR] Scheduler failed to restart")

    # 4. 재시작된 것이 있으면 텔레그램 알림
    if restarted:
        ts = datetime.now().strftime("%H:%M:%S")
        msg = (
            f"<b>🔄 서버 자동 재시작</b>\n"
            f"⏰ {ts}\n"
            f"🔧 재시작: {', '.join(restarted)}\n"
            f"📊 Flask: {'✅' if is_port_alive(FLASK_PORT) else '❌'}\n"
            f"🖥 Frontend: {'✅' if is_port_alive(NEXTJS_PORT) else '❌'}\n"
            f"⏰ Scheduler: {'✅' if is_process_alive(get_scheduler_pid()) else '❌'}"
        )
        send_telegram(msg)

    return restarted


def main():
    parser = argparse.ArgumentParser(description="통합 워치독")
    parser.add_argument("--once", action="store_true", help="1회 점검 후 종료")
    args = parser.parse_args()

    log("=" * 50)
    log("Watchdog started (Flask + Next.js + Scheduler)")
    log(f"  BASE: {BASE_DIR}")
    log(f"  Flask: :{FLASK_PORT}  Next.js: :{NEXTJS_PORT}")
    log(f"  Scheduler: daemon mode")
    log(f"  Interval: {CHECK_INTERVAL}s")
    log("=" * 50)

    # 시작 알림
    send_telegram(
        f"<b>🚀 KR Market 워치독 시작</b>\n"
        f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"📍 C:\\closing_bet\n"
        f"🔄 감시 간격: {CHECK_INTERVAL}초"
    )

    if args.once:
        check_and_restart()
        flask_ok = is_port_alive(FLASK_PORT)
        next_ok = is_port_alive(NEXTJS_PORT)
        sched_ok = is_process_alive(get_scheduler_pid())
        log(f"Flask: {'OK' if flask_ok else 'DOWN'} | Next.js: {'OK' if next_ok else 'DOWN'} | Scheduler: {'OK' if sched_ok else 'DOWN'}")
        return

    # 데몬 모드 - 무한 루프
    try:
        while True:
            check_and_restart()
            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        log("Watchdog stopped by user")
        send_telegram("⛔ KR Market 워치독 종료됨")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
🇰🇷 한국 주식 시장 전용 업데이트 스크립트 (Real-time Logs)
사용법: python update_kr.py
"""

import sys
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

# ANSI 색상
class Color:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log(msg, color=Color.END):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"{Color.CYAN}[{timestamp}]{Color.END} {color}{msg}{Color.END}")

def run_command_live(cmd, description):
    """명령어를 실행하고 출력을 실시간으로 보여줍니다."""
    log(f"🚀 {description} 시작...", Color.YELLOW)
    print("-" * 60)
    
    start_time = time.time()
    
    try:
        # Popen으로 실행하여 실시간 출력 캡처
        process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # 실시간 출력
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                print(f"   {output.strip()}")
        
        return_code = process.poll()
        elapsed = time.time() - start_time
        
        print("-" * 60)
        if return_code == 0:
            log(f"✅ {description} 완료 ({elapsed:.1f}초)", Color.GREEN)
            return True
        else:
            log(f"❌ {description} 실패 (Exit Code: {return_code})", Color.RED)
            return False
            
    except Exception as e:
        print("-" * 60)
        log(f"❌ 실행 중 에러 발생: {e}", Color.RED)
        return False

def main():
    # 프로젝트 루트 설정
    project_root = Path(__file__).parent.absolute()
    os.chdir(project_root)
    
    print("\n" + "=" * 60)
    log("🇰🇷 한국 시장 데이터 전체 업데이트", Color.BOLD)
    print("=" * 60 + "\n")
    
    # 가상환경 Python 경로
    python_exe = sys.executable
    
    results = []
    
    # 1. 스케줄러를 통해 전체 KR 작업 실행 (실시간 로그 출력됨)
    # scheduler.py --now 옵션은 다음을 순차적으로 수행:
    # - 가격 데이터
    # - 수급 데이터
    # - VCP 스캔
    # - AI 분석
    # - 종가베팅 V2
    # - 리포트 생성
    
    cmd = f'"{python_exe}" scheduler.py --now'
    success = run_command_live(cmd, "KR Market 통합 업데이트")
    
    print("\n" + "=" * 60)
    if success:
        log("🎉 모든 작업이 성공적으로 완료되었습니다!", Color.GREEN)
    else:
        log("⚠️ 일부 작업이 실패했습니다.", Color.RED)
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()

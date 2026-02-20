#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
부동산/주식 자동 분석 워크플로우 실행 스크립트
순서:
1. create_complete_daily_prices.py (일별 시세 수집)
2. all_institutional_trend_data.py (기관/외국인 수급 수집)
3. analysis2.py (파동 분석 및 리포트 생성)
"""

import subprocess
import sys
import time
import os

def run_script(script_name):
    """스크립트 실행 및 결과 확인"""
    print(f"🚀 [{script_name}] 실행 시작...")
    start_time = time.time()
    
    try:
        # 현재 파이썬 인터프리터로 스크립트 실행
        # unbuffered output (-u) 옵션 사용
        cmd = [sys.executable, "-u", script_name]
        
        # 실시간 출력을 위해 Popen 사용 가능하지만, 
        # 여기서는 간단하게 run을 사용하고 출력을 그대로 보여줌
        result = subprocess.run(
            cmd, 
            check=True,
            text=True
        )
        
        end_time = time.time()
        duration = end_time - start_time
        print(f"✅ [{script_name}] 완료 ({duration:.1f}초)\n")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ [{script_name}] 실행 중 오류 발생 (Exit Code: {e.returncode})")
        return False
    except Exception as e:
        print(f"❌ [{script_name}] 실행 실패: {e}")
        return False

def main():
    # 실행할 스크립트 목록 (순서 중요)
    scripts = [
        "create_complete_daily_prices.py",
        "all_institutional_trend_data.py", 
        "analysis2.py",
        "investigate_top_stocks.py"
    ]
    
    print("="*60)
    print("🤖 부동산/주식 자동 분석 시스템 시작")
    print("="*60 + "\n")
    
    total_start = time.time()
    success_count = 0
    
    # 작업 디렉토리 확인
    current_dir = os.getcwd()
    print(f"📂 작업 디렉토리: {current_dir}\n")
    
    for script in scripts:
        if not os.path.exists(script):
            print(f"⛔ 파일이 없습니다: {script}")
            print("실행을 중단합니다.")
            return
            
        if run_script(script):
            success_count += 1
        else:
            print("⛔ 스크립트 오류로 인해 전체 프로세스를 중단합니다.")
            break
            
    total_end = time.time()
    total_duration = total_end - total_start
    
    print("="*60)
    if success_count == len(scripts):
        print(f"🎉 모든 분석 과정이 성공적으로 완료되었습니다!")
        print(f"⏱️ 총 소요 시간: {total_duration:.1f}초")
        print("📄 결과 리포트: wave_transition_report.txt")
    else:
        print(f"⚠️ 분석 과정 중 일부가 실패했습니다. ({success_count}/{len(scripts)} 완료)")
    print("="*60)

if __name__ == "__main__":
    main()

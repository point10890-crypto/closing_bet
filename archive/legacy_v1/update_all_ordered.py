"""
전체 데이터 업데이트 순차 실행 스크립트
scheduler.py의 run_full_update()를 호출하여 모든 데이터를 갱신합니다.
"""
import sys
import os

# 현재 디렉토리를 모듈 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scheduler import run_full_update

if __name__ == "__main__":
    print("🚀 전체 데이터 업데이트를 시작합니다...")
    success = run_full_update()
    if success:
        print("Qq✅ 전체 업데이트가 성공적으로 완료되었습니다.")
        sys.exit(0)
    else:
        print("❌ 일부 업데이트 과정에서 오류가 발생했습니다.")
        sys.exit(1)

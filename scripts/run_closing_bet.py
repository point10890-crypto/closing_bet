
import sys
import os
import json
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ClosingBetRunner")

def main():
    # 프로젝트 루트 경로 추가
    # 스크립트가 kr_market/scripts/ 또는 루트에서 실행될 수 있음을 고려
    # 현재 디렉토리 설정 (exec 실행 시 __file__ 없음 대비)
    if '__file__' in globals():
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    else:
        project_root = os.getcwd()

    if project_root not in sys.path:
        sys.path.append(project_root)

    try:
        from closing_bet.scanner import get_scanner
        
        logger.info("Starting Closing Bet Scan...")
        scanner = get_scanner()
        
        # 강제로 스캔 실행 (캐시 무시 옵션이 있다면 좋겠지만 없으므로 그대로 실행)
        summary = scanner.get_scan_summary()
        
        # 저장 경로 설정 — data/ 하위에 저장
        output_dir = os.path.join(project_root, 'data', 'closing_bet')
        os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, 'summary.json')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
            
        logger.info(f"✅ Closing Bet summary saved to {output_path}")
        print(f"Closing Bet summary saved to {output_path}")
        
    except Exception as e:
        logger.error(f"❌ Error running closing bet scan: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Memory Manager - 사용자 장기 메모리 관리
투자 성향, 관심 섹터, 보유 종목 등 저장
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any


class MemoryManager:
    """
    장기 메모리 관리
    - 사용자 프로필, 투자 성향, 관심 섹터 등 저장
    - 모든 대화에서 참조됨
    """
    
    def __init__(self, user_id: str, data_dir: Path = None):
        self.user_id = user_id
        if data_dir is None:
            data_dir = Path(__file__).parent / "data"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.file_path = self.data_dir / f"{user_id}_memory.json"
        self.memory = self._load()
    
    def _load(self) -> dict:
        """저장된 메모리 불러오기"""
        if self.file_path.exists():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def _save(self):
        """메모리 저장"""
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(self.memory, f, ensure_ascii=False, indent=2)
    
    def view(self) -> dict:
        """전체 메모리 조회"""
        return self.memory
    
    def add(self, key: str, value: str) -> str:
        """메모리 추가"""
        self.memory[key] = {
            "value": value,
            "created_at": datetime.now().isoformat(),
            "updated_at": None
        }
        self._save()
        return f"✅ 저장됨: {key} = {value}"
    
    def remove(self, key: str) -> str:
        """메모리 삭제"""
        if key in self.memory:
            del self.memory[key]
            self._save()
            return f"✅ 삭제됨: {key}"
        return f"❌ 존재하지 않음: {key}"
    
    def update(self, key: str, value: str) -> str:
        """메모리 수정"""
        if key in self.memory:
            self.memory[key]["value"] = value
            self.memory[key]["updated_at"] = datetime.now().isoformat()
            self._save()
            return f"✅ 수정됨: {key} = {value}"
        return f"❌ 존재하지 않음: {key}"
    
    def get(self, key: str) -> Optional[str]:
        """특정 메모리 조회"""
        if key in self.memory:
            return self.memory[key]["value"]
        return None
    
    def format_for_prompt(self) -> str:
        """Gemini 프롬프트용 포맷팅"""
        if not self.memory:
            return ""
        
        lines = ["## 사용자 정보 (장기 메모리)"]
        for key, data in self.memory.items():
            lines.append(f"- {key}: {data['value']}")
        
        return "\n".join(lines)
    
    def clear(self) -> str:
        """전체 메모리 초기화"""
        self.memory = {}
        self._save()
        return "✅ 모든 메모리가 삭제되었습니다."
    
    def to_dict(self) -> Dict[str, Any]:
        """API 응답용 딕셔너리 변환"""
        return {
            "user_id": self.user_id,
            "count": len(self.memory),
            "items": {k: v["value"] for k, v in self.memory.items()}
        }

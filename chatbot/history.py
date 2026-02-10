#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Manager - 대화 히스토리 관리
최근 N개 대화 컨텍스트 유지
"""

import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# 설정
MAX_HISTORY_TURNS = 10  # 최근 N개 대화 유지


class HistoryManager:
    """
    대화 히스토리 관리
    - 전체 대화 영구 저장
    - Gemini에는 최근 N개만 전달
    """
    
    def __init__(self, user_id: str, data_dir: Path = None):
        self.user_id = user_id
        if data_dir is None:
            data_dir = Path(__file__).parent / "data"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.file_path = self.data_dir / f"{user_id}_history.json"
        self.history = self._load()
    
    def _load(self) -> list:
        """저장된 히스토리 불러오기"""
        if self.file_path.exists():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return []
        return []
    
    def _save(self):
        """히스토리 저장"""
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)
    
    def add(self, role: str, content: str):
        """대화 추가"""
        self.history.append({
            "role": role,  # "user" or "model"
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        self._save()
    
    def get_recent(self, n: int = None) -> List[Dict]:
        """
        최근 N개 대화 반환 (Gemini API용)
        n이 None이면 설정값 사용
        """
        if n is None:
            n = MAX_HISTORY_TURNS
        
        # user+model 쌍이므로 *2
        recent = self.history[-n * 2:]
        
        # Gemini 포맷으로 변환
        return [
            {"role": h["role"], "parts": [h["content"]]} 
            for h in recent
        ]
    
    def get_all(self) -> List[Dict]:
        """전체 히스토리 반환"""
        return self.history
    
    def get_recent_messages(self, n: int = 5) -> List[Dict]:
        """최근 N개 메시지 반환 (UI용)"""
        return self.history[-n * 2:]
    
    def get_summary(self, last_n: int = 5) -> str:
        """최근 대화 요약 (디버깅/확인용)"""
        recent = self.history[-last_n * 2:]
        lines = []
        for h in recent:
            role = "🧑" if h["role"] == "user" else "🤖"
            content = h["content"][:50] + "..." if len(h["content"]) > 50 else h["content"]
            lines.append(f"{role} {content}")
        return "\n".join(lines)
    
    def clear(self) -> str:
        """히스토리 초기화"""
        self.history = []
        self._save()
        return "✅ 대화 히스토리가 초기화되었습니다."
    
    def count(self) -> int:
        """총 대화 수"""
        return len(self.history)
    
    def to_dict(self) -> Dict[str, Any]:
        """API 응답용 딕셔너리 변환"""
        return {
            "user_id": self.user_id,
            "total_messages": len(self.history),
            "recent": self.get_recent_messages(5)
        }

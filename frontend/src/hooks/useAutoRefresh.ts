'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * 자동 데이터 갱신 훅 (Page Visibility API 기반)
 * - 탭이 보이는 상태에서만 polling
 * - 백그라운드에서 포그라운드로 돌아오면 즉시 1회 fetch
 * - 모바일(ngrok) 포함 전 플랫폼 지원
 */
export function useAutoRefresh(
    fetchFn: () => void | Promise<void>,
    intervalMs: number = 30000,
    enabled: boolean = true
) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fetchRef = useRef(fetchFn);

    // 항상 최신 fetchFn 참조 유지
    useEffect(() => {
        fetchRef.current = fetchFn;
    }, [fetchFn]);

    const startPolling = useCallback(() => {
        if (intervalRef.current) return;
        intervalRef.current = setInterval(() => {
            fetchRef.current();
        }, intervalMs);
    }, [intervalMs]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            stopPolling();
            return;
        }

        // 페이지 가시성 변경 핸들러
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                // 포그라운드 복귀 → 즉시 1회 fetch + polling 재개
                fetchRef.current();
                startPolling();
            } else {
                // 백그라운드 → polling 중단
                stopPolling();
            }
        };

        // 초기 polling 시작
        startPolling();
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, startPolling, stopPolling]);
}

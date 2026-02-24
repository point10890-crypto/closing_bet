'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * SessionProvider를 안전하게 감싸는 래퍼.
 * Vercel 정적 배포 환경에서 /api/auth/session이 404를 반환해도
 * 앱 전체가 크래시하지 않도록 에러를 격리합니다.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
    // Auth는 로컬 개발 환경에서만 활성화 (localhost API 연결 시)
    // Vercel/정적 배포에서는 /api/auth/session이 없으므로 SessionProvider 비활성화
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (!apiUrl.includes('localhost')) {
        return <>{children}</>;
    }

    return <SessionProvider>{children}</SessionProvider>;
}

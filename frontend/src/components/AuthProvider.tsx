'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * SessionProvider를 안전하게 감싸는 래퍼.
 * Vercel 정적 배포 환경에서 /api/auth/session이 404를 반환해도
 * 앱 전체가 크래시하지 않도록 에러를 격리합니다.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
    // Vercel 정적 모드: SessionProvider 비활성화
    // NEXT_PUBLIC_API_URL이 비어있으면 정적 스냅샷 모드 (auth 불필요)
    if (!process.env.NEXT_PUBLIC_API_URL) {
        return <>{children}</>;
    }

    return <SessionProvider>{children}</SessionProvider>;
}

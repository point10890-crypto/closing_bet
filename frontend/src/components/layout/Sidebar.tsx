'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

interface NavItem {
    name: string;
    href: string;
    icon: string;
    color: string;
    children?: { name: string; href: string; color: string }[];
}

interface SidebarProps {
    mobile?: boolean;
    isOpen?: boolean;
    onClose?: () => void;
}

const navigation: NavItem[] = [
    {
        name: 'Summary',
        href: '/dashboard',
        icon: 'fa-tachometer-alt',
        color: 'text-purple-400',
    },
    {
        name: 'KR Market',
        href: '/dashboard/kr',
        icon: 'fa-chart-line',
        color: 'text-blue-400',
        children: [
            { name: 'Overview', href: '/dashboard/kr', color: 'bg-blue-500' },
            { name: 'VCP Signals', href: '/dashboard/kr/vcp', color: 'bg-rose-500' },
            { name: '\uc885\uac00\ubca0\ud305', href: '/dashboard/kr/closing-bet', color: 'bg-violet-500' },
        ],
    },
    {
        name: 'US Market',
        href: '/dashboard/us',
        icon: 'fa-globe-americas',
        color: 'text-green-400',
        children: [
            { name: 'Overview', href: '/dashboard/us', color: 'bg-green-500' },
            { name: 'Briefing', href: '/dashboard/us/briefing', color: 'bg-amber-500' },
            { name: 'Top Picks', href: '/dashboard/us/top-picks', color: 'bg-indigo-500' },
            { name: 'Smart Money', href: '/dashboard/us/smart-money', color: 'bg-blue-500' },
            { name: 'Heatmap', href: '/dashboard/us/heatmap', color: 'bg-red-500' },
            { name: 'Prediction', href: '/dashboard/us/prediction', color: 'bg-pink-500' },
            { name: 'Regime', href: '/dashboard/us/regime', color: 'bg-cyan-500' },
            { name: 'Risk', href: '/dashboard/us/risk', color: 'bg-orange-500' },
            { name: 'Sectors', href: '/dashboard/us/sector-rotation', color: 'bg-teal-500' },
            { name: 'Earnings', href: '/dashboard/us/earnings', color: 'bg-yellow-500' },
            { name: 'Calendar', href: '/dashboard/us/calendar', color: 'bg-lime-500' },
            { name: 'Track Record', href: '/dashboard/us/track-record', color: 'bg-violet-500' },
            { name: 'Night Preview', href: '/dashboard/us/preview', color: 'bg-purple-500' },
        ],
    },
    {
        name: 'Crypto',
        href: '/dashboard/crypto',
        icon: 'fa-bitcoin',
        color: 'text-yellow-500',
        children: [
            { name: 'Overview', href: '/dashboard/crypto', color: 'bg-yellow-500' },
            { name: 'Briefing', href: '/dashboard/crypto/briefing', color: 'bg-amber-500' },
            { name: 'VCP Signals', href: '/dashboard/crypto/signals', color: 'bg-orange-500' },
            { name: 'Prediction', href: '/dashboard/crypto/prediction', color: 'bg-red-500' },
            { name: 'Risk', href: '/dashboard/crypto/risk', color: 'bg-rose-500' },
            { name: 'Lead-Lag', href: '/dashboard/crypto/leadlag', color: 'bg-cyan-500' },
            { name: 'Backtest', href: '/dashboard/crypto/backtest', color: 'bg-indigo-500' },
        ],
    },
    {
        name: 'Economy',
        href: '/dashboard/economy',
        icon: 'fa-chart-bar',
        color: 'text-cyan-400',
    },
    {
        name: 'ProPicks',
        href: '/dashboard/stock-analyzer',
        icon: 'fa-crosshairs',
        color: 'text-orange-400',
    },
    {
        name: 'Data Status',
        href: '/dashboard/data-status',
        icon: 'fa-database',
        color: 'text-gray-400',
    },
];

const adminNavigation: NavItem[] = [
    {
        name: 'Admin Dashboard',
        href: '/admin',
        icon: 'fa-shield-alt',
        color: 'text-red-400',
    },
    {
        name: 'Users',
        href: '/admin/users',
        icon: 'fa-users-cog',
        color: 'text-red-400',
    },
    {
        name: 'Subscriptions',
        href: '/admin/subscriptions',
        icon: 'fa-credit-card',
        color: 'text-red-400',
    },
    {
        name: 'System',
        href: '/admin/system',
        icon: 'fa-server',
        color: 'text-red-400',
    },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    // 세션에서 유저 정보 읽기 (없으면 기본값)
    const user = session?.user as Record<string, unknown> | undefined;
    const userName = (user?.name as string) || 'Guest';
    const userTier = (user?.tier as string) || 'free';
    const userRole = (user?.role as string) || 'user';
    const isLoggedIn = !!session?.user;

    return (
        <>
            {/* Brand */}
            <div className="h-16 flex items-center px-4 border-b border-white/5">
                <div className="w-8 h-8 bg-[#2997ff] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20 mr-3">
                    M
                </div>
                <span className="text-white font-bold tracking-tight text-lg">
                    Market<span className="text-[#2997ff]">Flow</span>
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                <div className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Dashboard
                </div>

                {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const hasChildren = item.children && item.children.length > 0;
                    const isExpanded = hasChildren && pathname.startsWith(item.href);

                    return (
                        <div key={item.name}>
                            <Link
                                href={item.href}
                                onClick={!hasChildren ? onNavigate : undefined}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                    ? 'text-white bg-white/5 border border-white/5'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                <i className={`fas ${item.icon} w-5 text-center ${item.color}`}></i>
                                <span>{item.name}</span>
                                {hasChildren && (
                                    <i
                                        className={`fas fa-chevron-down text-xs ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''
                                            }`}
                                    ></i>
                                )}
                            </Link>

                            {/* Submenu */}
                            {hasChildren && isExpanded && (
                                <div className="pl-3 space-y-1 mt-1">
                                    {item.children!.map((child) => (
                                        <Link
                                            key={child.href}
                                            href={child.href}
                                            onClick={onNavigate}
                                            className={`block px-3 py-2 text-xs rounded-md transition-colors ${pathname === child.href
                                                ? 'text-white bg-white/10'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${child.color} mr-2`}></span>
                                            {child.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* User Account Section */}
                {isLoggedIn && (
                    <>
                        <div className="px-3 mt-6 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Account
                        </div>
                        <Link
                            href="/account"
                            onClick={onNavigate}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/account'
                                ? 'text-white bg-white/5 border border-white/5'
                                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            <i className="fas fa-user-circle w-5 text-center text-blue-400"></i>
                            <span>My Account</span>
                        </Link>
                        {userTier === 'free' && (
                            <Link
                                href="/pricing"
                                onClick={onNavigate}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-yellow-400 hover:text-white hover:bg-yellow-500/10 border border-transparent transition-all"
                            >
                                <i className="fas fa-crown w-5 text-center"></i>
                                <span>Upgrade to Pro</span>
                            </Link>
                        )}
                    </>
                )}

                {/* Admin Section */}
                {userRole === 'admin' && (
                    <>
                        <div className="px-3 mt-6 mb-2 text-xs font-semibold text-red-500 uppercase tracking-wider">
                            Admin
                        </div>
                        {adminNavigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={onNavigate}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? 'text-white bg-red-500/10 border border-red-500/20'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    <i className={`fas ${item.icon} w-5 text-center ${item.color}`}></i>
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </>
                )}
            </nav>

            {/* Profile */}
            <div className="p-4 border-t border-white/5">
                {isLoggedIn ? (
                    <div className="flex items-center gap-3 p-2 rounded-lg">
                        <div className={`w-8 h-8 rounded-full ring-2 ring-white/10 flex items-center justify-center text-white text-xs font-bold ${userTier === 'pro' || userTier === 'premium' ? 'bg-gradient-to-tr from-indigo-500 to-purple-500' : 'bg-gradient-to-tr from-gray-600 to-gray-500'}`}>
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs font-bold text-white truncate">{userName}</span>
                            <span className={`text-[10px] ${userTier === 'pro' || userTier === 'premium' ? 'text-purple-400' : 'text-gray-500'}`}>
                                {userTier === 'pro' ? 'Pro Plan' : userTier === 'premium' ? 'Premium' : 'Free Plan'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {userTier !== 'free' && (
                                <span className="text-[10px] px-2 py-1 rounded bg-purple-500/10 text-purple-400 font-bold">
                                    {userTier === 'pro' ? 'Pro' : 'Premium'}
                                </span>
                            )}
                            <button
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Sign Out"
                            >
                                <i className="fas fa-sign-out-alt"></i>
                            </button>
                        </div>
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                            <i className="fas fa-sign-in-alt text-gray-400 text-xs"></i>
                        </div>
                        <span className="text-sm text-gray-400">Sign In</span>
                    </Link>
                )}
            </div>
        </>
    );
}

export default function Sidebar({ mobile = false, isOpen = false, onClose }: SidebarProps) {
    // Lock body scroll when mobile sidebar is open
    useEffect(() => {
        if (mobile && isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [mobile, isOpen]);

    // Desktop sidebar
    if (!mobile) {
        return (
            <aside className="w-64 apple-glass flex flex-col shrink-0 z-50">
                <SidebarContent />
            </aside>
        );
    }

    // Mobile overlay sidebar
    return (
        <div
            className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Sidebar panel */}
            <aside
                className={`absolute top-0 left-0 h-full w-72 apple-glass flex flex-col shadow-2xl shadow-black/50 transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10"
                >
                    <i className="fas fa-times text-sm"></i>
                </button>
                <SidebarContent onNavigate={onClose} />
            </aside>
        </div>
    );
}

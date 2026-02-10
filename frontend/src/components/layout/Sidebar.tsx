'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

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
            { name: '종가베팅', href: '/dashboard/kr/closing-bet', color: 'bg-violet-500' },
        ],
    },
    {
        name: 'US Market',
        href: '/dashboard/us',
        icon: 'fa-globe-americas',
        color: 'text-green-400',
        children: [
            { name: 'Overview', href: '/dashboard/us', color: 'bg-green-500' },
            { name: 'Night Preview', href: '/dashboard/us/preview', color: 'bg-purple-500' },
            { name: 'US Heatmap', href: '/dashboard/us/heatmap', color: 'bg-red-500' },
        ],
    },
    {
        name: 'Crypto',
        href: '/dashboard/crypto',
        icon: 'fa-bitcoin',
        color: 'text-yellow-500',
    },
    {
        name: 'Economy',
        href: '/dashboard/economy',
        icon: 'fa-chart-bar',
        color: 'text-cyan-400',
    },
    {
        name: 'Data Status',
        href: '/dashboard/data-status',
        icon: 'fa-database',
        color: 'text-gray-400',
    },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();

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
            </nav>

            {/* Profile */}
            <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 ring-2 ring-white/10"></div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">Pro User</span>
                        <span className="text-[10px] text-gray-500">Premium Plan</span>
                    </div>
                    <i className="fas fa-cog ml-auto text-gray-500 hover:text-white transition-colors"></i>
                </div>
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

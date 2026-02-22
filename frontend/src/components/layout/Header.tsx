'use client';

import { useState, useEffect } from 'react';
import CommandPalette from './CommandPalette';

interface HeaderProps {
    title: string;
    onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
    const [paletteOpen, setPaletteOpen] = useState(false);

    // ⌘K / Ctrl+K 단축키
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setPaletteOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    return (
        <>
            <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/10 md:border-white/5 bg-[#111113] md:bg-[#09090b]/80 backdrop-blur-md shrink-0 z-40">
                {/* Left: Hamburger (mobile) + Breadcrumbs */}
                <div className="flex items-center gap-3">
                    {/* Hamburger - mobile only */}
                    <button
                        onClick={onMenuClick}
                        className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors active:scale-95"
                    >
                        <i className="fas fa-bars text-base"></i>
                    </button>

                    {/* Brand - mobile only */}
                    <div className="md:hidden flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#2997ff] rounded-md flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-500/20">
                            M
                        </div>
                        <span className="text-white font-bold text-sm tracking-tight">
                            Market<span className="text-[#2997ff]">Flow</span>
                        </span>
                    </div>

                    {/* Breadcrumbs - desktop only */}
                    <div className="hidden md:flex items-center gap-2">
                        <span className="text-gray-500">
                            <i className="fas fa-home"></i>
                        </span>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-200 font-medium">{title}</span>
                    </div>
                </div>

                {/* Search - desktop only → 클릭 시 CommandPalette 열기 */}
                <div className="hidden md:block max-w-md w-full mx-4">
                    <button
                        onClick={() => setPaletteOpen(true)}
                        className="relative group w-full"
                    >
                        <i className="fas fa-search absolute left-3 top-2.5 text-gray-500"></i>
                        <div className="block w-full pl-10 pr-12 py-2 bg-[#18181b] border border-white/10 rounded-full text-xs text-gray-500 text-left cursor-pointer hover:border-white/20 transition-all">
                            Search markets, tickers, or commands...
                        </div>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-white/5 rounded border border-gray-600">
                                ⌘K
                            </kbd>
                        </div>
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Search - mobile only */}
                    <button
                        onClick={() => setPaletteOpen(true)}
                        className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                    >
                        <i className="fas fa-search text-sm"></i>
                    </button>
                    <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative active:scale-95">
                        <i className="far fa-bell text-sm"></i>
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-black"></span>
                    </button>
                </div>
            </header>

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </>
    );
}

import Link from 'next/link';

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/5 text-xs text-purple-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
                    Portfolio Summary
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-2">
                    Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Dashboard</span>
                </h2>
                <p className="text-gray-400 text-lg">AI-Powered Market Analysis</p>
            </div>

            {/* Quick Access Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dashboard/kr" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-blue-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <i className="fas fa-chart-line text-blue-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">KR Market</h3>
                            <p className="text-xs text-gray-500">VCP & Institutional Flow</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Today&apos;s Signals</span>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-bold">Live</span>
                    </div>
                </Link>

                <Link href="/dashboard/us" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-green-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <i className="fas fa-globe-americas text-green-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-green-400 transition-colors">US Market</h3>
                            <p className="text-xs text-gray-500">Indices & Sectors</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Market Gate</span>
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full font-bold">Live</span>
                    </div>
                </Link>

                <Link href="/dashboard/crypto" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-yellow-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                            <i className="fab fa-bitcoin text-yellow-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">Crypto</h3>
                            <p className="text-xs text-gray-500">Top Coins & Sentiment</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">BTC Dominance</span>
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-bold">BTC</span>
                    </div>
                </Link>

                <Link href="/dashboard/economy" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                            <i className="fas fa-chart-bar text-cyan-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">Economy</h3>
                            <p className="text-xs text-gray-500">Yield Curve & VIX</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Fear & Greed</span>
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full font-bold">Macro</span>
                    </div>
                </Link>

                <Link href="/dashboard/kr/chatbot" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-purple-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <i className="fas fa-robot text-purple-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">AI Chatbot</h3>
                            <p className="text-xs text-gray-500">Smart Money Bot</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Ask Anything</span>
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full font-bold">Gemini</span>
                    </div>
                </Link>

                <Link href="/dashboard/data-status" className="group p-6 rounded-2xl bg-[#1c1c1e] border border-white/10 hover:border-gray-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center">
                            <i className="fas fa-database text-gray-400 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-gray-300 transition-colors">System</h3>
                            <p className="text-xs text-gray-500">Data Health</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">File Integrity</span>
                        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded-full font-bold">Check</span>
                    </div>
                </Link>
            </div>
        </div>
    );
}

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/5 text-sm text-blue-400 font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          AI-Powered Stock Analysis
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white leading-tight mb-6">
          Market<span className="text-[#2997ff]">Flow</span>
        </h1>

        <p className="text-xl text-gray-400 mb-12 leading-relaxed">
          VCP 패턴 & 기관/외국인 수급 추적<br />
          AI 기반 한국, 미국, 암호화폐 시장 분석
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-3 px-8 py-4 bg-[#2997ff] hover:bg-[#2997ff]/90 text-white text-lg font-bold rounded-2xl transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25"
        >
          <i className="fas fa-rocket"></i>
          Enter Dashboard
        </Link>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-5xl mx-auto">
        <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
            <i className="fas fa-chart-line text-rose-400 text-xl"></i>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">KR Market</h3>
          <p className="text-gray-500 text-sm">VCP 패턴 스캐너 & 기관/외국인 수급 분석</p>
        </div>

        <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
            <i className="fas fa-globe-americas text-green-400 text-xl"></i>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">US Market</h3>
          <p className="text-gray-500 text-sm">Smart Money 추적 & AI 매크로 분석</p>
        </div>

        <div className="p-6 rounded-2xl bg-[#1c1c1e] border border-white/10">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-4">
            <i className="fab fa-bitcoin text-yellow-400 text-xl"></i>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Crypto</h3>
          <p className="text-gray-500 text-sm">VCP 스캐너 & Lead-Lag 분석</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-20 text-center text-gray-600 text-sm">
        <p>Powered by Next.js + Flask API</p>
      </div>
    </div>
  );
}

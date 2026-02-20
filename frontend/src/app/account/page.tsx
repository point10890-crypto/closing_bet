'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function AccountPage() {
    const { data: session } = useSession();
    const user = session?.user as Record<string, unknown> | undefined;

    const name = (user?.name as string) || 'User';
    const email = (user?.email as string) || '';
    const tier = (user?.tier as string) || 'free';
    const role = (user?.role as string) || 'user';

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-white">My Account</h1>

            {/* Profile Card */}
            <div className="apple-glass rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${tier === 'pro' ? 'bg-gradient-to-tr from-indigo-500 to-purple-500' : 'bg-gradient-to-tr from-gray-600 to-gray-500'}`}>
                        {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="text-xl font-bold text-white">{name}</div>
                        <div className="text-sm text-gray-400">{email}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${tier === 'pro' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                            </span>
                            {role === 'admin' && (
                                <span className="text-xs px-2 py-0.5 rounded font-semibold bg-red-500/20 text-red-400">
                                    Admin
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Subscription */}
            <div className="apple-glass rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Subscription</h2>
                {tier === 'pro' ? (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <i className="fas fa-crown text-yellow-400"></i>
                            <span className="text-white font-medium">MarketFlow Pro Active</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Full access to Prediction, Risk Analysis, Lead-Lag, Backtest, and Signal Analysis.
                        </p>
                        <Link
                            href="/pricing"
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Manage Subscription &rarr;
                        </Link>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-gray-400 mb-4">
                            Upgrade to Pro for access to advanced analytics: AI Prediction, Risk Assessment, Lead-Lag Analysis, and more.
                        </p>
                        <Link
                            href="/account/upgrade"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2997ff] text-white rounded-lg font-medium text-sm hover:bg-[#2997ff]/80 transition-colors"
                        >
                            <i className="fas fa-rocket"></i>
                            Upgrade to Pro
                        </Link>
                    </div>
                )}
            </div>

            {/* Features by Tier */}
            <div className="apple-glass rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Feature Access</h2>
                <div className="space-y-3">
                    {[
                        { name: 'Market Overview', free: true, pro: true },
                        { name: 'VCP Signals', free: true, pro: true },
                        { name: 'Market Gate', free: true, pro: true },
                        { name: 'Crypto Briefing', free: true, pro: true },
                        { name: 'AI Prediction', free: false, pro: true },
                        { name: 'Risk Analysis', free: false, pro: true },
                        { name: 'Lead-Lag Analysis', free: false, pro: true },
                        { name: 'Backtest Results', free: false, pro: true },
                        { name: 'Signal Analysis', free: false, pro: true },
                    ].map((feature) => {
                        const hasAccess = tier === 'pro' ? feature.pro : feature.free;
                        return (
                            <div key={feature.name} className="flex items-center justify-between">
                                <span className={`text-sm ${hasAccess ? 'text-white' : 'text-gray-600'}`}>
                                    {feature.name}
                                </span>
                                {hasAccess ? (
                                    <i className="fas fa-check text-green-400 text-sm"></i>
                                ) : (
                                    <i className="fas fa-lock text-gray-600 text-sm"></i>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

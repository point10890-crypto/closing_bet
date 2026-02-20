'use client';

import { useEffect, useState } from 'react';
import { adminAPI, SubscriptionRequest } from '@/lib/api';

export default function AdminSubscriptionsPage() {
    const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadRequests(); }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.getSubscriptions();
            setRequests(res.requests || []);
        } catch (err) {
            console.error('Failed to load subscriptions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await adminAPI.approveSubscription(id);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
        } catch (err) {
            console.error('Failed to approve:', err);
        }
    };

    const handleReject = async (id: number) => {
        const note = prompt('Rejection reason (optional):');
        try {
            await adminAPI.rejectSubscription(id, note || undefined);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', admin_note: note } : r));
        } catch (err) {
            console.error('Failed to reject:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
            </div>
        );
    }

    const pending = requests.filter(r => r.status === 'pending');
    const processed = requests.filter(r => r.status !== 'pending');

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Subscription Management</h1>

            {/* Pending Requests */}
            <div>
                <h2 className="text-lg font-semibold text-yellow-400 mb-3">
                    <i className="fas fa-clock mr-2"></i>
                    Pending Requests ({pending.length})
                </h2>
                {pending.length === 0 ? (
                    <div className="apple-glass rounded-xl p-8 text-center text-gray-500">
                        <i className="fas fa-check-circle text-3xl mb-3 text-green-500/50"></i>
                        <div>No pending subscription requests</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pending.map((req) => (
                            <div key={req.id} className="apple-glass rounded-xl p-4 border border-yellow-500/20">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
                                            <i className="fas fa-arrow-up text-yellow-400"></i>
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{req.user_name || `User #${req.user_id}`}</div>
                                            <div className="text-xs text-gray-400">{req.user_email || ''}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {req.from_tier} &rarr; {req.to_tier} &bull; {new Date(req.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(req.id)}
                                            className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors"
                                        >
                                            <i className="fas fa-check mr-1"></i> Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(req.id)}
                                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
                                        >
                                            <i className="fas fa-times mr-1"></i> Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Processed Requests */}
            {processed.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-400 mb-3">
                        <i className="fas fa-history mr-2"></i>
                        History ({processed.length})
                    </h2>
                    <div className="apple-glass rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">User</th>
                                    <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Change</th>
                                    <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Status</th>
                                    <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Date</th>
                                    <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processed.map((req) => (
                                    <tr key={req.id} className="border-b border-white/5">
                                        <td className="px-4 py-3 text-sm text-white">{req.user_name || `#${req.user_id}`}</td>
                                        <td className="px-4 py-3 text-xs text-gray-400">{req.from_tier} &rarr; {req.to_tier}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded ${req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {req.processed_at ? new Date(req.processed_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{req.admin_note || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

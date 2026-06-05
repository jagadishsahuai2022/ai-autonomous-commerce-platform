'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Brain, ArrowLeft, Loader2, BarChart3, Activity, Target, Clock,
    TrendingUp, TrendingDown, Minus, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentUserRole } from '@/lib/admin-auth';

interface EventStats {
    total_events: string;
    events_with_clicks: string;
    events_with_purchases: string;
    bounced_events: string;
    avg_response_time: string;
    avg_results_per_query: string;
}

interface DimensionEffectivenessRow {
    dimensionKey: string;
    clickCorrelation: number;
    purchaseCorrelation: number;
    predictivePower: number;
    currentWeight: number;
    suggestedWeight: number;
    sampleCount: number;
}

interface AuditRow {
    snapshotId: string;
    changedBy: number;
    changeSource: string;
    changeReason: string;
    createdAt: string;
}

interface DailyTrend {
    day: string;
    events: string;
    clicks: string;
    purchases: string;
}

export default function LearningInsightsPage() {
    const [role, setRole] = useState('');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        eventStats: EventStats;
        effectiveness: DimensionEffectivenessRow[];
        recentAudits: AuditRow[];
        latestJob: Record<string, any> | null;
        dailyTrends: DailyTrend[];
    } | null>(null);

    useEffect(() => {
        setRole(getCurrentUserRole());
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1]?.trim()
                || localStorage.getItem('authToken') || '';
            const res = await fetch('/api/admin/learning-insights', {
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch { /* ignore */ }
        setLoading(false);
    };

    if (role !== 'admin') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
                <div className="text-center">
                    <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
                    <p className="text-slate-500 mb-6">Only administrators can view learning insights.</p>
                    <Link href="/" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">Go Home</Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const stats = data?.eventStats;
    const totalEvents = parseInt(stats?.total_events || '0');
    const clickRate = totalEvents > 0 ? (parseInt(stats?.events_with_clicks || '0') / totalEvents * 100).toFixed(1) : '0';
    const purchaseRate = totalEvents > 0 ? (parseInt(stats?.events_with_purchases || '0') / totalEvents * 100).toFixed(1) : '0';
    const bounceRate = totalEvents > 0 ? (parseInt(stats?.bounced_events || '0') / totalEvents * 100).toFixed(1) : '0';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin" className="p-2 hover:bg-white/60 rounded-xl transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                <Brain className="w-5 h-5 text-white" />
                            </div>
                            Learning Insights
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Ranking engine performance, dimension effectiveness, and audit trail</p>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Ranking Events (30d)', value: totalEvents.toLocaleString(), icon: BarChart3, color: 'from-blue-500 to-blue-600' },
                        { label: 'Click Rate', value: `${clickRate}%`, icon: Target, color: 'from-green-500 to-emerald-600' },
                        { label: 'Purchase Rate', value: `${purchaseRate}%`, icon: Activity, color: 'from-purple-500 to-violet-600' },
                        { label: 'Avg Response', value: `${Math.round(parseFloat(stats?.avg_response_time || '0'))}ms`, icon: Clock, color: 'from-amber-500 to-orange-600' },
                    ].map((kpi, i) => (
                        <motion.div
                            key={kpi.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center`}>
                                    <kpi.icon className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">{kpi.label}</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Dimension Effectiveness Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-8">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" /> Dimension Effectiveness
                    </h2>
                    {data?.effectiveness && data.effectiveness.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase border-b">
                                        <th className="py-2 text-left">Dimension</th>
                                        <th className="py-2 text-right">Click Corr.</th>
                                        <th className="py-2 text-right">Purchase Corr.</th>
                                        <th className="py-2 text-right">Predictive Power</th>
                                        <th className="py-2 text-right">Current Wt</th>
                                        <th className="py-2 text-right">Suggested Wt</th>
                                        <th className="py-2 text-right">Samples</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.effectiveness.map(row => (
                                        <tr key={row.dimensionKey} className="border-b border-slate-100">
                                            <td className="py-2 font-medium text-slate-700">{row.dimensionKey.replace(/_/g, ' ')}</td>
                                            <td className="py-2 text-right font-mono">{(row.clickCorrelation * 100).toFixed(1)}%</td>
                                            <td className="py-2 text-right font-mono">{(row.purchaseCorrelation * 100).toFixed(1)}%</td>
                                            <td className="py-2 text-right">
                                                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${row.predictivePower > 0.7 ? 'bg-green-100 text-green-700' : row.predictivePower > 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {(row.predictivePower * 100).toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="py-2 text-right font-mono">{(row.currentWeight * 100).toFixed(1)}%</td>
                                            <td className="py-2 text-right font-mono">{(row.suggestedWeight * 100).toFixed(1)}%</td>
                                            <td className="py-2 text-right text-slate-400">{row.sampleCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No effectiveness data yet. Ranking events need to accumulate first.</p>
                        </div>
                    )}
                </div>

                {/* Recent Audit Trail */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-8">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" /> Recent Weight Changes
                    </h2>
                    {data?.recentAudits && data.recentAudits.length > 0 ? (
                        <div className="space-y-2">
                            {data.recentAudits.map(audit => (
                                <div key={audit.snapshotId} className="flex items-center gap-3 text-sm py-2 border-b border-slate-50">
                                    <div className={`w-2 h-2 rounded-full ${audit.changeSource === 'ml_optimization' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                                    <span className="text-slate-400 text-xs">{new Date(audit.createdAt).toLocaleDateString()}</span>
                                    <span className="text-slate-600">{audit.changeReason}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${audit.changeSource === 'ml_optimization' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {audit.changeSource}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-4">No weight changes recorded yet</p>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex gap-3">
                    <Link href="/admin/scoring-dimensions" className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                        Manage Dimensions
                    </Link>
                    <Link href="/admin/learning" className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                        Product Learning
                    </Link>
                </div>
            </div>
        </div>
    );
}

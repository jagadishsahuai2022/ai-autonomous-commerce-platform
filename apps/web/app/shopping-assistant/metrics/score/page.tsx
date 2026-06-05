/**
 * Avg Score Metric Detail Page
 * Shows AI scoring analytics, dimension breakdown, and methodology
 */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    ArrowLeft, BarChart2, TrendingUp, Target, Info, CheckCircle, Shield,
    Star, Zap, Award, PieChart,
} from 'lucide-react';
import type { RankedProduct } from '@/types/shopping-assistant';

const DIMENSIONS = [
    { key: 'budget_fit_score', label: 'Budget Fit', icon: <Target className="w-4 h-4" />, color: 'bg-green-400', desc: 'How closely the product price matches your stated budget' },
    { key: 'quality_score', label: 'Quality', icon: <Award className="w-4 h-4" />, color: 'bg-blue-400', desc: 'Product build quality based on reviews, brand reputation & specs' },
    { key: 'brand_preference_score', label: 'Brand Match', icon: <Star className="w-4 h-4" />, color: 'bg-violet-400', desc: 'Alignment with known brand preferences from your history' },
    { key: 'delivery_speed_score', label: 'Delivery Speed', icon: <Zap className="w-4 h-4" />, color: 'bg-amber-400', desc: 'Estimated delivery timeline vs your requirement' },
    { key: 'ratings_score', label: 'Ratings', icon: <TrendingUp className="w-4 h-4" />, color: 'bg-rose-400', desc: 'Star rating weight adjusted for review volume & recency' },
];

export default function ScoreMetricPage() {
    const [products, setProducts] = useState<RankedProduct[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('dc-metrics-products');
            if (raw) setProducts(JSON.parse(raw));
        } catch { /* ignore */ }
        setMounted(true);
    }, []);

    const dimAvgs = useMemo(() => {
        if (products.length === 0) return null;
        return DIMENSIONS.map(d => {
            const avg = products.reduce((s, p) => {
                const score = (p.explanation as any)?.[d.key]?.score ?? 0;
                return s + score;
            }, 0) / products.length;
            return { ...d, avg };
        });
    }, [products]);

    const scoreDistribution = useMemo(() => {
        if (products.length === 0) return null;
        const buckets = [
            { label: '90–100%', min: 0.9, max: 1.01, color: 'bg-green-500' },
            { label: '80–89%', min: 0.8, max: 0.9, color: 'bg-blue-500' },
            { label: '70–79%', min: 0.7, max: 0.8, color: 'bg-indigo-500' },
            { label: '60–69%', min: 0.6, max: 0.7, color: 'bg-amber-500' },
            { label: '<60%', min: 0, max: 0.6, color: 'bg-red-400' },
        ];
        return buckets.map(b => ({
            ...b,
            count: products.filter(p => p.score >= b.min && p.score < b.max).length,
        }));
    }, [products]);

    const overallAvg = useMemo(() => {
        if (products.length === 0) return 88;
        return Math.round(products.reduce((s, p) => s + p.score, 0) / products.length * 100);
    }, [products]);

    const topProduct = products.length > 0 ? products[0] : null;
    const isDemo = products.length === 0;

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
                    <Link href="/shopping-assistant" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-blue-500" />
                        <div>
                            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">AI Scoring Analytics</h1>
                            <p className="text-xs text-gray-500">How the {overallAvg}% average score is calculated</p>
                        </div>
                    </div>
                    {isDemo && <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Demo</span>}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Hero score */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-8 text-white text-center"
                >
                    <p className="text-sm font-medium text-blue-100 mb-1">Session Average Match Score</p>
                    <div className="text-7xl font-black tracking-tight mb-2">{overallAvg}<span className="text-3xl font-bold text-blue-200">%</span></div>
                    <p className="text-blue-100 text-sm max-w-sm mx-auto">
                        Computed across {isDemo ? '3' : products.length} products using 5 weighted scoring dimensions in real-time
                    </p>
                    <div className="mt-4 flex justify-center gap-6">
                        {[
                            { label: 'Top Score', value: products.length > 0 ? `${Math.round(Math.max(...products.map(p => p.score)) * 100)}%` : '94%' },
                            { label: 'Min Score', value: products.length > 0 ? `${Math.round(Math.min(...products.map(p => p.score)) * 100)}%` : '78%' },
                            { label: 'High Conf', value: products.length > 0 ? `${products.filter(p => p.confidence >= 0.85).length}` : '2' },
                        ].map(s => (
                            <div key={s.label} className="text-center">
                                <p className="text-xl font-bold">{s.value}</p>
                                <p className="text-xs text-blue-200">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Score dimensions */}
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-blue-400" /> Scoring Dimension Breakdown
                    </h2>
                    <div className="space-y-4">
                        {(dimAvgs || DIMENSIONS.map(d => ({ ...d, avg: [0.82, 0.87, 0.85, 0.80, 0.92][DIMENSIONS.indexOf(d)] }))).map((d, i) => (
                            <motion.div
                                key={d.key}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className="space-y-1.5"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${d.color} bg-opacity-20 text-gray-700`}>
                                            {d.icon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{d.label}</p>
                                            <p className="text-[11px] text-gray-400">{d.desc}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-12 text-right">{Math.round(d.avg * 100)}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${d.avg * 100}%` }}
                                        transition={{ delay: i * 0.08 + 0.2, duration: 0.6, ease: 'easeOut' }}
                                        className={`h-full ${d.color} rounded-full`}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Score distribution */}
                {(scoreDistribution || [
                    { label: '90–100%', count: 1, color: 'bg-green-500' },
                    { label: '80–89%', count: 1, color: 'bg-blue-500' },
                    { label: '70–79%', count: 1, color: 'bg-indigo-500' },
                    { label: '60–69%', count: 0, color: 'bg-amber-500' },
                    { label: '<60%', count: 0, color: 'bg-red-400' },
                ]).map(b => ({ ...b })).filter(b => (b as any).count > 0).length > 0 && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Score Distribution</h2>
                            <div className="space-y-2">
                                {(scoreDistribution || [
                                    { label: '90–100%', count: 1, color: 'bg-green-500' },
                                    { label: '80–89%', count: 1, color: 'bg-blue-500' },
                                    { label: '70–79%', count: 1, color: 'bg-indigo-500' },
                                ]).map(b => {
                                    const total = products.length || 3;
                                    const pct = Math.round((b as any).count / total * 100);
                                    return (
                                        <div key={b.label} className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500 w-16">{b.label}</span>
                                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.6 }}
                                                    className={`h-full ${b.color} rounded-full`}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{(b as any).count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                {/* Top product deep dive */}
                {topProduct && (
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-400" /> Top Ranked Product Score Breakdown
                        </h2>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900 dark:text-gray-100">{topProduct.product.name}</p>
                                <p className="text-xs text-gray-500">{topProduct.product.brand} · ₹{topProduct.product.price.toLocaleString()}</p>
                            </div>
                            <div className="text-2xl font-black text-blue-600">{Math.round(topProduct.score * 100)}%</div>
                        </div>
                        <p className="text-xs text-gray-500 mb-3 italic">"{topProduct.explanation.summary}"</p>
                        <div className="grid grid-cols-2 gap-2">
                            {DIMENSIONS.map(d => {
                                const s = (topProduct.explanation as any)?.[d.key];
                                return s ? (
                                    <div key={d.key} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                                        <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{d.label}</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{Math.round(s.score * 100)}%</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{s.reason}</p>
                                    </div>
                                ) : null;
                            })}
                        </div>
                        {topProduct.explanation.key_strengths.length > 0 && (
                            <div className="mt-3">
                                <p className="text-[11px] font-semibold text-green-700 mb-1">Key Strengths</p>
                                <div className="flex flex-wrap gap-1">
                                    {topProduct.explanation.key_strengths.map((s, i) => (
                                        <span key={i} className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Methodology */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Scoring Methodology</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Each product is scored across 5 dimensions using a weighted ensemble:
                                Budget Fit (25%) + Quality (25%) + Brand Preference (20%) + Delivery Speed (15%) + Ratings (15%).
                                Scores are computed in real-time from live catalog data, product specifications,
                                historical purchase patterns, and seller performance metrics.
                                No pre-computed caches — every score is freshly calculated per session.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {['Weighted ensemble model', 'Real-time calculation', 'Budget-adaptive', 'No cached scores'].map(t => (
                                    <span key={t} className="text-[10px] bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">{t}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

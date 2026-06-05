'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Sliders, Save, RotateCcw, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Info,
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentUserRole } from '@/lib/admin-auth';

interface WeightParam {
    parameterName: string;
    displayName: string;
    defaultWeight: number;
    currentWeight: number;
    description: string;
    sortOrder: number;
    isActive: boolean;
}

const PARAM_COLORS: Record<string, string> = {
    productName: 'from-blue-500 to-indigo-600',
    budget: 'from-green-500 to-emerald-600',
    brand: 'from-violet-500 to-purple-600',
    tags: 'from-amber-500 to-orange-500',
    attributes: 'from-pink-500 to-rose-500',
    quantity: 'from-cyan-500 to-blue-500',
    deliveryDays: 'from-teal-500 to-cyan-600',
    paymentMethod: 'from-slate-500 to-slate-600',
    emiOnly: 'from-orange-500 to-red-500',
    category: 'from-lime-500 to-green-600',
    subCategory: 'from-fuchsia-500 to-pink-600',
};

export default function SearchWeightsPage() {
    const [role, setRole] = useState('');
    const [weights, setWeights] = useState<WeightParam[]>([]);
    const [threshold, setThreshold] = useState(80);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    useEffect(() => { setRole(getCurrentUserRole()); }, []);

    const fetchWeights = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/search-weights');
            const data = await res.json();
            if (data.weights) {
                setWeights(data.weights.map((w: WeightParam) => ({
                    ...w,
                    currentWeight: Number(w.currentWeight),
                    defaultWeight: Number(w.defaultWeight),
                })));
            }
            if (data.threshold !== undefined) setThreshold(Number(data.threshold));
        } catch {
            showToast('error', 'Failed to load weights');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchWeights(); }, [fetchWeights]);

    function showToast(type: 'success' | 'error', msg: string) {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    }

    const totalWeight = weights.reduce((s, w) => s + w.currentWeight, 0);
    const isValid = Math.abs(totalWeight - 100) < 0.5;

    function handleWeightChange(paramName: string, val: number) {
        setWeights(prev => prev.map(w => w.parameterName === paramName
            ? { ...w, currentWeight: Math.max(0, Math.min(100, val)) }
            : w
        ));
    }

    function handleReset() {
        setWeights(prev => prev.map(w => ({ ...w, currentWeight: w.defaultWeight })));
        setThreshold(80);
    }

    async function handleSave() {
        if (!isValid) {
            showToast('error', `Weights must sum to 100 (currently ${totalWeight.toFixed(1)})`);
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/search-weights', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    weights: weights.map(w => ({ parameterName: w.parameterName, currentWeight: w.currentWeight })),
                    threshold,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast('success', 'Search weights saved successfully!');
            } else {
                showToast('error', data.error || 'Save failed');
            }
        } catch {
            showToast('error', 'Network error');
        } finally {
            setSaving(false);
        }
    }

    const isAdmin = role === 'admin';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-4 sm:p-6">
            {/* Header */}
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/admin" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Smart Intent Engine Weights</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Configure how 11 parameters are weighted during product scoring</p>
                        </div>
                    </div>
                </div>

                {!isAdmin && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-700">You have read-only access. Admin role required to save changes.</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-2" />
                        <span className="text-slate-500">Loading weights...</span>
                    </div>
                ) : (
                    <>
                        {/* Total indicator */}
                        <div className={`mb-5 p-4 rounded-xl border flex items-center justify-between ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2">
                                {isValid ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className={`text-sm font-medium ${isValid ? 'text-green-700' : 'text-red-600'}`}>
                                    Total weight: <strong>{totalWeight.toFixed(1)}%</strong>
                                    {!isValid && <span className="ml-2 font-normal">(must equal 100%)</span>}
                                </span>
                            </div>
                            {/* Visual bar */}
                            <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${isValid ? 'bg-green-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min(totalWeight, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Weight sliders */}
                        <div className="space-y-3 mb-6">
                            {weights.map((w, i) => (
                                <motion.div
                                    key={w.parameterName}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${PARAM_COLORS[w.parameterName] || 'from-slate-400 to-slate-500'}`} />
                                            <div>
                                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{w.displayName}</span>
                                                <span className="ml-2 text-[10px] text-slate-400 font-mono">({w.parameterName})</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-400">default: {w.defaultWeight}%</span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step={0.5}
                                                    value={w.currentWeight}
                                                    onChange={e => handleWeightChange(w.parameterName, parseFloat(e.target.value) || 0)}
                                                    disabled={!isAdmin}
                                                    className="w-16 text-center px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-700 disabled:opacity-50"
                                                />
                                                <span className="text-sm text-slate-500">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={60}
                                        step={0.5}
                                        value={w.currentWeight}
                                        onChange={e => handleWeightChange(w.parameterName, parseFloat(e.target.value))}
                                        disabled={!isAdmin}
                                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                        <Info className="w-3 h-3 flex-shrink-0" /> {w.description}
                                    </p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Pass Threshold */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-slate-500 to-slate-700" />
                                Minimum Pass Threshold
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                Products scoring below this threshold (0–100) are excluded from search results. Higher = stricter filtering.
                            </p>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={0}
                                    max={90}
                                    step={5}
                                    value={threshold}
                                    onChange={e => setThreshold(Number(e.target.value))}
                                    disabled={!isAdmin}
                                    className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={threshold}
                                        onChange={e => setThreshold(Number(e.target.value))}
                                        disabled={!isAdmin}
                                        className="w-16 text-center px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-700 disabled:opacity-50"
                                    />
                                    <span className="text-sm text-slate-500">/ 100</span>
                                </div>
                            </div>
                        </div>

                        {/* Weight reallocation info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 p-4 mb-6">
                            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>
                                    <strong>Automatic weight reallocation (4:1 ratio):</strong> Only <em>Product Name</em> and <em>Stock Availability</em> are mandatory. When a user omits an optional parameter (e.g. no brand, no budget, no category), its weight is redistributed in a 4:1 ratio —
                                    80% (4 parts) goes to <em>Product Name Match</em> and 20% (1 part) to <em>Stock Availability</em>. Auto-checkout requires 100% score across all 11 parameters; results above the pass threshold are shown in <em>Smart Delegate</em> for manual review.
                                </span>
                            </p>
                        </div>

                        {/* Action buttons */}
                        {isAdmin && (
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" /> Reset Defaults
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || !isValid}
                                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {saving ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save className="w-4 h-4" /> Save Weights</>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Toast */}
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium z-50 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                            }`}
                    >
                        {toast.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <AlertCircle className="w-4 h-4" />
                        )}
                        {toast.msg}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

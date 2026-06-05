'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scale, Save, RotateCcw, Plus, Trash2, AlertCircle, CheckCircle2,
    ArrowLeft, Sliders, Info, Loader2, GripVertical, Sparkles, XCircle
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentUserRole } from '@/lib/admin-auth';
import { useScoringDimensionStore, ScoringDimension } from '@/lib/store/scoring-dimensions.store';

interface OptimizationJob {
    jobId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progressPercent: number;
    currentPhase: string;
    optimizedWeights?: Record<string, number>;
    weightChanges?: Record<string, { before: number; after: number; delta: number }>;
    performanceMetrics?: Record<string, number>;
    applied?: boolean;
    errorMessage?: string;
}

const GROUP_LABELS: Record<string, string> = {
    all: 'All Dimensions',
    intent: 'Intent Matching',
    quality: 'Quality Signals',
    engagement: 'Engagement',
    personal: 'Personalization',
    business: 'Business',
};

const GROUP_COLORS: Record<string, string> = {
    intent: 'bg-blue-500',
    quality: 'bg-emerald-500',
    engagement: 'bg-violet-500',
    personal: 'bg-amber-500',
    business: 'bg-rose-500',
};

export default function ScoringDimensionsPage() {
    const [role, setRole] = useState('');
    const {
        dimensions, loading, fetchDimensions, updateDimensions,
    } = useScoringDimensionStore();

    const [localDimensions, setLocalDimensions] = useState<ScoringDimension[]>([]);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDim, setNewDim] = useState({ key: '', label: '', weightage: 0.1, description: '' });
    const [activeGroup, setActiveGroup] = useState<string>('all');
    const [optimizeJob, setOptimizeJob] = useState<OptimizationJob | null>(null);
    const [optimizing, setOptimizing] = useState(false);
    const pollRef = useRef<NodeJS.Timeout>(undefined);

    useEffect(() => {
        setRole(getCurrentUserRole());
        fetchDimensions();
    }, [fetchDimensions]);

    useEffect(() => {
        if (dimensions.length > 0) {
            setLocalDimensions([...dimensions]);
        }
    }, [dimensions]);

    const totalWeight = localDimensions.reduce((sum, d) => sum + d.weightage, 0);
    const isValid = Math.abs(totalWeight - 1.0) < 0.001;
    const hasChanges = JSON.stringify(localDimensions) !== JSON.stringify(dimensions);

    const handleWeightChange = (key: string, value: number) => {
        setLocalDimensions(prev =>
            prev.map(d => d.key === key ? { ...d, weightage: Math.max(0, Math.min(1, value)) } : d)
        );
    };

    const handleLabelChange = (key: string, label: string) => {
        setLocalDimensions(prev =>
            prev.map(d => d.key === key ? { ...d, label } : d)
        );
    };

    const handleToggleActive = (key: string) => {
        setLocalDimensions(prev =>
            prev.map(d => d.key === key ? { ...d, isActive: !d.isActive } : d)
        );
    };

    const handleRemoveDimension = (key: string) => {
        setLocalDimensions(prev => prev.filter(d => d.key !== key));
    };

    const handleAddDimension = () => {
        if (!newDim.key.trim() || !newDim.label.trim()) return;
        const keySlug = newDim.key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (localDimensions.some(d => d.key === keySlug)) {
            setToast({ type: 'error', msg: 'Dimension key already exists' });
            return;
        }
        setLocalDimensions(prev => [...prev, {
            id: 0,
            key: keySlug,
            label: newDim.label.trim(),
            weightage: newDim.weightage,
            description: newDim.description.trim() || null,
            isActive: true,
            sortOrder: prev.length + 1,
        }]);
        setNewDim({ key: '', label: '', weightage: 0.1, description: '' });
        setShowAddForm(false);
    };

    const handleSave = async () => {
        if (!isValid) {
            setToast({ type: 'error', msg: `Weights must sum to 100%. Currently: ${(totalWeight * 100).toFixed(1)}%` });
            return;
        }
        setSaving(true);
        try {
            await updateDimensions(localDimensions);
            setToast({ type: 'success', msg: 'Scoring dimensions updated successfully' });
        } catch (err: any) {
            setToast({ type: 'error', msg: err?.message || 'Failed to save' });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setLocalDimensions([...dimensions]);
    };

    const handleEqualizeWeights = () => {
        const activeDims = localDimensions.filter(d => d.isActive);
        const equalWeight = 1.0 / activeDims.length;
        setLocalDimensions(prev =>
            prev.map(d => d.isActive ? { ...d, weightage: Math.round(equalWeight * 1000) / 1000 } : d)
        );
    };

    // ── One-Click Optimize ──
    const handleOptimize = async () => {
        setOptimizing(true);
        try {
            const token = document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1]?.trim()
                || localStorage.getItem('authToken') || '';
            const res = await fetch('/api/admin/optimize-weights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            const data = await res.json();
            if (!res.ok) {
                setToast({ type: 'error', msg: data.error || 'Failed to start optimization' });
                setOptimizing(false);
                return;
            }
            setToast({ type: 'success', msg: 'Optimization started!' });
            pollOptimizationStatus();
        } catch (err: any) {
            setToast({ type: 'error', msg: err?.message || 'Failed to start optimization' });
            setOptimizing(false);
        }
    };

    const pollOptimizationStatus = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        const token = document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1]?.trim()
            || localStorage.getItem('authToken') || '';
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/admin/optimize-weights', {
                    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                });
                const data = await res.json();
                if (data.job) {
                    setOptimizeJob(data.job);
                    if (data.job.status === 'completed' || data.job.status === 'failed') {
                        clearInterval(pollRef.current);
                        setOptimizing(false);
                    }
                }
            } catch { /* ignore polling errors */ }
        }, 2000);
    }, []);

    const handleApplyOptimized = async (action: 'apply' | 'discard') => {
        if (!optimizeJob) return;
        try {
            const token = document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1]?.trim()
                || localStorage.getItem('authToken') || '';
            const res = await fetch('/api/admin/optimize-weights/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ jobId: optimizeJob.jobId, action }),
            });
            const data = await res.json();
            if (res.ok) {
                setToast({ type: 'success', msg: action === 'apply' ? 'Optimized weights applied!' : 'Optimization discarded' });
                setOptimizeJob(null);
                if (action === 'apply') fetchDimensions();
            } else {
                setToast({ type: 'error', msg: data.error || 'Failed' });
            }
        } catch (err: any) {
            setToast({ type: 'error', msg: err?.message || 'Failed' });
        }
    };

    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // Check for existing optimization job on mount
    useEffect(() => {
        const token = document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1]?.trim()
            || localStorage.getItem('authToken') || '';
        fetch('/api/admin/optimize-weights', {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }).then(r => r.json()).then(data => {
            if (data.job && (data.job.status === 'completed' && !data.job.applied)) {
                setOptimizeJob(data.job);
            }
        }).catch(() => { });
    }, []);

    const filteredDimensions = activeGroup === 'all'
        ? localDimensions
        : localDimensions.filter(d => d.group === activeGroup);

    // Auto-dismiss toast
    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    if (role !== 'admin') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
                <div className="text-center">
                    <Scale className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
                    <p className="text-slate-500 mb-6">Only administrators can manage scoring dimensions.</p>
                    <Link href="/" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
                        Go Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                            }`}
                    >
                        {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="text-sm font-medium">{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 hover:bg-white/60 rounded-xl transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                    <Scale className="w-5 h-5 text-white" />
                                </div>
                                Scoring Dimensions
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Manage 22-Dimension product scoring weights with ML optimization. Weights must sum to 100%.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleOptimize} disabled={optimizing} className="px-3 py-2 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/20">
                            {optimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Optimize Weights
                        </button>
                        <button onClick={handleEqualizeWeights} className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5" /> Equalize
                        </button>
                        <button onClick={handleReset} disabled={!hasChanges} className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                        </button>
                        <button onClick={handleSave} disabled={saving || !hasChanges || !isValid} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* Weight Total Indicator */}
                <div className={`mb-6 p-4 rounded-xl border ${isValid ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {isValid ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
                            <span className={`text-sm font-medium ${isValid ? 'text-green-700' : 'text-amber-700'}`}>
                                Total Weight: {(totalWeight * 100).toFixed(1)}%
                            </span>
                        </div>
                        <span className={`text-xs ${isValid ? 'text-green-600' : 'text-amber-600'}`}>
                            {isValid ? 'Valid — ready to save' : `Needs ${totalWeight < 1 ? '+' : ''}${((1 - totalWeight) * 100).toFixed(1)}% adjustment`}
                        </span>
                    </div>
                    <div className="mt-2 h-2 bg-white/60 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${isValid ? 'bg-green-500' : totalWeight > 1 ? 'bg-red-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(totalWeight * 100, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Visual Weight Distribution Bar */}
                <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Weight Distribution</h3>
                    <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
                        {localDimensions.filter(d => d.isActive).map((d, i) => {
                            const colors = [
                                'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
                                'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500',
                            ];
                            return (
                                <motion.div
                                    key={d.key}
                                    layout
                                    className={`${colors[i % colors.length]} flex items-center justify-center text-white text-[10px] font-bold`}
                                    style={{ width: `${d.weightage * 100}%` }}
                                    title={`${d.label}: ${(d.weightage * 100).toFixed(1)}%`}
                                >
                                    {d.weightage >= 0.06 && `${(d.weightage * 100).toFixed(0)}%`}
                                </motion.div>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {localDimensions.filter(d => d.isActive).map((d, i) => {
                            const colors = [
                                'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
                                'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500',
                            ];
                            return (
                                <div key={d.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                                    <div className={`w-2.5 h-2.5 rounded-sm ${colors[i % colors.length]}`} />
                                    {d.label}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Optimization Status Banner */}
                {(optimizing || (optimizeJob && optimizeJob.status === 'completed' && !optimizeJob.applied)) && (
                    <div className={`mb-6 p-4 rounded-xl border ${optimizing ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20'}`}>
                        {optimizing && optimizeJob ? (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                    <span className="text-sm font-medium text-purple-700">Optimizing... {optimizeJob.currentPhase}</span>
                                </div>
                                <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${optimizeJob.progressPercent}%` }} />
                                </div>
                            </div>
                        ) : optimizeJob?.status === 'completed' && !optimizeJob.applied ? (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-semibold text-blue-700">Optimization Complete — Review Changes</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleApplyOptimized('apply')} className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                                            Apply Changes
                                        </button>
                                        <button onClick={() => handleApplyOptimized('discard')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border rounded-lg hover:bg-slate-50">
                                            Discard
                                        </button>
                                    </div>
                                </div>
                                {optimizeJob.weightChanges && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                        {Object.entries(optimizeJob.weightChanges).filter(([, v]) => Math.abs(v.delta) > 0.001).map(([key, change]) => (
                                            <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-lg">
                                                <span className="text-slate-600 truncate">{key.replace(/_/g, ' ')}</span>
                                                <span className={`font-mono font-semibold ${change.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {change.delta > 0 ? '+' : ''}{(change.delta * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Group Tabs */}
                <div className="mb-4 flex flex-wrap gap-2">
                    {Object.entries(GROUP_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setActiveGroup(key)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeGroup === key
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}
                        >
                            {key !== 'all' && <div className={`w-2 h-2 rounded-full ${GROUP_COLORS[key] || 'bg-slate-400'}`} />}
                            {label}
                            <span className="text-[10px] opacity-60">
                                ({key === 'all' ? localDimensions.length : localDimensions.filter(d => d.group === key).length})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Dimension Cards */}
                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">Loading dimensions...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredDimensions.map((dim, idx) => (
                            <motion.div
                                key={dim.key}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className={`bg-white dark:bg-slate-800 rounded-xl border p-5 transition-all ${dim.isActive ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-50'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 pt-1">
                                        <GripVertical className="w-4 h-4 text-slate-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-3">
                                            <input
                                                value={dim.label}
                                                onChange={e => handleLabelChange(dim.key, e.target.value)}
                                                className="text-base font-semibold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
                                            />
                                            <code className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{dim.key}</code>
                                            {dim.group && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${GROUP_COLORS[dim.group] || 'bg-slate-400'}`}>
                                                    {dim.group}
                                                </span>
                                            )}
                                            {dim.isNegative && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">penalty</span>
                                            )}
                                            <label className="ml-auto flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={dim.isActive}
                                                    onChange={() => handleToggleActive(dim.key)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-xs text-slate-500">Active</span>
                                            </label>
                                        </div>
                                        {dim.description && (
                                            <p className="text-xs text-slate-500 mb-3 flex items-start gap-1">
                                                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                {dim.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={Math.round(dim.weightage * 100)}
                                                onChange={e => handleWeightChange(dim.key, parseInt(e.target.value) / 100)}
                                                className="flex-1 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                                                disabled={!dim.isActive}
                                            />
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    value={Math.round(dim.weightage * 100)}
                                                    onChange={e => handleWeightChange(dim.key, parseInt(e.target.value || '0') / 100)}
                                                    className="w-16 px-2 py-1.5 text-sm font-mono text-center border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600"
                                                    disabled={!dim.isActive}
                                                />
                                                <span className="text-xs text-slate-400">%</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveDimension(dim.key)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove dimension"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Add Dimension */}
                <div className="mt-4">
                    {showAddForm ? (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 p-5 space-y-3"
                        >
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Add New Dimension</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    value={newDim.key}
                                    onChange={e => setNewDim(prev => ({ ...prev, key: e.target.value }))}
                                    placeholder="Key (e.g., virtual_try_on)"
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600"
                                />
                                <input
                                    value={newDim.label}
                                    onChange={e => setNewDim(prev => ({ ...prev, label: e.target.value }))}
                                    placeholder="Label (e.g., Virtual Try-On)"
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600"
                                />
                            </div>
                            <input
                                value={newDim.description}
                                onChange={e => setNewDim(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Description (optional)"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600"
                            />
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-slate-500">Weight:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={Math.round(newDim.weightage * 100)}
                                    onChange={e => setNewDim(prev => ({ ...prev, weightage: parseInt(e.target.value || '0') / 100 }))}
                                    className="w-20 px-2 py-1.5 text-sm font-mono text-center border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600"
                                />
                                <span className="text-xs text-slate-400">%</span>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={handleAddDimension} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add</button>
                                <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                            </div>
                        </motion.div>
                    ) : (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Dimension
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

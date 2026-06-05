'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    Tag, Plus, Edit2, ChevronDown, ChevronRight,
    Loader2, CheckCircle, X, AlertTriangle, Package, ArrowLeft,
    Search, ToggleLeft, ToggleRight, Save, RefreshCw, Filter,
    ShieldCheck, ShieldOff,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductTag {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    tagType: string;
    status: string;
    sortOrder: number;
    productCount: number;
    approvedCount: number;
    createdBy: string | null;
    modifiedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

interface FormState {
    mode: 'create' | 'edit';
    data: {
        id?: number;
        name: string;
        description: string;
        tagType: string;
        status: string;
        sortOrder: number;
    };
}

const TAG_TYPES = [
    { value: 'FEATURE', label: 'Feature', color: 'bg-blue-100 text-blue-700' },
    { value: 'TECHNOLOGY', label: 'Technology', color: 'bg-purple-100 text-purple-700' },
    { value: 'PRICE_RANGE', label: 'Price Range', color: 'bg-green-100 text-green-700' },
    { value: 'USE_CASE', label: 'Use Case', color: 'bg-amber-100 text-amber-700' },
    { value: 'BRAND_TIER', label: 'Brand Tier', color: 'bg-rose-100 text-rose-700' },
    { value: 'QUALITY', label: 'Quality', color: 'bg-indigo-100 text-indigo-700' },
];

function getTagTypeColor(type: string): string {
    return TAG_TYPES.find(t => t.value === type)?.color || 'bg-slate-100 text-slate-700';
}

function getTagTypeLabel(type: string): string {
    return TAG_TYPES.find(t => t.value === type)?.label || type;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminTagsPage() {
    const [tags, setTags] = useState<ProductTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [filterType, setFilterType] = useState<string>('');
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(TAG_TYPES.map(t => t.value)));

    const fetchTags = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (showInactive) params.set('includeInactive', 'true');
            if (filterType) params.set('tagType', filterType);
            const res = await fetch(`/api/admin/tags?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch tags');
            const data = await res.json();
            setTags(data.tags || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load tags');
        } finally {
            setLoading(false);
        }
    }, [showInactive, filterType]);

    useEffect(() => { fetchTags(); }, [fetchTags]);

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(null), 4000);
            return () => clearTimeout(t);
        }
    }, [success]);

    // ── Form handlers ────────────────────────────────────────────────────────

    const openCreateTag = () => {
        setForm({
            mode: 'create',
            data: { name: '', description: '', tagType: 'FEATURE', status: 'ACTIVE', sortOrder: 0 },
        });
    };

    const openEditTag = (tag: ProductTag) => {
        setForm({
            mode: 'edit',
            data: {
                id: tag.id,
                name: tag.name,
                description: tag.description || '',
                tagType: tag.tagType,
                status: tag.status,
                sortOrder: tag.sortOrder,
            },
        });
    };

    const saveForm = async () => {
        if (!form) return;
        setSaving(true);
        setError(null);
        try {
            const method = form.mode === 'create' ? 'POST' : 'PUT';
            const res = await fetch('/api/admin/tags', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form.data),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed');
            setSuccess(`Tag ${form.mode === 'create' ? 'created' : 'updated'} successfully`);
            setForm(null);
            await fetchTags();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            const res = await fetch('/api/admin/tags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus }),
            });
            if (!res.ok) throw new Error('Toggle failed');
            setSuccess(`Tag status changed to ${newStatus}`);
            await fetchTags();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Toggle failed');
        }
    };

    const toggleTypeExpand = (type: string) => {
        setExpandedTypes(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type); else next.add(type);
            return next;
        });
    };

    // ── Filter & Group ───────────────────────────────────────────────────────

    const filteredTags = tags.filter(t => {
        if (!searchQuery) return true;
        return t.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Group by tagType
    const groupedTags = TAG_TYPES.reduce<Record<string, ProductTag[]>>((acc, type) => {
        const group = filteredTags.filter(t => t.tagType === type.value);
        if (group.length > 0) acc[type.value] = group;
        return acc;
    }, {});

    const totalProducts = tags.reduce((s, t) => s + t.productCount, 0);
    const totalApproved = tags.reduce((s, t) => s + t.approvedCount, 0);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950 py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/admin" className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        <ArrowLeft className="w-4 h-4 text-slate-600" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Tag className="w-6 h-6 text-indigo-600" />
                            Product Tags
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Manage tags for enriched product search &amp; discovery
                        </p>
                    </div>
                    <Link href="/admin/categories"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-600">
                        Categories
                    </Link>
                    <button onClick={fetchTags} disabled={loading}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <RefreshCw className="w-4 h-4 text-slate-500" />}
                    </button>
                    <button onClick={openCreateTag}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                        <Plus className="w-4 h-4" /> New Tag
                    </button>
                </div>

                {/* Alerts */}
                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search & Filters */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search tags..."
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                    </div>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                        <option value="">All Types</option>
                        {TAG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => setShowInactive(!showInactive)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showInactive ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {showInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {showInactive ? 'Showing All' : 'Active Only'}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{tags.length}</p>
                        <p className="text-xs text-slate-500 mt-1">Tags</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{Object.keys(groupedTags).length}</p>
                        <p className="text-xs text-slate-500 mt-1">Tag Types</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{totalProducts.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-slate-500 mt-1">Total Mappings</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{totalApproved.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-slate-500 mt-1">Approved</p>
                    </div>
                </div>

                {/* Tag Groups */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                ) : Object.keys(groupedTags).length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{searchQuery ? 'No matching tags' : 'No tags yet'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {Object.entries(groupedTags).map(([type, typeTags]) => {
                            const isExpanded = expandedTypes.has(type);
                            return (
                                <motion.div key={type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    {/* Type Header */}
                                    <button onClick={() => toggleTypeExpand(type)}
                                        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors text-left">
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        <div className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getTagTypeColor(type)}`}>
                                            {getTagTypeLabel(type)}
                                        </div>
                                        <span className="text-sm text-slate-500">{typeTags.length} tags</span>
                                        <span className="ml-auto text-xs text-slate-400">
                                            {typeTags.reduce((s, t) => s + t.approvedCount, 0).toLocaleString('en-IN')} approved products
                                        </span>
                                    </button>

                                    {/* Tags in group */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-slate-100">
                                                {typeTags.map(tag => (
                                                    <div key={tag.id} className="flex items-center gap-3 px-5 py-3 pl-12 hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-b-0">
                                                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-slate-800 text-sm">{tag.name}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tag.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                                    {tag.status}
                                                                </span>
                                                            </div>
                                                            {tag.description && <p className="text-xs text-slate-400 truncate mt-0.5">{tag.description}</p>}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                                            <span className="flex items-center gap-1" title="Total product mappings">
                                                                <Package className="w-3 h-3" />{tag.productCount.toLocaleString('en-IN')}
                                                            </span>
                                                            <span className="flex items-center gap-1" title="Approved mappings">
                                                                <ShieldCheck className="w-3 h-3 text-green-500" />{tag.approvedCount.toLocaleString('en-IN')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => openEditTag(tag)} title="Edit"
                                                                className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            <button onClick={() => toggleStatus(tag.id, tag.status)} title="Toggle status"
                                                                className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600 transition-colors">
                                                                {tag.status === 'ACTIVE' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* ── Create/Edit Form Modal ─────────────────────────────────────────── */}
                <AnimatePresence>
                    {form && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setForm(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {form.mode === 'create' ? 'Create' : 'Edit'} Tag
                                    </h2>
                                    <button onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                                        <input type="text" value={form.data.name} maxLength={100}
                                            onChange={e => setForm({ ...form, data: { ...form.data, name: e.target.value } })}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                            placeholder="e.g. Wireless, Bluetooth, Budget Friendly" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                        <textarea value={form.data.description} rows={2}
                                            onChange={e => setForm({ ...form, data: { ...form.data, description: e.target.value } })}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                                            placeholder="Brief description of this tag..." />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Tag Type *</label>
                                            <select value={form.data.tagType}
                                                onChange={e => setForm({ ...form, data: { ...form.data, tagType: e.target.value } })}
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                                                {TAG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select value={form.data.status}
                                                onChange={e => setForm({ ...form, data: { ...form.data, status: e.target.value } })}
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                                                <option value="ACTIVE">Active</option>
                                                <option value="INACTIVE">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                                        <input type="number" value={form.data.sortOrder} min={0}
                                            onChange={e => setForm({ ...form, data: { ...form.data, sortOrder: parseInt(e.target.value, 10) || 0 } })}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                                    <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
                                    <button onClick={saveForm} disabled={saving || !form.data.name.trim()}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {form.mode === 'create' ? 'Create' : 'Save Changes'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

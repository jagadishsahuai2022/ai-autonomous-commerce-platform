'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    FolderTree, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
    Loader2, CheckCircle, X, AlertTriangle, Package, ArrowLeft,
    Search, ToggleLeft, ToggleRight, Save, RefreshCw, Layers,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SubCategory {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    sortOrder: number;
    productCount: number;
    categoryId: number;
    createdBy: string | null;
    modifiedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

interface Category {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    sortOrder: number;
    subCategoryCount: number;
    productCount: number;
    subCategories?: SubCategory[];
    createdBy: string | null;
    modifiedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

interface FormState {
    type: 'category' | 'subcategory';
    mode: 'create' | 'edit';
    data: {
        id?: number;
        name: string;
        description: string;
        status: string;
        sortOrder: number;
        categoryId?: number;
    };
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
    const [form, setForm] = useState<FormState | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/categories?withSubCategories=true&includeInactive=${showInactive}`);
            if (!res.ok) throw new Error('Failed to fetch categories');
            const data = await res.json();
            setCategories(data.categories || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load categories');
        } finally {
            setLoading(false);
        }
    }, [showInactive]);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    // Auto-clear success message
    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(null), 4000);
            return () => clearTimeout(t);
        }
    }, [success]);

    const toggleExpand = (catId: number) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId); else next.add(catId);
            return next;
        });
    };

    // ── Form handlers ────────────────────────────────────────────────────────

    const openCreateCategory = () => {
        setForm({
            type: 'category',
            mode: 'create',
            data: { name: '', description: '', status: 'ACTIVE', sortOrder: categories.length + 1 },
        });
    };

    const openEditCategory = (cat: Category) => {
        setForm({
            type: 'category',
            mode: 'edit',
            data: {
                id: cat.id,
                name: cat.name,
                description: cat.description || '',
                status: cat.status,
                sortOrder: cat.sortOrder,
            },
        });
    };

    const openCreateSubCategory = (categoryId: number) => {
        const parent = categories.find(c => c.id === categoryId);
        const existingSubs = parent?.subCategories?.length || 0;
        setForm({
            type: 'subcategory',
            mode: 'create',
            data: {
                name: '', description: '', status: 'ACTIVE',
                sortOrder: existingSubs + 1, categoryId,
            },
        });
    };

    const openEditSubCategory = (sub: SubCategory) => {
        setForm({
            type: 'subcategory',
            mode: 'edit',
            data: {
                id: sub.id,
                name: sub.name,
                description: sub.description || '',
                status: sub.status,
                sortOrder: sub.sortOrder,
                categoryId: sub.categoryId,
            },
        });
    };

    const saveForm = async () => {
        if (!form) return;
        setSaving(true);
        setError(null);
        try {
            const endpoint = form.type === 'category' ? '/api/admin/categories' : '/api/admin/subcategories';
            const method = form.mode === 'create' ? 'POST' : 'PUT';
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form.data),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed');
            setSuccess(`${form.type === 'category' ? 'Category' : 'Subcategory'} ${form.mode === 'create' ? 'created' : 'updated'} successfully`);
            setForm(null);
            await fetchCategories();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (type: 'category' | 'subcategory', id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            const endpoint = type === 'category' ? '/api/admin/categories' : '/api/admin/subcategories';
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus }),
            });
            if (!res.ok) throw new Error('Toggle failed');
            setSuccess(`Status changed to ${newStatus}`);
            await fetchCategories();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Toggle failed');
        }
    };

    // ── Filter ───────────────────────────────────────────────────────────────

    const filteredCategories = categories.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        if (c.name.toLowerCase().includes(q)) return true;
        return c.subCategories?.some(sc => sc.name.toLowerCase().includes(q)) || false;
    });

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
                            <FolderTree className="w-6 h-6 text-indigo-600" />
                            Product Categories
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Manage product categories and subcategories for better organization & search
                        </p>
                    </div>
                    <Link href="/admin/tags"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-600">
                        <Package className="w-4 h-4" /> Tags
                    </Link>
                    <button onClick={fetchCategories} disabled={loading}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <RefreshCw className="w-4 h-4 text-slate-500" />}
                    </button>
                    <button onClick={openCreateCategory}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                        <Plus className="w-4 h-4" /> New Category
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
                            placeholder="Search categories & subcategories..."
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                    </div>
                    <button onClick={() => setShowInactive(!showInactive)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showInactive ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {showInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {showInactive ? 'Showing All' : 'Active Only'}
                    </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{categories.length}</p>
                        <p className="text-xs text-slate-500 mt-1">Categories</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{categories.reduce((s, c) => s + (c.subCategories?.length || 0), 0)}</p>
                        <p className="text-xs text-slate-500 mt-1">Subcategories</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{categories.reduce((s, c) => s + c.productCount, 0).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-slate-500 mt-1">Total Products</p>
                    </div>
                </div>

                {/* Category Tree */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{searchQuery ? 'No matching categories found' : 'No categories yet'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredCategories.map((cat) => {
                            const isExpanded = expandedCats.has(cat.id);
                            const subs = cat.subCategories || [];
                            return (
                                <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    {/* Category Row */}
                                    <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                                        <button onClick={() => toggleExpand(cat.id)} className="p-1">
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        </button>
                                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                            <FolderTree className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-900 text-sm">{cat.name}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cat.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                    {cat.status}
                                                </span>
                                            </div>
                                            {cat.description && <p className="text-xs text-slate-500 truncate mt-0.5">{cat.description}</p>}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{subs.length} sub</span>
                                            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{cat.productCount.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openCreateSubCategory(cat.id)} title="Add subcategory"
                                                className="p-1.5 rounded-md hover:bg-indigo-50 text-indigo-600 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => openEditCategory(cat)} title="Edit category"
                                                className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => toggleStatus('category', cat.id, cat.status)} title="Toggle status"
                                                className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600 transition-colors">
                                                {cat.status === 'ACTIVE' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Subcategories */}
                                    <AnimatePresence>
                                        {isExpanded && subs.length > 0 && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-slate-100 bg-slate-50/50">
                                                {subs.map(sub => (
                                                    <div key={sub.id} className="flex items-center gap-3 px-5 py-3 pl-14 hover:bg-white/60 transition-colors border-b border-slate-100 last:border-b-0">
                                                        <div className="p-1.5 rounded-md bg-slate-200 text-slate-600">
                                                            <Package className="w-3 h-3" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-slate-800 text-sm">{sub.name}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sub.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                                    {sub.status}
                                                                </span>
                                                            </div>
                                                            {sub.description && <p className="text-xs text-slate-400 truncate mt-0.5">{sub.description}</p>}
                                                        </div>
                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Package className="w-3 h-3" />{sub.productCount.toLocaleString('en-IN')} products
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => openEditSubCategory(sub)} title="Edit"
                                                                className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"><Edit2 className="w-3 h-3" /></button>
                                                            <button onClick={() => toggleStatus('subcategory', sub.id, sub.status)} title="Toggle status"
                                                                className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600 transition-colors">
                                                                {sub.status === 'ACTIVE' ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                        {isExpanded && subs.length === 0 && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-slate-100 px-5 py-4 pl-14 text-sm text-slate-400">
                                                No subcategories yet.{' '}
                                                <button onClick={() => openCreateSubCategory(cat.id)} className="text-indigo-600 font-medium hover:underline">Add one</button>
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
                                        {form.mode === 'create' ? 'Create' : 'Edit'} {form.type === 'category' ? 'Category' : 'Subcategory'}
                                    </h2>
                                    <button onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                                        <input type="text" value={form.data.name} maxLength={100}
                                            onChange={e => setForm({ ...form, data: { ...form.data, name: e.target.value } })}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                            placeholder={form.type === 'category' ? 'e.g. Electronics & Mobile' : 'e.g. Smartphones'} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                        <textarea value={form.data.description} rows={2}
                                            onChange={e => setForm({ ...form, data: { ...form.data, description: e.target.value } })}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                                            placeholder="Brief description..." />
                                    </div>
                                    {form.type === 'subcategory' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category *</label>
                                            <select value={form.data.categoryId || ''}
                                                onChange={e => setForm({ ...form, data: { ...form.data, categoryId: parseInt(e.target.value, 10) } })}
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                                                <option value="">Select category...</option>
                                                {categories.filter(c => c.status === 'ACTIVE').map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select value={form.data.status}
                                                onChange={e => setForm({ ...form, data: { ...form.data, status: e.target.value } })}
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                                                <option value="ACTIVE">Active</option>
                                                <option value="INACTIVE">Inactive</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                                            <input type="number" value={form.data.sortOrder} min={0}
                                                onChange={e => setForm({ ...form, data: { ...form.data, sortOrder: parseInt(e.target.value, 10) || 0 } })}
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                                        </div>
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

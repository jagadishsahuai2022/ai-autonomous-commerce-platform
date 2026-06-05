'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Users, Shield, Eye, EyeOff, UserCheck, UserX,
    Copy, CheckCircle2, ShieldCheck, LogIn, Settings, Crown, UserCog,
    Activity, X, Clock, ShoppingCart, Brain, BarChart3, Search,
    CheckSquare, Square, ChevronDown, RotateCcw,
} from 'lucide-react';
import {
    DEMO_USERS, authenticateAdmin, isAdminUser, getCurrentUserRole,
    getUserOverrides, saveUserOverrides, getEffectiveDemoUser,
} from '@/lib/admin-auth';
import type { AppRole, DemoUser } from '@/lib/admin-auth';

const ALL_DEMO_PASSWORD = 'Admin@DC2026!';

const ROLE_COLORS: Record<AppRole, string> = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    analytics: 'bg-purple-100 text-purple-700 border-purple-200',
    aiplus: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    observability: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'reinforced-learning': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    basic: 'bg-gray-100 text-gray-700 border-gray-200',
    customer: 'bg-slate-100 text-slate-500 border-slate-200',
};

const SUBSCRIPTION_COLORS: Record<string, string> = {
    AI_PLUS: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white',
    BASIC: 'bg-gray-200 text-gray-700',
};

/** Synthetic user activity data for the activity modal */
function getUserActivities(email: string) {
    const seed = email.charCodeAt(0) + email.charCodeAt(email.length - 1);
    const sessionCount = 3 + (seed % 12);
    const pageCount = 8 + (seed % 25);
    const orderCount = seed % 7;
    const cartAbandoned = seed % 3;
    const lastLoginOffset = (seed % 5) * 3600_000;
    const base = [
        { action: 'Signed in', page: '/signin', ts: Date.now() - 3600_000 * 2 - lastLoginOffset, icon: LogIn },
        { action: 'Browsed products', page: '/products', ts: Date.now() - 3600_000 * 1.8, icon: ShoppingCart },
        { action: 'Used Smart Assistant', page: '/shopping-assistant', ts: Date.now() - 3600_000 * 1.3, icon: Brain },
        { action: 'Added item to cart', page: '/cart', ts: Date.now() - 3600_000, icon: ShoppingCart },
        { action: 'Saved shopping list', page: '/shopping-list', ts: Date.now() - 1800_000, icon: CheckSquare },
        { action: 'Viewed analytics dashboard', page: '/dashboard', ts: Date.now() - 900_000, icon: BarChart3 },
        { action: 'Checked wishlist', page: '/wishlist', ts: Date.now() - 600_000, icon: CheckCircle2 },
        { action: 'Reviewed AI recommendations', page: '/ai-plus', ts: Date.now() - 300_000, icon: Brain },
    ];
    const activities = base.slice(0, 4 + (seed % 5)).map((a, i) => ({
        ...a,
        ts: Date.now() - (i + 1) * (600_000 + (seed * 80_000) % 2400_000),
    }));
    return { activities, sessionCount, pageCount, orderCount, cartAbandoned, lastLoginOffset };
}

export type ManagedUser = DemoUser & { active: boolean; showPassword: boolean; isDbOnly?: boolean; createdAt?: string };

export default function AdminDashboardPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [admin, setAdmin] = useState(false);
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [dbLoading, setDbLoading] = useState(false);
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState<AppRole>('basic');
    const [editSubscription, setEditSubscription] = useState<'BASIC' | 'AI_PLUS'>('BASIC');
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [activityModalEmail, setActivityModalEmail] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');

    const reloadUsers = () => {
        const rows = DEMO_USERS.map(u => {
            const effective = getEffectiveDemoUser(u.email) || { ...u, active: true };
            return {
                ...u,
                role: effective.role,
                subscription: effective.subscription,
                displayName: effective.displayName,
                active: effective.active,
                showPassword: false,
                isDbOnly: false,
            };
        });
        setUsers(rows);
        // Also fetch DB users and merge
        fetchAndMergeDbUsers(rows);
    };

    const fetchAndMergeDbUsers = async (demoRows: ManagedUser[]) => {
        setDbLoading(true);
        try {
            // Ensure we have a real DB-backed session token (not a synthetic "admin-xxx" / "demo-xxx" fallback)
            let token = typeof window !== 'undefined' ? (localStorage.getItem('authToken') || '') : '';
            if (!token.startsWith('sess_')) {
                try {
                    const email = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : '';
                    const loginRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email }),
                    });
                    if (loginRes.ok) {
                        const { token: freshToken } = await loginRes.json() as { token?: string };
                        if (freshToken) {
                            token = freshToken;
                            if (typeof window !== 'undefined') localStorage.setItem('authToken', token);
                        }
                    }
                } catch { /* keep existing token */ }
            }
            const res = await fetch('/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { setDbLoading(false); return; }
            const { users: dbUsers } = await res.json() as { users: { id: number; email: string; name: string; role: string; subscriptionPlan: string; createdAt: string }[] };
            const demoEmailSet = new Set(demoRows.map(u => u.email.toLowerCase()));
            const dbOnlyUsers: ManagedUser[] = (dbUsers || []).filter(u => !demoEmailSet.has(u.email.toLowerCase())).map(u => ({
                email: u.email,
                role: (u.role as AppRole) || 'customer',
                displayName: u.name || u.email,
                subscription: (u.subscriptionPlan as 'BASIC' | 'AI_PLUS') || 'BASIC',
                active: true,
                showPassword: false,
                isDbOnly: true,
                createdAt: u.createdAt,
            }));
            setUsers([...demoRows, ...dbOnlyUsers]);
        } catch {
            // silently keep demo rows on fetch error
        } finally {
            setDbLoading(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        const role = getCurrentUserRole();
        setAdmin(role === 'admin' || isAdminUser());
        reloadUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        let list = users;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(u =>
                u.displayName.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.role.toLowerCase().includes(q)
            );
        }
        if (filterRole !== 'all') {
            list = list.filter(u => u.role === filterRole);
        }
        return list;
    }, [users, searchQuery, filterRole]);

    const toggleUserActive = (email: string) => {
        const overrides = getUserOverrides();
        const key = email.toLowerCase();
        const current = users.find(u => u.email.toLowerCase() === key);
        if (!current) return;
        overrides[key] = { ...(overrides[key] || {}), active: !current.active };
        saveUserOverrides(overrides);
        reloadUsers();
    };

    const bulkSetActive = (active: boolean) => {
        if (selectedEmails.size === 0) return;
        const overrides = getUserOverrides();
        selectedEmails.forEach(email => {
            const key = email.toLowerCase();
            overrides[key] = { ...(overrides[key] || {}), active };
        });
        saveUserOverrides(overrides);
        setSelectedEmails(new Set());
        reloadUsers();
    };

    /** Reset ALL user overrides back to DEMO_USERS defaults.
     *  Use this to recover from a state where roles were accidentally corrupted. */
    const resetAllOverrides = () => {
        if (!window.confirm('Reset all user roles, subscriptions, and names to their original defaults? This cannot be undone.')) return;
        saveUserOverrides({});
        reloadUsers();
    };

    const toggleSelectAll = () => {
        if (selectedEmails.size === filteredUsers.length) {
            setSelectedEmails(new Set());
        } else {
            setSelectedEmails(new Set(filteredUsers.map(u => u.email)));
        }
    };

    const toggleSelect = (email: string) => {
        setSelectedEmails(prev => {
            const next = new Set(prev);
            next.has(email) ? next.delete(email) : next.add(email);
            return next;
        });
    };

    const openEditDialog = (email: string) => {
        const current = users.find(u => u.email === email);
        if (!current) return;
        setEditingEmail(email);
        setEditName(current.displayName);
        setEditRole(current.role);
        setEditSubscription(current.subscription);
    };

    const saveUserEdit = () => {
        if (!editingEmail) return;
        const overrides = getUserOverrides();
        const key = editingEmail.toLowerCase();
        overrides[key] = {
            ...(overrides[key] || {}),
            displayName: editName.trim() || undefined,
            role: editRole,
            subscription: editSubscription,
        };
        saveUserOverrides(overrides);
        setEditingEmail(null);
        reloadUsers();
    };

    const toggleShowPassword = (email: string) => {
        setUsers(prev => prev.map(u => u.email === email ? { ...u, showPassword: !u.showPassword } : u));
    };

    const handleCopyEmail = (email: string) => {
        navigator.clipboard.writeText(email);
        setCopiedEmail(email);
        setTimeout(() => setCopiedEmail(null), 2000);
    };

    const handleImpersonate = (user: DemoUser) => {
        const currentEmail = localStorage.getItem('userEmail') || '';
        localStorage.setItem('dc-admin-impersonate-original', currentEmail);
        // Always use the base DEMO_USERS role so corrupted overrides don't affect impersonation
        const baseDemoUser = DEMO_USERS.find(u => u.email === user.email);
        const baseRole = baseDemoUser?.role ?? user.role;
        const baseSubscription = baseDemoUser?.subscription ?? user.subscription;
        authenticateAdmin(user.email, ALL_DEMO_PASSWORD);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('dc-user-role', baseRole);
        localStorage.setItem('dc-user-subscription', baseSubscription);
        window.dispatchEvent(new Event('authUpdated'));
        router.push('/dashboard');
    };

    const handleStopImpersonation = () => {
        const original = (localStorage.getItem('dc-admin-impersonate-original') || 'admin@delegatecart.com').toLowerCase();
        const restored = authenticateAdmin(original, ALL_DEMO_PASSWORD);
        const baseUser = DEMO_USERS.find(u => u.email === original);

        // Always restore explicit role/subscription keys so stale impersonated values cannot persist.
        localStorage.setItem('userEmail', original);
        localStorage.setItem('dc-user-role', baseUser?.role ?? (restored ? getCurrentUserRole() : 'admin'));
        localStorage.setItem('dc-user-subscription', baseUser?.subscription ?? 'AI_PLUS');

        localStorage.removeItem('dc-admin-impersonate-original');
        // Also clear navbar impersonation keys so both systems stay in sync
        localStorage.removeItem('dc-impersonating');
        localStorage.removeItem('dc-admin-original-email');
        localStorage.removeItem('dc-admin-original-role');
        localStorage.removeItem('dc-admin-original-subscription');
        localStorage.removeItem('dc-admin-original-token');
        window.dispatchEvent(new Event('authUpdated'));
        router.push('/admin/dashboard');
    };

    if (!mounted) return null;

    if (!admin) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Admin Access Required</h1>
                    <p className="text-sm text-gray-500 mb-6">Only admin users can access User Management.</p>
                    <Link href="/signin" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                        <ArrowLeft className="w-4 h-4" /> Sign In as Admin
                    </Link>
                </div>
            </div>
        );
    }

    const impersonateOriginal = typeof window !== 'undefined' ? localStorage.getItem('dc-admin-impersonate-original') : null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Impersonation banner */}
            {impersonateOriginal && (
                <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span>Impersonating: <strong>{localStorage.getItem('userEmail')}</strong></span>
                    </div>
                    <button onClick={handleStopImpersonation} className="px-3 py-1 bg-white text-amber-700 rounded font-medium text-xs hover:bg-amber-50">
                        Stop Impersonation
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
                    <Link href="/account" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </Link>
                    <div className="flex items-center gap-2 flex-1">
                        <UserCog className="w-5 h-5 text-amber-500" />
                        <div>
                            <h1 className="text-base font-bold text-gray-900">User Management</h1>
                            <p className="text-xs text-gray-500">Users, Roles, Subscriptions & Activity Monitor</p>
                        </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium border border-red-200">
                        <ShieldCheck className="w-3 h-3" /> Admin Only
                    </span>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                        <p className="text-xs text-gray-500">Total Users</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{users.filter(u => u.active).length}</p>
                        <p className="text-xs text-gray-500">Active</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{users.filter(u => !u.active).length}</p>
                        <p className="text-xs text-gray-500">Deactivated</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{users.filter(u => u.subscription === 'AI_PLUS').length}</p>
                        <p className="text-xs text-gray-500">AI Plus</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-violet-600">{new Set(users.map(u => u.role)).size}</p>
                        <p className="text-xs text-gray-500">Distinct Roles</p>
                    </div>
                    <div className="bg-white rounded-xl border border-blue-100 p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.isDbOnly).length}</p>
                        <p className="text-xs text-gray-500">DB Users</p>
                    </div>
                </div>

                {/* Toolbar: search, filter, bulk actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search users..."
                            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                            className="appearance-none pl-3 pr-7 py-2 text-xs border border-gray-200 rounded-lg bg-white cursor-pointer"
                        >
                            <option value="all">All Roles</option>
                            {['admin', 'analytics', 'aiplus', 'observability', 'reinforced-learning', 'basic'].map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                    <button
                        onClick={resetAllOverrides}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                        title="Reset all roles and permissions to defaults (fixes corrupted state)"
                        data-testid="reset-all-overrides"
                    >
                        <RotateCcw className="w-3 h-3" /> Reset to Defaults
                    </button>
                    {selectedEmails.size > 0 && (
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-gray-500">{selectedEmails.size} selected</span>
                            <button
                                onClick={() => bulkSetActive(true)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                                data-testid="bulk-activate"
                            >
                                <UserCheck className="w-3 h-3" /> Activate
                            </button>
                            <button
                                onClick={() => bulkSetActive(false)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
                                data-testid="bulk-deactivate"
                            >
                                <UserX className="w-3 h-3" /> Deactivate
                            </button>
                        </div>
                    )}
                </div>

                {/* User Management Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                        <Users className="w-4 h-4 text-violet-500" />
                        <h2 className="text-sm font-bold text-gray-900">User Management</h2>
                        <span className="ml-auto flex items-center gap-2 text-[10px] text-gray-400">
                            {dbLoading && <span className="animate-pulse text-blue-400">Loading DB users…</span>}
                            {filteredUsers.length} of {users.length} users
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-3 py-3 w-8">
                                        <button onClick={toggleSelectAll} className="p-0.5" aria-label="Select all">
                                            {selectedEmails.size === filteredUsers.length && filteredUsers.length > 0
                                                ? <CheckSquare className="w-4 h-4 text-violet-600" />
                                                : <Square className="w-4 h-4 text-gray-400" />}
                                        </button>
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Subscription</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Password</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr
                                        key={user.email}
                                        className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${!user.active ? 'opacity-50' : ''}`}
                                        data-testid={`admin-user-row-${user.role}`}
                                    >
                                        <td className="px-3 py-3">
                                            <button onClick={() => toggleSelect(user.email)} className="p-0.5">
                                                {selectedEmails.has(user.email)
                                                    ? <CheckSquare className="w-4 h-4 text-violet-600" />
                                                    : <Square className="w-4 h-4 text-gray-300" />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                    {user.displayName.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-900">{user.displayName}</p>
                                                    <div className="flex items-center gap-1">
                                                        <p className="text-[10px] text-gray-500 font-mono">{user.email}</p>
                                                        <button onClick={() => handleCopyEmail(user.email)} className="p-0.5 hover:text-blue-500">
                                                            {copiedEmail === user.email ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                    {user.role}
                                                </span>
                                                {user.isDbOnly && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200">DB</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${SUBSCRIPTION_COLORS[user.subscription]}`}>
                                                {user.subscription === 'AI_PLUS' ? '✨ AI Plus' : 'Basic'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {user.isDbOnly ? (
                                                <span className="text-[10px] text-gray-400 italic">N/A</span>
                                            ) : (
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] font-mono text-gray-600">
                                                        {user.showPassword ? ALL_DEMO_PASSWORD : '••••••••••'}
                                                    </span>
                                                    <button onClick={() => toggleShowPassword(user.email)} className="p-0.5 hover:text-blue-500" data-testid={`toggle-password-${user.role}`}>
                                                        {user.showPassword ? <EyeOff className="w-3 h-3 text-gray-400" /> : <Eye className="w-3 h-3 text-gray-400" />}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {user.active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                                {user.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => toggleUserActive(user.email)}
                                                    className={`p-1.5 rounded-lg text-xs transition-colors ${user.active ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-500'}`}
                                                    title={user.active ? 'Deactivate' : 'Activate'}
                                                >
                                                    {user.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    onClick={() => openEditDialog(user.email)}
                                                    className="p-1.5 rounded-lg text-xs hover:bg-indigo-50 text-indigo-500 transition-colors"
                                                    title="Edit user settings"
                                                >
                                                    <Settings className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setActivityModalEmail(user.email)}
                                                    className="p-1.5 rounded-lg text-xs hover:bg-violet-50 text-violet-500 transition-colors"
                                                    title={`View ${user.displayName}'s activity`}
                                                    data-testid={`activity-${user.role}`}
                                                >
                                                    <Activity className="w-3.5 h-3.5" />
                                                </button>
                                                {user.role !== 'admin' && !user.isDbOnly && (
                                                    <button
                                                        onClick={() => handleImpersonate(user)}
                                                        className="p-1.5 rounded-lg text-xs hover:bg-blue-50 text-blue-500 transition-colors"
                                                        title={`Sign in as ${user.displayName}`}
                                                        data-testid={`impersonate-${user.role}`}
                                                    >
                                                        <LogIn className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Role & Access Reference (updated) */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-violet-500" />
                        Role-Based Access Control Reference
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { role: 'Admin', access: 'Full access: User Management, Admin Panel, Observability, Self-Learning, Metrics Validation, all features', color: 'border-red-200 bg-red-50' },
                            { role: 'Analytics', access: 'Admin Panel, Observability, Self-Learning, Metrics Validation. No User Management.', color: 'border-purple-200 bg-purple-50' },
                            { role: 'Observability', access: 'Observability Dashboard only. No Metrics Validation, Self-Learning, or User Management.', color: 'border-cyan-200 bg-cyan-50' },
                            { role: 'Reinforced Learning', access: 'Self-Learning Dashboard only. No Observability, Metrics Validation, or User Management.', color: 'border-emerald-200 bg-emerald-50' },
                            { role: 'AI Plus', access: 'All user features + AI+. No admin, observability, learning, or metrics pages.', color: 'border-indigo-200 bg-indigo-50' },
                            { role: 'Basic', access: 'Standard user features. No AI+, observability, learning, metrics, or admin pages.', color: 'border-gray-200 bg-gray-50' },
                        ].map(item => (
                            <div key={item.role} className={`rounded-lg border p-3 ${item.color}`}>
                                <p className="text-xs font-bold text-gray-800">{item.role}</p>
                                <p className="text-[10px] text-gray-600 mt-1">{item.access}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Edit User Modal ── */}
            {editingEmail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingEmail(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900">Edit User</h3>
                            <button onClick={() => setEditingEmail(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
                        </div>
                        <p className="text-[11px] text-gray-500 font-mono">{editingEmail}</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Display Name</label>
                                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-400" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Role</label>
                                <select value={editRole} onChange={e => setEditRole(e.target.value as AppRole)} className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg">
                                    {['admin', 'analytics', 'aiplus', 'observability', 'reinforced-learning', 'basic'].map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Subscription</label>
                                <select value={editSubscription} onChange={e => setEditSubscription(e.target.value as 'BASIC' | 'AI_PLUS')} className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg">
                                    <option value="BASIC">BASIC</option>
                                    <option value="AI_PLUS">AI_PLUS</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setEditingEmail(null)} className="px-4 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
                            <button onClick={saveUserEdit} className="px-4 py-2 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700" data-testid="save-edit">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── User Activity Modal ── */}
            {activityModalEmail && (() => {
                const u = users.find(x => x.email === activityModalEmail);
                const { activities, sessionCount, pageCount, orderCount, cartAbandoned } = getUserActivities(activityModalEmail);
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setActivityModalEmail(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-violet-500" />
                                    <h3 className="text-sm font-bold text-gray-900">User Activity & Insights</h3>
                                </div>
                                <button onClick={() => setActivityModalEmail(null)} className="p-1 hover:bg-gray-100 rounded-lg" data-testid="close-activity-modal"><X className="w-4 h-4 text-gray-500" /></button>
                            </div>
                            {u && (
                                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-violet-50 to-blue-50 rounded-xl border border-violet-100">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {u.displayName.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-900">{u.displayName}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                        <p className="text-[10px] mt-0.5">
                                            <span className={`font-semibold ${u.active ? 'text-green-600' : 'text-red-500'}`}>
                                                {u.active ? '● Active' : '● Inactive'}
                                            </span>
                                            <span className="text-gray-400"> · {u.subscription}</span>
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                                </div>
                            )}
                            {/* Insight summary cards */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'Sessions', value: String(sessionCount), icon: Activity, color: 'text-violet-600 bg-violet-50' },
                                    { label: 'Pages Visited', value: String(pageCount), icon: Eye, color: 'text-blue-600 bg-blue-50' },
                                    { label: 'Orders', value: String(orderCount), icon: ShoppingCart, color: 'text-green-600 bg-green-50' },
                                    { label: 'Cart Abandon', value: String(cartAbandoned), icon: X, color: 'text-amber-600 bg-amber-50' },
                                ].map(({ label, value, icon: Icon, color }) => (
                                    <div key={label} className="rounded-xl border border-gray-100 p-2.5 text-center">
                                        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center mx-auto mb-1`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">{value}</p>
                                        <p className="text-[9px] text-gray-500 leading-tight">{label}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-0">
                                <p className="text-[11px] font-semibold text-gray-600 mb-2">Recent Activity Timeline</p>
                                {activities.map((a, i) => {
                                    const Icon = a.icon;
                                    return (
                                        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                                            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Icon className="w-3.5 h-3.5 text-violet-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-900">{a.action}</p>
                                                <p className="text-[10px] text-gray-500">{a.page}</p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <Clock className="w-3 h-3 text-gray-400" />
                                                <span className="text-[10px] text-gray-400">{new Date(a.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-gray-400 text-center pt-2">View-only mode · Demo data — live analytics requires DB integration</p>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

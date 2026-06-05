'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Search, Trash2, Edit3, Save, X, Sparkles, ChevronLeft, ChevronRight,
  RefreshCw, AlertCircle, CheckCircle, Loader2, Eye, Zap, ToggleLeft, ToggleRight,
  MessageSquare, Clock, User, Shield, Wifi, WifiOff, ChevronDown,
  Download, Columns, Filter, SortAsc, SortDesc, ChevronsLeft, ChevronsRight,
  Square, CheckSquare, MinusSquare, ArrowUpDown,
} from 'lucide-react';
import { isAdminUser, hasPageAccess, canViewAllLearningData, DEMO_USERS } from '@/lib/admin-auth';

// ─── User-friendly name resolver ────────────────────────────────────────────
function friendlyUserName(userId: string): string {
  if (!userId) return 'Unknown User';
  const match = DEMO_USERS.find(u =>
    u.email === userId ||
    u.email.toLowerCase() === userId.toLowerCase() ||
    userId.includes(u.email.split('@')[0])
  );
  if (match) {
    const full = match.firstName && match.lastName
      ? `${match.firstName} ${match.lastName}`
      : match.displayName;
    const alias = match.aliasName || match.email.split('@')[0];
    return `${full} (${alias})`;
  }
  if (/^user-\d{10,}$/.test(userId)) {
    const ts = parseInt(userId.replace('user-', ''), 10);
    if (!isNaN(ts) && ts > 1_700_000_000_000)
      return `User (${new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
  }
  if (userId.startsWith('capture-user-')) return 'Capture Test User';
  if (userId.startsWith('max-q-test-')) return 'Max Q Test User';
  if (userId.startsWith('struct-q-test')) return 'Structure Q Test User';
  if (userId.startsWith('legacy-3q-')) return 'Legacy Query Test User';
  if (userId.startsWith('cat-route-all-')) return 'Category Route Test User';
  if (userId.startsWith('test-laptop-')) return 'Laptop Test User';
  if (userId === 'anonymous') return 'Anonymous Guest';
  if (userId === 'test-user') return 'Test User';
  if (userId.startsWith('user-demo-')) return `Demo User ${userId.split('-').pop()}`;
  if (userId.includes('@')) {
    const local = userId.split('@')[0];
    return local.charAt(0).toUpperCase() + local.slice(1).replace(/[._-]/g, ' ');
  }
  return userId;
}

interface CommentEntry {
  text: string;
  timestamp: string;
  userId: string | null;
  action: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: 'text-green-600 bg-green-50 border-green-200' },
  duplicate_deactivated: { label: 'Auto-Inactive', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  supervisor_edited: { label: 'Supervised Edit', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ai_enriched: { label: 'AI Enriched', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  toggled_active: { label: 'Status Changed', color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

interface LLMModelDef {
  id: string;
  name: string;
  provider: string;
  costPerMTok: number;
  contextWindow: number;
  description: string;
}

interface ModelConnectivity {
  connected: boolean;
  error?: string;
  latencyMs?: number;
  apiKeyConfigured: boolean;
}

interface LearningRecord {
  id: number;
  userId: number | null;
  queryBy: string;
  queryText: string;
  initialProductSuggestionText: string | null;
  intentEngineResponse: Record<string, unknown>;
  supervisedResponse: Record<string, unknown>;
  aiEnrichedResponse: Record<string, unknown> | null;
  enhancedByAI: boolean;
  isActive: boolean;
  comments: CommentEntry[];
  createdAt: string;
  updatedAt: string;
}

type SortField = 'id' | 'queryBy' | 'queryText' | 'createdAt' | 'updatedAt' | 'isActive' | 'enhancedByAI';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'select', label: '', visible: true },
  // id is intentionally hidden from the grid and column picker — kept in DB/business logic only
  { key: 'id', label: 'ID', visible: false },
  { key: 'queryBy', label: 'Query By', visible: true },
  { key: 'queryText', label: 'Query Text', visible: true },
  { key: 'initialSuggestion', label: 'Initial Suggestion', visible: false },
  { key: 'intentResponse', label: 'Intent Response', visible: true },
  { key: 'supervisedResponse', label: 'Supervised Response', visible: false },
  { key: 'aiEnriched', label: 'AI Enriched', visible: true },
  { key: 'ai', label: 'AI?', visible: true },
  { key: 'active', label: 'Active?', visible: true },
  { key: 'comments', label: 'Comments', visible: true },
  { key: 'actions', label: 'Actions', visible: true },
];

const BATCH_SIZE_OPTIONS = [10, 20, 30, 50, 70, 100];
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

export default function AdminLearningDashboard() {
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterAI, setFilterAI] = useState<'all' | 'enriched' | 'unenriched'>('all');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Column visibility
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editJson, setEditJson] = useState('');

  // Modal edit state
  const [modalRecord, setModalRecord] = useState<LearningRecord | null>(null);
  const [modalJson, setModalJson] = useState('');
  const [modalTab, setModalTab] = useState<'edit' | 'intent' | 'ai'>('edit');

  // Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(10);

  // LLM model selector
  const [models, setModels] = useState<LLMModelDef[]>([]);
  const [selectedModel, setSelectedModel] = useState('gemini-flash');
  const [modelConnectivity, setModelConnectivity] = useState<Record<string, ModelConnectivity>>({});
  const [connectivityChecking, setConnectivityChecking] = useState(false);

  // AI Enriched view modal (read-only)
  const [aiViewRecord, setAiViewRecord] = useState<LearningRecord | null>(null);

  // Comments modal (read-only)
  const [commentsRecord, setCommentsRecord] = useState<LearningRecord | null>(null);

  // isActive toggle loading tracker
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Filter panel
  const [showFilters, setShowFilters] = useState(false);

  // Per-column filters — popup-based (icon click opens floating input/select)
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [filterPopup, setFilterPopup] = useState<{ key: string; top: number; left: number } | null>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout>(undefined);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    setIsAdmin(isAdminUser() || hasPageAccess('/admin/learning') || canViewAllLearningData());
    setMounted(true);
  }, []);

  // Fetch available LLM models on mount
  useEffect(() => {
    if (!mounted) return;
    const email = localStorage.getItem('userEmail') || '';
    fetch('/api/admin/learning?action=models', {
      headers: { 'x-user-email': email },
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.models)) {
          setModels(d.models);
          const defaultModel = d.default || 'gemini-flash';
          setSelectedModel(defaultModel);
          checkConnectivity(defaultModel, email);
        }
      })
      .catch(() => { });
  }, [mounted]);

  // Close column picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close filter popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterPopupRef.current && !filterPopupRef.current.contains(e.target as Node)) {
        setFilterPopup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openFilterPopup = useCallback((key: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setFilterPopup((prev) => prev?.key === key ? null : { key, top: rect.bottom + 4, left: Math.max(4, rect.left - 80) });
  }, []);

  const checkConnectivity = useCallback(async (modelId: string, emailOverride?: string) => {
    setConnectivityChecking(true);
    try {
      const email = emailOverride || localStorage.getItem('userEmail') || '';
      const resp = await fetch(
        `/api/admin/learning?action=check-connectivity&model=${encodeURIComponent(modelId)}`,
        { headers: { 'x-user-email': email } },
      );
      const data = await resp.json();
      setModelConnectivity((prev) => ({
        ...prev,
        [modelId]: {
          connected: data.connected === true,
          error: data.error,
          latencyMs: data.latencyMs,
          apiKeyConfigured: data.apiKeyConfigured !== false,
        },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModelConnectivity((prev) => ({
        ...prev,
        [modelId]: { connected: false, error: msg, apiKeyConfigured: false },
      }));
    } finally {
      setConnectivityChecking(false);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const email = localStorage.getItem('userEmail') || '';
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
        sortField,
        sortDir,
      });
      if (search) params.set('search', search);
      if (filterActive !== 'all') params.set('filterActive', filterActive);
      if (filterAI !== 'all') params.set('filterAI', filterAI);
      // Send per-column filters as server-side params for true DB-side filtering
      if (colFilters.queryBy?.trim()) params.set('filterQueryBy', colFilters.queryBy.trim());
      if (colFilters.queryText?.trim()) params.set('filterQueryText', colFilters.queryText.trim());
      // ai/active column filters map to existing filterAI/filterActive if not already set by toolbar
      if (!colFilters.ai?.trim() === false && filterAI === 'all') {
        const fv = colFilters.ai.trim().toLowerCase();
        if (fv === 'yes' || fv === 'enriched') params.set('filterAI', 'enriched');
        else if (fv === 'no' || fv === 'unenriched') params.set('filterAI', 'unenriched');
      }
      if (!colFilters.active?.trim() === false && filterActive === 'all') {
        const fv = colFilters.active.trim().toLowerCase();
        if (fv === 'yes' || fv === 'active') params.set('filterActive', 'active');
        else if (fv === 'no' || fv === 'inactive') params.set('filterActive', 'inactive');
      }

      const resp = await fetch(`/api/admin/learning?${params}`, {
        headers: { 'x-user-email': email },
      });
      const data = await resp.json();

      if (!resp.ok) {
        // API returned an error response
        const errorMsg = data.error || data.details || await resp.text() || 'Failed to load records';
        throw new Error(errorMsg);
      }

      setDbUnavailable(!!data.dbUnavailable);
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setSelectedIds(new Set()); // Clear selection on page change
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load records';
      setError(errorMsg);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterActive, filterAI, sortField, sortDir, colFilters]);

  // Debounce colFilters/search changes to avoid excessive API calls
  const fetchTimerRef = useRef<NodeJS.Timeout>(undefined);
  useEffect(() => {
    if (!mounted || !isAdmin) return;
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => fetchRecords(), 350);
    return () => clearTimeout(fetchTimerRef.current);
  }, [mounted, isAdmin, fetchRecords]);

  // ── Sorting ──────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 inline ml-1" />;
    return sortDir === 'asc' ? (
      <SortAsc className="w-3 h-3 text-indigo-500 inline ml-1" />
    ) : (
      <SortDesc className="w-3 h-3 text-indigo-500 inline ml-1" />
    );
  };

  // ── Per-column filters — now server-side; colFilters changes trigger fetchRecords via debounce ─
  // filteredRecords is now just records (all filtering is done server-side)
  const filteredRecords = records;

  const setColFilter = useCallback((key: string, value: string) => {
    setColFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0); // Reset to page 0 when filter changes
  }, []);

  const clearAllColFilters = useCallback(() => {
    setColFilters({});
    setPage(0);
  }, []);

  const hasAnyColFilter = Object.values(colFilters).some((v) => v.trim().length > 0);

  // ── Row Selection ─────────────────────────────────────────────────────
  const activeRecordIds = useMemo(() => filteredRecords.filter((r) => r.isActive).map((r) => r.id), [filteredRecords]);
  const allActiveSelected =
    activeRecordIds.length > 0 && activeRecordIds.every((id) => selectedIds.has(id));
  const someActiveSelected = activeRecordIds.some((id) => selectedIds.has(id)) && !allActiveSelected;

  const toggleSelectAll = () => {
    if (allActiveSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        activeRecordIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        activeRecordIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleSelect = (id: number, isActive: boolean) => {
    if (!isActive) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Export to CSV ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const visibleCols = columns.filter((c) => c.visible && c.key !== 'select' && c.key !== 'actions');
    const headers = visibleCols.map((c) => c.label).join(',');

    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

    const rows = filteredRecords.map((rec) => {
      return visibleCols
        .map((col) => {
          switch (col.key) {
            case 'id':
              return rec.id;
            case 'queryBy':
              return escapeCsv(rec.queryBy);
            case 'queryText':
              return escapeCsv(rec.queryText);
            case 'initialSuggestion':
              return escapeCsv(rec.initialProductSuggestionText || '');
            case 'intentResponse':
              return escapeCsv(JSON.stringify(rec.intentEngineResponse).slice(0, 300));
            case 'supervisedResponse':
              return escapeCsv(JSON.stringify(rec.supervisedResponse).slice(0, 300));
            case 'aiEnriched':
              return escapeCsv(
                rec.aiEnrichedResponse ? JSON.stringify(rec.aiEnrichedResponse).slice(0, 300) : '',
              );
            case 'ai':
              return rec.enhancedByAI ? 'Yes' : 'No';
            case 'active':
              return rec.isActive ? 'Active' : 'Inactive';
            case 'comments':
              return rec.comments?.length || 0;
            default:
              return '';
          }
        })
        .join(',');
    });

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `self-learning-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRecords.length} records to CSV`);
  };

  // ── Inline Save ───────────────────────────────────────────────────────
  const handleInlineSave = async (id: number) => {
    try {
      const parsed = JSON.parse(editJson);
      const email = localStorage.getItem('userEmail') || '';
      const resp = await fetch('/api/admin/learning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ id, supervisedResponse: parsed }),
      });
      if (!resp.ok) throw new Error('Update failed');
      setEditingId(null);
      showToast('Supervised response updated');
      fetchRecords();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Invalid JSON', 'error');
    }
  };

  // ── Modal Save ────────────────────────────────────────────────────────
  const handleModalSave = async () => {
    if (!modalRecord) return;
    try {
      const parsed = JSON.parse(modalJson);
      const email = localStorage.getItem('userEmail') || '';
      const resp = await fetch('/api/admin/learning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ id: modalRecord.id, supervisedResponse: parsed }),
      });
      if (!resp.ok) throw new Error('Update failed');
      setModalRecord(null);
      showToast('Supervised response updated');
      fetchRecords();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Invalid JSON', 'error');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this learning record? This action cannot be undone.')) return;
    try {
      const email = localStorage.getItem('userEmail') || '';
      const resp = await fetch(`/api/admin/learning?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-email': email },
      });
      if (!resp.ok) throw new Error('Delete failed');
      showToast('Record deleted');
      fetchRecords();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // ── AI Batch Enrichment ───────────────────────────────────────────────
  const handleBatchEnrich = async () => {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const email = localStorage.getItem('userEmail') || '';
      const payload: Record<string, unknown> = {
        action: 'enrich-batch',
        batchSize,
        model: selectedModel,
      };
      if (selectedIds.size > 0) {
        payload.selectedIds = Array.from(selectedIds);
      }

      const resp = await fetch('/api/admin/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const connectivity = data.connectivity;
        if (connectivity) {
          const detail = [
            `Model: ${data.model} (${data.provider})`,
            `Reason: ${connectivity.errorDetail}`,
            connectivity.resolution ? `Fix: ${connectivity.resolution}` : null,
          ]
            .filter(Boolean)
            .join(' — ');
          showToast(detail, 'error');
        } else {
          showToast(data.error || 'Enrichment failed', 'error');
        }
        return;
      }
      setEnrichResult(data.message);
      showToast(data.message);
      checkConnectivity(selectedModel);
      setSelectedIds(new Set());
      fetchRecords();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Enrichment failed', 'error');
    } finally {
      setEnriching(false);
    }
  };

  // ── Toggle isActive ──────────────────────────────────────────────────
  const handleToggleActive = async (id: number, currentValue: boolean) => {
    setTogglingId(id);
    try {
      const email = localStorage.getItem('userEmail') || '';
      const resp = await fetch('/api/admin/learning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ id, isActive: !currentValue }),
      });
      if (!resp.ok) throw new Error('Toggle failed');
      const data = await resp.json();
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...(data.record || { isActive: !currentValue }) } : r)),
      );
      // Remove from selection if deactivated
      if (currentValue) {
        setSelectedIds((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
      showToast(`Record #${id} ${!currentValue ? 'activated' : 'deactivated'}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Toggle failed', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  if (!mounted) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Admin Access Required</h2>
          <p className="text-slate-500">Sign in as an admin or learning-support user to access this dashboard.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);
  const isColVisible = (key: string) => columns.find((c) => c.key === key)?.visible ?? true;
  const visibleColCount = columns.filter((c) => c.visible).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20 dark:from-slate-900 dark:via-indigo-950/20 dark:to-purple-950/20">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white shadow-lg">
              <Brain className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Self-Learning Dashboard
              </h1>
              <p className="text-sm text-slate-500">
                Reinforcement &amp; supervised learning for Smart Intent Engine &mdash; {total} records
                {records.length > 0 && (() => {
                  const newest = records.reduce((max, r) => r.createdAt > max ? r.createdAt : max, records[0].createdAt);
                  const ageHrs = Math.round((Date.now() - new Date(newest).getTime()) / 3600_000);
                  return (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${ageHrs > 24 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      Last captured: {ageHrs < 1 ? 'just now' : ageHrs < 24 ? `${ageHrs}h ago` : `${Math.round(ageHrs / 24)}d ago`}
                    </span>
                  );
                })()}
                {selectedIds.size > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                    {selectedIds.size} selected
                  </span>
                )}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search queries..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm transition-colors ${showFilters
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(filterActive !== 'all' || filterAI !== 'all') && (
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            )}
          </button>

          {/* Column selector */}
          <div className="relative" ref={columnPickerRef}>
            <button
              onClick={() => setShowColumnPicker((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Columns className="w-4 h-4" /> Columns
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl p-3 min-w-[200px]">
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Show / Hide Columns
                </p>
                {columns
                  .filter((c) => c.key !== 'select' && c.key !== 'actions' && c.key !== 'id')
                  .map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 px-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() =>
                          setColumns((prev) =>
                            prev.map((c) => (c.key === col.key ? { ...c, visible: !c.visible } : c)),
                          )
                        }
                        className="rounded text-indigo-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{col.label}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          {/* Page size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchRecords}
            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Clear col filters — visible only when active */}
          {hasAnyColFilter && (
            <button
              onClick={clearAllColFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-50 border border-indigo-300 text-indigo-700 rounded-xl text-sm hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300"
              title="Clear all column filters"
            >
              <X className="w-3.5 h-3.5" /> Clear col filters
            </button>
          )}
        </div>

        {/* ── Filter Panel ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="flex flex-wrap gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">
                    Active Status
                  </label>
                  <div className="flex gap-1">
                    {(['all', 'active', 'inactive'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setFilterActive(v);
                          setPage(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterActive === v
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">
                    AI Enrichment
                  </label>
                  <div className="flex gap-1">
                    {(['all', 'enriched', 'unenriched'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setFilterAI(v);
                          setPage(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterAI === v
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {(filterActive !== 'all' || filterAI !== 'all') && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setFilterActive('all');
                        setFilterAI('all');
                        setPage(0);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-3 h-3" /> Clear filters
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LLM Model + Enrich Panel ─────────────────────────────────── */}
        <div className="flex flex-wrap items-start gap-3 mb-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 flex-shrink-0 mt-0.5">
            <Brain className="w-4 h-4 text-purple-500" />
            LLM Model:
          </div>

          {/* Model dropdown */}
          <div className="relative min-w-[240px] max-w-[380px]">
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                checkConnectivity(e.target.value);
              }}
              className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
            >
              {models.length === 0 ? (
                <option value="gemini-flash">Gemini 2.0 Flash (Google) — loading…</option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.provider}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Connectivity badge */}
          {connectivityChecking ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
            </span>
          ) : modelConnectivity[selectedModel] ? (
            modelConnectivity[selectedModel].connected ? (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                title={`Latency: ${modelConnectivity[selectedModel].latencyMs ?? '—'}ms`}
              >
                <Wifi className="w-3.5 h-3.5" /> Connected
                {modelConnectivity[selectedModel].latencyMs != null && (
                  <span className="text-green-500 ml-1">
                    ({modelConnectivity[selectedModel].latencyMs}ms)
                  </span>
                )}
              </span>
            ) : (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"
                title={modelConnectivity[selectedModel].error || 'Unavailable'}
              >
                <WifiOff className="w-3.5 h-3.5" />
                {modelConnectivity[selectedModel].apiKeyConfigured ? 'API Error' : 'Key Missing'}
              </span>
            )
          ) : (
            <button
              onClick={() => checkConnectivity(selectedModel)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
            >
              <Wifi className="w-3.5 h-3.5" /> Check
            </button>
          )}

          {/* Connectivity error */}
          {modelConnectivity[selectedModel] &&
            !modelConnectivity[selectedModel].connected &&
            modelConnectivity[selectedModel].error && (
              <p className="w-full text-xs text-red-600 flex items-start gap-1 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {modelConnectivity[selectedModel].error}
              </p>
            )}

          {/* Batch size + Enrich button on the right */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <label className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Batch Size:
            </label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="appearance-none px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
            >
              {BATCH_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              onClick={handleBatchEnrich}
              disabled={enriching}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-purple-600/20 whitespace-nowrap"
            >
              {enriching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {enriching
                ? 'Enriching...'
                : selectedIds.size > 0
                  ? `Enrich Selected (${selectedIds.size})`
                  : `AI Batch Enrich (${batchSize})`}
            </button>
          </div>
        </div>

        {enrichResult && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
            <Zap className="w-4 h-4" /> {enrichResult}
          </div>
        )}

        {/* Criteria notice */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Auto Batch Enrich criteria:</strong> Active = Yes &amp;&amp; AI Enriched = No &amp;&amp;
            Created in last 30 days. Select specific rows (active only) to override the automatic
            selection with Enrich Selected.
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {dbUnavailable && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl text-sm text-red-800 dark:text-red-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-200 mb-0.5">Database Connection Error</p>
              <p className="text-red-700 dark:text-red-400 text-xs leading-relaxed">Cannot connect to PostgreSQL. Please check your DATABASE_URL environment variable and ensure PostgreSQL is running. Verify the connection string format: postgresql://user:password@host:port/database</p>
            </div>
          </div>
        )}

        {/* ── Data Grid ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                  {/* Select All */}
                  {isColVisible('select') && (
                    <th className="px-3 py-3 w-[44px]">
                      <button
                        onClick={toggleSelectAll}
                        title={allActiveSelected ? 'Deselect all active' : 'Select all active'}
                        className="flex items-center justify-center w-5 h-5 hover:opacity-70 transition-opacity"
                      >
                        {allActiveSelected ? (
                          <CheckSquare className="w-[18px] h-[18px] text-indigo-600" />
                        ) : someActiveSelected ? (
                          <MinusSquare className="w-[18px] h-[18px] text-indigo-400" />
                        ) : (
                          <Square className="w-[18px] h-[18px] text-slate-400" />
                        )}
                      </button>
                    </th>
                  )}
                  {isColVisible('id') && (
                    <th
                      className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[70px] cursor-pointer select-none"
                      onClick={() => handleSort('id')}
                    >
                      ID <SortIcon field="id" />
                    </th>
                  )}
                  {isColVisible('queryBy') && (
                    <th
                      className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[110px] cursor-pointer select-none"
                      onClick={() => handleSort('queryBy')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Query By</span>
                        <SortIcon field="queryBy" />
                        <button
                          onClick={(e) => openFilterPopup('queryBy', e)}
                          title="Filter by user"
                          className={`p-0.5 rounded transition-colors ${colFilters['queryBy'] ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  )}
                  {isColVisible('queryText') && (
                    <th
                      className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[200px] cursor-pointer select-none"
                      onClick={() => handleSort('queryText')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Query Text</span>
                        <SortIcon field="queryText" />
                        <button
                          onClick={(e) => openFilterPopup('queryText', e)}
                          title="Filter by query text"
                          className={`p-0.5 rounded transition-colors ${colFilters['queryText'] ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  )}
                  {isColVisible('initialSuggestion') && (
                    <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[200px]">
                      <div className="flex items-center gap-1">
                        <span>Initial Suggestion</span>
                        <button
                          onClick={(e) => openFilterPopup('initialSuggestion', e)}
                          title="Filter by initial suggestion"
                          className={`p-0.5 rounded transition-colors ${colFilters['initialSuggestion'] ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  )}
                  {isColVisible('intentResponse') && (
                    <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[130px]">
                      Intent Response
                    </th>
                  )}
                  {isColVisible('supervisedResponse') && (
                    <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[200px]">
                      Supervised Response
                    </th>
                  )}
                  {isColVisible('aiEnriched') && (
                    <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[130px]">
                      AI Enriched
                    </th>
                  )}
                  {isColVisible('ai') && (
                    <th
                      className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[60px] cursor-pointer select-none"
                      onClick={() => handleSort('enhancedByAI')}
                    >
                      <div className="flex items-center gap-1">
                        <span>AI?</span>
                        <SortIcon field="enhancedByAI" />
                        <button
                          onClick={(e) => openFilterPopup('ai', e)}
                          title="Filter by AI enrichment"
                          className={`p-0.5 rounded transition-colors ${colFilters['ai'] ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  )}
                  {isColVisible('active') && (
                    <th
                      className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[80px] cursor-pointer select-none"
                      onClick={() => handleSort('isActive')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Active</span>
                        <SortIcon field="isActive" />
                        <button
                          onClick={(e) => openFilterPopup('active', e)}
                          title="Filter by active status"
                          className={`p-0.5 rounded transition-colors ${colFilters['active'] ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  )}
                  {isColVisible('comments') && (
                    <th className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[90px]">
                      Comments
                    </th>
                  )}
                  {isColVisible('actions') && (
                    <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 w-[110px]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={visibleColCount} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      <span className="text-slate-400">Loading records...</span>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColCount} className="text-center py-12 text-slate-400">
                      {hasAnyColFilter ? 'No records match column filters.' : 'No learning records found. Chat queries will appear here automatically.'}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const isSelected = selectedIds.has(rec.id);
                    return (
                      <tr
                        key={rec.id}
                        className={`border-b border-slate-100 dark:border-slate-700 transition-colors ${isSelected
                          ? 'bg-indigo-50/50 dark:bg-indigo-900/10'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30'
                          } ${!rec.isActive ? 'opacity-60' : ''}`}
                      >
                        {/* Checkbox */}
                        {isColVisible('select') && (
                          <td className="px-3 py-3">
                            <button
                              onClick={() => toggleSelect(rec.id, rec.isActive)}
                              disabled={!rec.isActive}
                              title={!rec.isActive ? 'Inactive rows cannot be selected for enrichment' : ''}
                              className={`flex items-center justify-center w-5 h-5 transition-opacity ${!rec.isActive
                                ? 'opacity-30 cursor-not-allowed'
                                : 'hover:opacity-70 cursor-pointer'
                                }`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-[18px] h-[18px] text-indigo-600" />
                              ) : (
                                <Square className="w-[18px] h-[18px] text-slate-400" />
                              )}
                            </button>
                          </td>
                        )}
                        {isColVisible('id') && (
                          <td className="px-3 py-3 font-mono text-xs text-slate-500">{rec.id}</td>
                        )}
                        {isColVisible('queryBy') && (
                          <td
                            className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[110px]"
                            title={rec.queryBy}
                          >
                            <span className="truncate block">{friendlyUserName(rec.queryBy)}</span>
                          </td>
                        )}
                        {isColVisible('queryText') && (
                          <td className="px-3 py-3">
                            <span
                              className="text-slate-800 dark:text-white font-medium line-clamp-2 block"
                              title={rec.queryText}
                            >
                              {rec.queryText}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {new Date(rec.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </td>
                        )}
                        {isColVisible('initialSuggestion') && (
                          <td className="px-3 py-3 text-xs text-slate-500 max-w-[200px]">
                            <span className="line-clamp-3">
                              {rec.initialProductSuggestionText || '—'}
                            </span>
                          </td>
                        )}
                        {isColVisible('intentResponse') && (
                          <td className="px-3 py-3">
                            <button
                              onClick={() => {
                                setModalRecord(rec);
                                setModalJson(JSON.stringify(rec.supervisedResponse, null, 2));
                                setModalTab('intent');
                              }}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Eye className="w-3 h-3" /> View JSON
                            </button>
                          </td>
                        )}
                        {isColVisible('supervisedResponse') && (
                          <td className="px-3 py-3">
                            {editingId === rec.id ? (
                              <div className="flex flex-col gap-1">
                                <textarea
                                  value={editJson}
                                  onChange={(e) => setEditJson(e.target.value)}
                                  rows={4}
                                  className="w-full text-[11px] font-mono border border-indigo-300 rounded-lg p-2 bg-indigo-50 dark:bg-slate-700 dark:border-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-y"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleInlineSave(rec.id)}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-[10px] hover:bg-green-700"
                                  >
                                    <Save className="w-3 h-3" /> Save
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="flex items-center gap-1 px-2 py-1 bg-slate-400 text-white rounded text-[10px] hover:bg-slate-500"
                                  >
                                    <X className="w-3 h-3" /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <pre className="text-[10px] font-mono text-slate-500 max-w-[200px] max-h-[60px] overflow-hidden whitespace-pre-wrap line-clamp-3">
                                {JSON.stringify(rec.supervisedResponse, null, 1).slice(0, 200)}
                              </pre>
                            )}
                          </td>
                        )}
                        {isColVisible('aiEnriched') && (
                          <td className="px-3 py-3">
                            {rec.aiEnrichedResponse ? (
                              <button
                                onClick={() => setAiViewRecord(rec)}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                              >
                                <Eye className="w-3 h-3" /> View AI JSON
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        )}
                        {isColVisible('ai') && (
                          <td className="px-3 py-3 text-center">
                            {rec.enhancedByAI ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium">
                                <Sparkles className="w-2.5 h-2.5" /> Yes
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">No</span>
                            )}
                          </td>
                        )}
                        {isColVisible('active') && (
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => handleToggleActive(rec.id, rec.isActive)}
                              disabled={togglingId === rec.id}
                              title={
                                rec.isActive
                                  ? 'Active — click to deactivate'
                                  : 'Inactive — click to activate'
                              }
                            >
                              {togglingId === rec.id ? (
                                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                              ) : rec.isActive ? (
                                <ToggleRight className="w-6 h-6 text-green-600 hover:text-green-700" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-400 hover:text-slate-500" />
                              )}
                            </button>
                          </td>
                        )}
                        {isColVisible('comments') && (
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => setCommentsRecord(rec)}
                              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 font-medium"
                              title={`${rec.comments?.length || 0} audit entries`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="text-[10px]">{rec.comments?.length || 0}</span>
                            </button>
                          </td>
                        )}
                        {isColVisible('actions') && (
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingId(rec.id);
                                  setEditJson(JSON.stringify(rec.supervisedResponse, null, 2));
                                }}
                                className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg text-indigo-500"
                                title="Inline edit supervised response"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setModalRecord(rec);
                                  setModalJson(JSON.stringify(rec.supervisedResponse, null, 2));
                                  setModalTab('edit');
                                }}
                                className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-500"
                                title="Edit in full modal"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(rec.id)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {total > 0 && (
                <span>
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
                </span>
              )}
              {selectedIds.size > 0 && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                  {selectedIds.size} row{selectedIds.size > 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Smart page number buttons */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i;
                else if (page < 3) pageNum = i;
                else if (page >= totalPages - 3) pageNum = totalPages - 5 + i;
                else pageNum = page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors ${page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Edit Supervised Response + Tabs ─────────────────────── */}
      <AnimatePresence>
        {modalRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setModalRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Record #{modalRecord.id}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5 italic">&ldquo;{modalRecord.queryText}&rdquo;</p>
                </div>
                <button
                  onClick={() => setModalRecord(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
                {(['edit', 'intent', 'ai'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setModalTab(tab)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${modalTab === tab
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                  >
                    {tab === 'edit'
                      ? 'Supervised Response'
                      : tab === 'intent'
                        ? 'Intent Engine'
                        : 'AI Enriched'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {modalTab === 'edit' && (
                  <div>
                    <label className="block text-xs font-semibold text-indigo-600 mb-1.5 uppercase tracking-wide">
                      Supervised Response (editable)
                    </label>
                    <textarea
                      value={modalJson}
                      onChange={(e) => setModalJson(e.target.value)}
                      rows={16}
                      className="w-full font-mono text-[12px] border border-indigo-300 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                      spellCheck={false}
                    />
                  </div>
                )}
                {modalTab === 'intent' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                      Original Intent Engine Response (read-only)
                    </label>
                    <pre className="text-[11px] font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-4 max-h-[55vh] overflow-auto whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                      {JSON.stringify(modalRecord.intentEngineResponse, null, 2)}
                    </pre>
                  </div>
                )}
                {modalTab === 'ai' && (
                  <div>
                    <label className="block text-xs font-semibold text-purple-500 mb-1.5 uppercase tracking-wide">
                      AI Enriched Response (read-only)
                    </label>
                    {modalRecord.aiEnrichedResponse ? (
                      <pre className="text-[11px] font-mono bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 max-h-[55vh] overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(modalRecord.aiEnrichedResponse, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No AI enrichment yet. Use the Batch Enrich button.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setModalRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                {modalTab === 'edit' && (
                  <button
                    onClick={handleModalSave}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: Audit Log (Comments) ───────────────────────────────── */}
      <AnimatePresence>
        {commentsRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setCommentsRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-500" />
                  Audit Log — Record #{commentsRecord.id}
                </h3>
                <button
                  onClick={() => setCommentsRecord(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {!commentsRecord.comments || commentsRecord.comments.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No audit log entries yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...commentsRecord.comments].reverse().map((comment, i) => {
                      const actionInfo = ACTION_LABELS[comment.action] || {
                        label: comment.action,
                        color: 'text-slate-600 bg-slate-50 border-slate-200',
                      };
                      return (
                        <div
                          key={i}
                          className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30 p-4"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionInfo.color}`}
                            >
                              {actionInfo.label}
                            </span>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-shrink-0">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(comment.timestamp).toLocaleString('en-IN', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {comment.userId ? friendlyUserName(comment.userId) : 'system'}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                            {comment.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                <span className="text-xs text-slate-500">
                  {commentsRecord.comments?.length || 0} entries (append-only, newest first)
                </span>
                <button
                  onClick={() => setCommentsRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: AI Enriched Response View ─────────────────────────── */}
      <AnimatePresence>
        {aiViewRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setAiViewRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI Enriched Response — #{aiViewRecord.id}
                </h3>
                <button
                  onClick={() => setAiViewRecord(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-purple-500 mb-1.5 uppercase tracking-wide">
                    AI Enriched Response (read-only)
                  </label>
                  <pre className="text-[11px] font-mono bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 max-h-[45vh] overflow-auto whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                    {JSON.stringify(aiViewRecord.aiEnrichedResponse, null, 2)}
                  </pre>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Original Intent Engine Response (read-only)
                  </label>
                  <pre className="text-[11px] font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-4 max-h-[200px] overflow-auto whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                    {JSON.stringify(aiViewRecord.intentEngineResponse, null, 2)}
                  </pre>
                </div>
              </div>
              <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setAiViewRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Column Filter Popup (floating, position:fixed) ─────────── */}
      {filterPopup && (
        <div
          ref={filterPopupRef}
          data-testid="col-filter-popup"
          style={{ position: 'fixed', top: filterPopup.top, left: filterPopup.left, zIndex: 9999 }}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl p-3 min-w-[200px]"
        >
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex-1">
              Filter — {columns.find((c) => c.key === filterPopup.key)?.label || filterPopup.key}
            </p>
            {colFilters[filterPopup.key] && (
              <button
                onClick={() => { setColFilter(filterPopup.key, ''); setFilterPopup(null); }}
                className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap"
              >
                ✕ Clear
              </button>
            )}
          </div>
          {filterPopup.key === 'ai' ? (
            <select
              autoFocus
              value={colFilters['ai'] || ''}
              onChange={(e) => { setColFilter('ai', e.target.value); setFilterPopup(null); }}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : filterPopup.key === 'active' ? (
            <select
              autoFocus
              value={colFilters['active'] || ''}
              onChange={(e) => { setColFilter('active', e.target.value); setFilterPopup(null); }}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          ) : (
            <input
              autoFocus
              type="text"
              value={colFilters[filterPopup.key] || ''}
              onChange={(e) => setColFilter(filterPopup.key, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setFilterPopup(null); }}
              placeholder={`Filter ${columns.find((c) => c.key === filterPopup.key)?.label || filterPopup.key}...`}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400"
            />
          )}
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="break-words">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, ArrowUpRight, ArrowDownLeft, Settings, Shield, Brain,
  Loader2, AlertCircle, CheckCircle, RefreshCw, IndianRupee, TrendingUp,
  TrendingDown, Clock, Eye, EyeOff, ChevronDown, Lock, Unlock, Zap,
  CreditCard, Landmark, Smartphone, QrCode, Building2, ChevronRight,
  History, PieChart, Download, Send, Receipt, Bell, ArrowLeft,
  Banknote, ShieldCheck, Repeat, Gift, X, Search, AlertOctagon, Activity,
} from 'lucide-react';
import Link from 'next/link';
import { notifySpendingLimitChanged } from '@/lib/notifications';
import {
  getAutoCheckoutSettings, saveAutoCheckoutSettings, fromWalletForm, toWalletForm,
  onAutoCheckoutSettingsChanged,
} from '@/lib/auto-checkout-settings';

// --- Types ---

interface WalletData {
  id: number; userId: number; balance: number; totalAdded: number; totalSpent: number;
  maxPerOrder: number | null; dailyLimit: number | null; dailySpentToday: number;
  isAiAuthorized: boolean; aiSpendingLimit: number | null;
  isActive: boolean; isLocked: boolean; lockReason: string | null;
}

interface Transaction {
  id: number; type: string; amount: number; description: string;
  status: string; balanceBefore: number; balanceAfter: number;
  orderId: number | null; createdAt: string;
}

type WalletTab = 'overview' | 'add' | 'send' | 'history' | 'settings';

// --- Utilities ---

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// --- Sub-Components ---

function StatCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : color === 'green' ? 'bg-green-100 dark:bg-green-900/30' : color === 'red' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
          <Icon className={`w-4 h-4 ${color === 'blue' ? 'text-blue-600 dark:text-blue-400' : color === 'green' ? 'text-green-600 dark:text-green-400' : color === 'red' ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function QuickAmountButton({ amount, onClick, selected }: { amount: number; onClick: (a: number) => void; selected: boolean }) {
  return (
    <button type="button" onClick={() => onClick(amount)}
      className={`px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-blue-300'
      }`}>
      {formatCurrency(amount)}
    </button>
  );
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [tab, setTab] = useState<WalletTab>('overview');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add money form
  const [addAmount, setAddAmount] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('sbi');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [mockBypass, setMockBypass] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('walletMockBypass');
      return saved !== null ? saved === 'true' : (process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === 'true' && process.env.NODE_ENV === 'development');
    }
    return false;
  });
  const showMockToggle = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === 'true';

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    maxPerOrder: '', dailyLimit: '', isAiAuthorized: false, aiSpendingLimit: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Transactions pagination & filter
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [txnOffset, setTxnOffset] = useState(0);
  const [hasMoreTxns, setHasMoreTxns] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [txnFilter, setTxnFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [txnSearch, setTxnSearch] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const userEmail = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : '';

  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (userEmail) h['x-user-email'] = userEmail.toLowerCase();
    return h;
  };

  const loadWallet = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch('/api/wallet', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load wallet');
      const data = await res.json();
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
      setAllTransactions(data.transactions || []);
      setSettingsForm({
        maxPerOrder: data.wallet.maxPerOrder ? String(data.wallet.maxPerOrder) : '',
        dailyLimit: data.wallet.dailyLimit ? String(data.wallet.dailyLimit) : '',
        isAiAuthorized: data.wallet.isAiAuthorized || false,
        aiSpendingLimit: data.wallet.aiSpendingLimit ? String(data.wallet.aiSpendingLimit) : '',
      });
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  // Sync auto-checkout settings from shared store on mount + listen for cross-page updates
  useEffect(() => {
    const shared = getAutoCheckoutSettings();
    setSettingsForm(prev => ({
      ...prev,
      ...toWalletForm(shared),
    }));
    const unsub = onAutoCheckoutSettingsChanged((settings) => {
      setSettingsForm(prev => ({
        ...prev,
        ...toWalletForm(settings),
      }));
    });
    return unsub;
  }, []);

  const validatePaymentDetails = (): boolean => {
    if (mockBypass) return true;
    const errors: Record<string, string> = {};
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) errors.amount = 'Enter a valid amount';
    if (amount > 1000000) errors.amount = 'Maximum ₹10,00,000 per transaction';

    if (paymentMethod === 'upi') {
      if (!upiId || !upiId.includes('@') || upiId.length < 5) errors.upiId = 'Enter a valid UPI ID (e.g., name@upi)';
    } else if (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') {
      const digits = cardNumber.replace(/\s/g, '');
      if (digits.length < 15 || digits.length > 19) errors.cardNumber = 'Card number must be 15-19 digits';
      if (!cardName || cardName.trim().length < 2) errors.cardName = 'Enter cardholder name';
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) errors.cardExpiry = 'Enter valid expiry (MM/YY)';
      else {
        const [mm, yy] = cardExpiry.split('/').map(Number);
        if (mm < 1 || mm > 12) errors.cardExpiry = 'Invalid month';
        else {
          const now = new Date();
          const expDate = new Date(2000 + yy, mm);
          if (expDate < now) errors.cardExpiry = 'Card has expired';
        }
      }
      if (cardCvv.length < 3 || cardCvv.length > 4) errors.cardCvv = 'CVV must be 3-4 digits';
    } else if (paymentMethod === 'net_banking') {
      if (!bankName) errors.bankName = 'Select a bank';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddFunds = async () => {
    if (!validatePaymentDetails()) return;
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) return;
    setIsAdding(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action: 'add_funds', amount, description: `Added via ${paymentMethod.replace('_', ' ').toUpperCase()}` }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setSuccessMsg(`${formatCurrency(amount)} added successfully!`);
      setTimeout(() => setSuccessMsg(null), 5000);
      setAddAmount('');
      setTab('overview');
      loadWallet();
    } catch (e: any) { setError(e.message); setTimeout(() => setError(null), 5000); }
    setIsAdding(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      // Track changes for notification
      const changes: { field: string; oldValue: string; newValue: string }[] = [];
      if (wallet) {
        if (String(wallet.maxPerOrder || '') !== settingsForm.maxPerOrder)
          changes.push({ field: 'Max Per Order', oldValue: wallet.maxPerOrder ? formatCurrency(wallet.maxPerOrder) : 'No limit', newValue: settingsForm.maxPerOrder ? formatCurrency(Number(settingsForm.maxPerOrder)) : 'No limit' });
        if (String(wallet.dailyLimit || '') !== settingsForm.dailyLimit)
          changes.push({ field: 'Daily Limit', oldValue: wallet.dailyLimit ? formatCurrency(wallet.dailyLimit) : 'No limit', newValue: settingsForm.dailyLimit ? formatCurrency(Number(settingsForm.dailyLimit)) : 'No limit' });
        if (wallet.isAiAuthorized !== settingsForm.isAiAuthorized)
          changes.push({ field: 'AI Auto-Checkout', oldValue: wallet.isAiAuthorized ? 'Enabled' : 'Disabled', newValue: settingsForm.isAiAuthorized ? 'Enabled' : 'Disabled' });
        if (String(wallet.aiSpendingLimit || '') !== settingsForm.aiSpendingLimit)
          changes.push({ field: 'AI Spending Limit', oldValue: wallet.aiSpendingLimit ? formatCurrency(wallet.aiSpendingLimit) : 'Not set', newValue: settingsForm.aiSpendingLimit ? formatCurrency(Number(settingsForm.aiSpendingLimit)) : 'Not set' });
      }

      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          action: 'update_settings',
          maxPerOrder: settingsForm.maxPerOrder || null,
          dailyLimit: settingsForm.dailyLimit || null,
          isAiAuthorized: settingsForm.isAiAuthorized,
          aiSpendingLimit: settingsForm.aiSpendingLimit || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setSuccessMsg('Settings saved successfully! Notifications sent to your email, WhatsApp & SMS.');
      setTimeout(() => setSuccessMsg(null), 6000);

      // Send multi-channel notifications for spending limit changes
      if (changes.length > 0) {
        notifySpendingLimitChanged(changes, token).catch(() => {});
      }

      // Sync to shared auto-checkout settings store
      saveAutoCheckoutSettings(fromWalletForm(settingsForm));

      loadWallet();
    } catch (e: any) { setError(e.message); setTimeout(() => setError(null), 5000); }
    setSavingSettings(false);
  };

  const loadMoreTransactions = async () => {
    setLoadingMore(true);
    const newOffset = txnOffset + 20;
    try {
      const res = await fetch(`/api/wallet/transactions?limit=20&offset=${newOffset}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transactions.length < 20) setHasMoreTxns(false);
        setAllTransactions(prev => [...prev, ...data.transactions]);
        setTxnOffset(newOffset);
      }
    } catch {}
    setLoadingMore(false);
  };

  // --- Derived data ---

  const filteredTxns = useMemo(() => {
    let items = allTransactions;
    if (txnFilter !== 'all') items = items.filter((t) => t.type === txnFilter);
    if (txnSearch) {
      const q = txnSearch.toLowerCase();
      items = items.filter((t) => t.description.toLowerCase().includes(q));
    }
    return items;
  }, [allTransactions, txnFilter, txnSearch]);

  const spentPercent = wallet?.dailyLimit ? Math.min(100, (wallet.dailySpentToday / wallet.dailyLimit) * 100) : 0;
  const weeklySpend = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return allTransactions
      .filter((t) => t.type === 'debit' && new Date(t.createdAt).getTime() > weekAgo)
      .reduce((s, t) => s + t.amount, 0);
  }, [allTransactions]);

  const creditCount = allTransactions.filter((t) => t.type === 'credit').length;
  const debitCount = allTransactions.filter((t) => t.type === 'debit').length;

  // --- Auth guard ---

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <div className="text-center">
          <Wallet className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Sign in to access your wallet</h2>
          <Link href="/signin" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors inline-block">Sign In</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 dark:from-slate-900 dark:via-blue-950/30 dark:to-indigo-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Digital Wallet</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Secure payments, AI auto-checkout & spending control</p>
            </div>
            <Link href="/account" className="hidden sm:flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <ArrowLeft className="w-4 h-4" /> Account
            </Link>
          </div>
        </motion.div>

        {/* Banners */}
        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-3.5 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">{successMsg}</span>
              <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3.5 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Balance Hero Card */}
        {wallet && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white p-5 sm:p-6 shadow-2xl shadow-blue-600/30">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-36 translate-x-36" />
            <div className="absolute bottom-0 left-0 w-52 h-52 bg-white/5 rounded-full translate-y-28 -translate-x-28" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-200" />
                  <span className="text-sm font-medium text-blue-200">Available Balance</span>
                  {wallet.isLocked && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/30 rounded-full text-xs text-red-200">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowBalance(!showBalance)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    {showBalance ? <EyeOff className="w-4 h-4 text-blue-200" /> : <Eye className="w-4 h-4 text-blue-200" />}
                  </button>
                  <button onClick={loadWallet} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <RefreshCw className="w-4 h-4 text-blue-200" />
                  </button>
                </div>
              </div>
              <p className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
                {showBalance ? formatCurrency(wallet.balance) : '\u20B9 \u2022\u2022\u2022\u2022\u2022\u2022'}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-blue-200 text-xs mb-1"><TrendingUp className="w-3 h-3" /> Total Added</div>
                  <p className="text-sm font-semibold">{showBalance ? formatCurrency(wallet.totalAdded) : '\u2022\u2022\u2022\u2022'}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-blue-200 text-xs mb-1"><TrendingDown className="w-3 h-3" /> Total Spent</div>
                  <p className="text-sm font-semibold">{showBalance ? formatCurrency(wallet.totalSpent) : '\u2022\u2022\u2022\u2022'}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-blue-200 text-xs mb-1"><Clock className="w-3 h-3" /> Today</div>
                  <p className="text-sm font-semibold">{showBalance ? formatCurrency(wallet.dailySpentToday) : '\u2022\u2022\u2022\u2022'}</p>
                </div>
              </div>
              {wallet.dailyLimit && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-blue-200 mb-1">
                    <span>Daily Limit</span>
                    <span>{formatCurrency(wallet.dailySpentToday)} / {formatCurrency(wallet.dailyLimit)}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${spentPercent > 80 ? 'bg-red-400' : spentPercent > 50 ? 'bg-amber-400' : 'bg-white'}`} style={{ width: `${spentPercent}%` }} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 overflow-x-auto">
          {([
            { id: 'overview' as WalletTab, label: 'Overview', icon: PieChart },
            { id: 'add' as WalletTab, label: 'Add Money', icon: Plus },
            { id: 'send' as WalletTab, label: 'Transfer', icon: Send },
            { id: 'history' as WalletTab, label: 'History', icon: History },
            { id: 'settings' as WalletTab, label: 'Settings', icon: Settings },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                tab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ====== TAB: Overview ====== */}
        {tab === 'overview' && wallet && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Banknote} label="This Week" value={formatCurrency(weeklySpend)} color="blue" sub={`${debitCount} transactions`} />
              <StatCard icon={TrendingUp} label="Deposits" value={String(creditCount)} color="green" sub="Total credits" />
              <StatCard icon={TrendingDown} label="Payments" value={String(debitCount)} color="red" sub="Total debits" />
              <StatCard icon={ShieldCheck} label="AI Limit" value={wallet.aiSpendingLimit ? formatCurrency(wallet.aiSpendingLimit) : 'Not set'} color="indigo" sub={wallet.isAiAuthorized ? 'Active' : 'Inactive'} />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Plus, label: 'Add Money', color: 'green', action: () => setTab('add'), href: undefined },
                { icon: Send, label: 'Transfer', color: 'blue', action: () => setTab('send'), href: undefined },
                { icon: Settings, label: 'Limits', color: 'purple', action: () => setTab('settings'), href: undefined },
                { icon: History, label: 'History', color: 'slate', action: () => setTab('history'), href: undefined },
                { icon: AlertOctagon, label: 'Failed Orders', color: 'red', action: undefined, href: '/failed-orders' },
              ].map(({ icon: Icon, label, color, action, href }) => {
                const cls = `flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group`;
                const iconBg = color === 'green' ? 'bg-green-100 dark:bg-green-900/30' : color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' : color === 'red' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-900/30';
                const iconColor = color === 'green' ? 'text-green-600 dark:text-green-400' : color === 'blue' ? 'text-blue-600 dark:text-blue-400' : color === 'purple' ? 'text-purple-600 dark:text-purple-400' : color === 'red' ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400';
                if (href) {
                  return (
                    <Link key={label} href={href} className={cls}>
                      <div className={`p-2 ${iconBg} rounded-lg group-hover:scale-110 transition-transform`}><Icon className={`w-5 h-5 ${iconColor}`} /></div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
                    </Link>
                  );
                }
                return (
                  <button key={label} type="button" onClick={action} className={cls}>
                    <div className={`p-2 ${iconBg} rounded-lg group-hover:scale-110 transition-transform`}><Icon className={`w-5 h-5 ${iconColor}`} /></div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* AI Authorization Status */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${wallet.isAiAuthorized ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
                    {wallet.isAiAuthorized ? <Unlock className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      AI Auto-Checkout: {wallet.isAiAuthorized ? 'Authorized' : 'Not Authorized'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {wallet.isAiAuthorized
                        ? `AI can spend up to ${wallet.aiSpendingLimit ? formatCurrency(wallet.aiSpendingLimit) : 'your per-order limit'} per order via wallet`
                        : 'Enable in settings to allow AI agent auto-checkout'}
                    </p>
                  </div>
                </div>
                {wallet.isAiAuthorized && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                    <Zap className="w-3 h-3" /> Active
                  </span>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" /> Recent Activity
                </h3>
                <button onClick={() => setTab('history')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {allTransactions.slice(0, 5).map((txn) => (
                  <div key={txn.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${txn.type === 'credit' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                        {txn.type === 'credit' ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{txn.description}</p>
                        <p className="text-xs text-slate-400">{shortDate(txn.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </p>
                      <p className="text-[11px] text-slate-400">Bal: {formatCurrency(txn.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
                {allTransactions.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <Wallet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <Shield className="w-4 h-4" />
              <span>256-bit SSL Encryption - RBI Regulated - PCI-DSS Compliant</span>
            </div>
          </div>
        )}

        {/* ====== TAB: Add Money ====== */}
        {tab === 'add' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" /> Add Money to Wallet
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Fund your wallet for instant checkouts and AI auto-purchases</p>

              {/* Dev toggle */}
              {showMockToggle && (
                <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={mockBypass}
                      onChange={e => { setMockBypass(e.target.checked); localStorage.setItem('walletMockBypass', String(e.target.checked)); setValidationErrors({}); }}
                      className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                    <span className="text-xs font-medium text-amber-800">Skip payment validation (Dev mode)</span>
                  </label>
                </div>
              )}

              {/* Quick Amounts */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  {[500, 1000, 2000, 5000, 10000, 25000, 50000].map(amt => (
                    <QuickAmountButton key={amt} amount={amt} onClick={(a) => setAddAmount(String(a))} selected={addAmount === String(amt)} />
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Amount</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" value={addAmount} onChange={e => { setAddAmount(e.target.value); setValidationErrors(prev => { const n = {...prev}; delete n.amount; return n; }); }} placeholder="Enter amount"
                    className={`w-full pl-9 pr-4 py-3 border rounded-xl bg-white dark:bg-slate-700 text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none ${validationErrors.amount ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />
                </div>
                {validationErrors.amount && <p className="text-xs text-red-500 mt-1">{validationErrors.amount}</p>}
              </div>

              {/* Payment Method */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'upi', label: 'UPI', icon: QrCode, color: 'text-green-600' },
                    { id: 'credit_card', label: 'Credit Card', icon: CreditCard, color: 'text-blue-600' },
                    { id: 'debit_card', label: 'Debit Card', icon: CreditCard, color: 'text-indigo-600' },
                    { id: 'net_banking', label: 'Net Banking', icon: Landmark, color: 'text-purple-600' },
                  ].map(pm => (
                    <button key={pm.id} type="button" onClick={() => setPaymentMethod(pm.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        paymentMethod === pm.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                      }`}>
                      <pm.icon className={`w-5 h-5 ${pm.color}`} />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI Form */}
              {paymentMethod === 'upi' && (
                <div className="mb-5 p-4 bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl space-y-3">
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium flex items-center gap-1.5"><QrCode className="w-4 h-4" /> Pay via UPI</p>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">UPI ID</label>
                    <input type="text" value={upiId} onChange={e => { setUpiId(e.target.value); setValidationErrors(prev => { const n = {...prev}; delete n.upiId; return n; }); }} placeholder="username@paytm / username@upi"
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none ${validationErrors.upiId ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />
                    {validationErrors.upiId && <p className="text-xs text-red-500 mt-1">{validationErrors.upiId}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Amazon Pay'].map(app => (
                      <span key={app} className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-[10px] font-medium text-slate-600 dark:text-slate-300">{app}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Card Form */}
              {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                <div className="mb-5 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> {paymentMethod === 'credit_card' ? 'Credit' : 'Debit'} Card</p>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Card Number</label>
                    <input type="text" value={cardNumber} onChange={e => { setCardNumber(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 19)); setValidationErrors(prev => { const n = {...prev}; delete n.cardNumber; return n; }); }} placeholder="1234 5678 9012 3456"
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-sm font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none ${validationErrors.cardNumber ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />
                    {validationErrors.cardNumber && <p className="text-xs text-red-500 mt-1">{validationErrors.cardNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Cardholder Name</label>
                    <input type="text" value={cardName} onChange={e => { setCardName(e.target.value); setValidationErrors(prev => { const n = {...prev}; delete n.cardName; return n; }); }} placeholder="Name on card"
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${validationErrors.cardName ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />
                    {validationErrors.cardName && <p className="text-xs text-red-500 mt-1">{validationErrors.cardName}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Expiry</label>
                      <input type="text" value={cardExpiry} onChange={e => { setCardExpiry(e.target.value.replace(/[^0-9/]/g, '').slice(0, 5)); setValidationErrors(prev => { const n = {...prev}; delete n.cardExpiry; return n; }); }} placeholder="MM/YY" maxLength={5}
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none ${validationErrors.cardExpiry ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />
                      {validationErrors.cardExpiry && <p className="text-xs text-red-500 mt-1">{validationErrors.cardExpiry}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">CVV</label>
                      <input type="password" value={cardCvv} onChange={e => { setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4)); setValidationErrors(prev => { const n = {...prev}; delete n.cardCvv; return n; }); }} placeholder="---" maxLength={4}
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none ${validationErrors.cardCvv ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />
                      {validationErrors.cardCvv && <p className="text-xs text-red-500 mt-1">{validationErrors.cardCvv}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners'].map(n => (
                      <span key={n} className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-[10px] font-medium text-slate-600 dark:text-slate-300">{n}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Net Banking */}
              {paymentMethod === 'net_banking' && (
                <div className="mb-5 p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3">
                  <p className="text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1.5"><Landmark className="w-4 h-4" /> Net Banking</p>
                  <select value={bankName} onChange={e => setBankName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
                    {[
                      ['sbi', 'State Bank of India'], ['hdfc', 'HDFC Bank'], ['icici', 'ICICI Bank'],
                      ['axis', 'Axis Bank'], ['kotak', 'Kotak Mahindra Bank'], ['pnb', 'Punjab National Bank'],
                      ['bob', 'Bank of Baroda'], ['canara', 'Canara Bank'], ['union', 'Union Bank of India'],
                      ['idbi', 'IDBI Bank'], ['yes', 'YES Bank'], ['indusind', 'IndusInd Bank'],
                      ['federal', 'Federal Bank'], ['rbl', 'RBL Bank'],
                    ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <p className="text-[11px] text-slate-500">You will be redirected to your bank&apos;s secure page.</p>
                </div>
              )}

              {/* Submit */}
              <button onClick={handleAddFunds} disabled={isAdding || !addAmount}
                className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-green-400 disabled:to-emerald-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20">
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {isAdding ? 'Processing...' : `Pay ${addAmount ? formatCurrency(parseFloat(addAmount) || 0) : '\u20B90'}`}
              </button>
              <p className="text-[11px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Secured by 256-bit SSL - RBI regulated - PCI-DSS Compliant
              </p>
            </div>
          </motion.div>
        )}

        {/* ====== TAB: Transfer ====== */}
        {tab === 'send' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" /> Transfer & Request
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Send money to other DelegateCart users or request payment</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <ArrowUpRight className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Send Money</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Transfer to another user&apos;s wallet</p>
                  <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Send Now
                  </button>
                </div>
                <div className="p-5 bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <ArrowDownLeft className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Request Payment</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Ask a user to send money to you</p>
                  <button className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                    Request
                  </button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <Gift className="w-5 h-5 text-indigo-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Cashback & Rewards</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Earn 2% cashback on all wallet payments. Refer friends and earn &#x20B9;100 per referral.
                      AI auto-checkout orders earn bonus 1% cashback.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ====== TAB: Transaction History ====== */}
        {tab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={txnSearch} onChange={(e) => setTxnSearch(e.target.value)} placeholder="Search transactions..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                {(['all', 'credit', 'debit'] as const).map((f) => (
                  <button key={f} onClick={() => setTxnFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      txnFilter === f ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}>
                    {f === 'all' ? 'All' : f === 'credit' ? 'Credits' : 'Debits'}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" /> All Transactions
                </h3>
                <span className="text-xs text-slate-400">{filteredTxns.length} results</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredTxns.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No transactions found</p>
                  </div>
                ) : (
                  filteredTxns.map((txn) => (
                    <div key={txn.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${txn.type === 'credit' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          {txn.type === 'credit' ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{txn.description}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{formatDate(txn.createdAt)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              txn.status === 'completed' ? 'bg-green-100 text-green-700' : txn.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>{txn.status}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400">Bal: {formatCurrency(txn.balanceAfter)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {filteredTxns.length > 0 && hasMoreTxns && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700">
                  <button onClick={loadMoreTransactions} disabled={loadingMore}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2">
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    Load More
                  </button>
                </div>
              )}
            </div>

            {/* Download Statement */}
            <div className="text-center">
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors">
                <Download className="w-4 h-4" /> Download Statement (PDF)
              </button>
            </div>
          </motion.div>
        )}

        {/* ====== TAB: Settings ====== */}
        {tab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Spending Limits */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" /> Spending Limits & Security
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Control how much can be spent from your wallet</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Max Per Order</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="number" value={settingsForm.maxPerOrder} onChange={e => setSettingsForm(p => ({ ...p, maxPerOrder: e.target.value }))}
                      placeholder="No limit" className="w-full pl-8 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Maximum amount per single transaction</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Daily Limit</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="number" value={settingsForm.dailyLimit} onChange={e => setSettingsForm(p => ({ ...p, dailyLimit: e.target.value }))}
                      placeholder="No limit" className="w-full pl-8 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Daily spending cap across all transactions</p>
                </div>
              </div>

              {/* AI Authorization Section */}
              <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 bg-indigo-50/30 dark:bg-indigo-900/10 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">AI Auto-Checkout Authorization</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settingsForm.isAiAuthorized}
                      onChange={e => setSettingsForm(p => ({ ...p, isAiAuthorized: e.target.checked }))} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Allow AI agent to debit wallet for auto-checkout orders. All auto-checkout payments will use your wallet balance.
                </p>
                {settingsForm.isAiAuthorized && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">AI Spending Limit (per order)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input type="number" value={settingsForm.aiSpendingLimit}
                        onChange={e => setSettingsForm(p => ({ ...p, aiSpendingLimit: e.target.value }))}
                        placeholder="Same as per-order limit" className="w-full pl-8 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Maximum amount AI can spend per auto-checkout order</p>
                  </div>
                )}
              </div>

              {/* Info callout */}
              <div className="mb-5 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  When you save changes, notifications will be sent to your registered email, WhatsApp, and mobile number for security.
                </p>
              </div>

              <button onClick={handleSaveSettings} disabled={savingSettings}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-purple-400 disabled:to-indigo-400 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-600/20">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Save Settings
              </button>
            </div>

            {/* Security & Compliance */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500" /> Security & Compliance
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Lock, title: '256-bit SSL', desc: 'All data encrypted in transit' },
                  { icon: ShieldCheck, title: 'PCI-DSS Level 1', desc: 'Highest card security standard' },
                  { icon: Repeat, title: 'Auto-Refund', desc: 'Failed txns refunded in 48hrs' },
                ].map(({ icon: I, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <I className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}

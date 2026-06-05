'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard, ChevronLeft, Loader2, Plus, Trash2, Check, X,
  Wallet, Building, Smartphone, Shield, Star,
} from 'lucide-react';

type PaymentMethod = {
  id: string;
  type: 'card' | 'upi' | 'netbanking' | 'wallet';
  label: string;
  details: string;
  isDefault: boolean;
  icon: string;
};

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<'card' | 'upi' | 'netbanking' | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Form states
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : '';

  useEffect(() => {
    if (!token) { router.push('/signin'); return; }
    loadPaymentMethods();
    loadWallet();
  }, []);

  function loadPaymentMethods() {
    setLoading(true);
    try {
      const saved = JSON.parse(localStorage.getItem('paymentMethods') || '[]');
      if (Array.isArray(saved)) setMethods(saved);
    } catch {}
    setLoading(false);
  }

  async function loadWallet() {
    try {
      const res = await fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}`, 'x-user-email': typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '' } });
      const data = await res.json();
      if (data.wallet) setWalletBalance(Number(data.wallet.balance) || 0);
    } catch {}
  }

  function saveToStorage(updated: PaymentMethod[]) {
    setMethods(updated);
    localStorage.setItem('paymentMethods', JSON.stringify(updated));
  }

  function handleAddCard() {
    if (!cardNumber || !cardName || !cardExpiry) return;
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    const isVisa = cardNumber.startsWith('4');
    const method: PaymentMethod = {
      id: `card-${Date.now()}`,
      type: 'card',
      label: `${isVisa ? 'Visa' : 'Mastercard'} ****${last4}`,
      details: `${cardName} · Expires ${cardExpiry}`,
      isDefault: methods.length === 0,
      icon: isVisa ? '💳' : '💳',
    };
    saveToStorage([...methods, method]);
    setAdding(null);
    setCardNumber(''); setCardName(''); setCardExpiry('');
  }

  function handleAddUPI() {
    if (!upiId || !upiId.includes('@')) return;
    const method: PaymentMethod = {
      id: `upi-${Date.now()}`,
      type: 'upi',
      label: upiId,
      details: 'UPI Payment',
      isDefault: methods.length === 0,
      icon: '📱',
    };
    saveToStorage([...methods, method]);
    setAdding(null);
    setUpiId('');
  }

  function handleAddNetBanking() {
    if (!bankName) return;
    const method: PaymentMethod = {
      id: `nb-${Date.now()}`,
      type: 'netbanking',
      label: bankName,
      details: 'Net Banking',
      isDefault: methods.length === 0,
      icon: '🏦',
    };
    saveToStorage([...methods, method]);
    setAdding(null);
    setBankName('');
  }

  function handleDelete(id: string) {
    const updated = methods.filter(m => m.id !== id);
    if (updated.length > 0 && !updated.some(m => m.isDefault)) {
      updated[0].isDefault = true;
    }
    saveToStorage(updated);
  }

  function setDefault(id: string) {
    const updated = methods.map(m => ({ ...m, isDefault: m.id === id }));
    saveToStorage(updated);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/account" className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white mb-4 transition-colors">
            <ChevronLeft size={16} /> Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <CreditCard size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Payment Methods</h1>
              <p className="text-sm text-white/80">{methods.length} saved method{methods.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Wallet Card */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">DelegateCart Wallet</p>
                <p className="text-2xl font-bold">
                  {walletBalance !== null ? `₹${walletBalance.toLocaleString('en-IN')}` : 'Loading...'}
                </p>
              </div>
            </div>
            <Link href="/wallet" className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm">
              Manage Wallet
            </Link>
          </div>
        </div>

        {/* Add New Method */}
        {!adding && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => setAdding('card')} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors text-gray-600 dark:text-gray-400">
              <CreditCard size={20} />
              <div className="text-left">
                <p className="text-sm font-medium">Add Card</p>
                <p className="text-xs opacity-70">Visa, Mastercard, RuPay</p>
              </div>
            </button>
            <button onClick={() => setAdding('upi')} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-green-400 hover:text-green-600 transition-colors text-gray-600 dark:text-gray-400">
              <Smartphone size={20} />
              <div className="text-left">
                <p className="text-sm font-medium">Add UPI</p>
                <p className="text-xs opacity-70">Google Pay, PhonePe, etc.</p>
              </div>
            </button>
            <button onClick={() => setAdding('netbanking')} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-purple-400 hover:text-purple-600 transition-colors text-gray-600 dark:text-gray-400">
              <Building size={20} />
              <div className="text-left">
                <p className="text-sm font-medium">Add Net Banking</p>
                <p className="text-xs opacity-70">SBI, HDFC, ICICI, etc.</p>
              </div>
            </button>
          </div>
        )}

        {/* Add Card Form */}
        {adding === 'card' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><CreditCard size={16} /> Add Debit/Credit Card</h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Card Number</label>
              <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} maxLength={19} placeholder="1234 5678 9012 3456" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name on Card</label>
                <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Doe" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry (MM/YY)</label>
                <input value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} maxLength={5} placeholder="12/26" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500"><Shield size={12} /> Card details are stored locally and never sent to our servers</div>
            <div className="flex gap-2">
              <button onClick={handleAddCard} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"><Check size={14} /> Add Card</button>
              <button onClick={() => setAdding(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><X size={14} /> Cancel</button>
            </div>
          </div>
        )}

        {/* Add UPI Form */}
        {adding === 'upi' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Smartphone size={16} /> Add UPI ID</h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">UPI ID</label>
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddUPI} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-2"><Check size={14} /> Add UPI</button>
              <button onClick={() => setAdding(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><X size={14} /> Cancel</button>
            </div>
          </div>
        )}

        {/* Add Net Banking Form */}
        {adding === 'netbanking' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Building size={16} /> Add Net Banking</h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Select Bank</label>
              <select value={bankName} onChange={e => setBankName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <option value="">Choose a bank...</option>
                {['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Baroda', 'Punjab National Bank', 'Canara Bank', 'Union Bank of India', 'Indian Bank'].map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddNetBanking} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 flex items-center gap-2"><Check size={14} /> Add Bank</button>
              <button onClick={() => setAdding(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><X size={14} /> Cancel</button>
            </div>
          </div>
        )}

        {/* Saved Methods */}
        {methods.length === 0 && !adding && (
          <div className="text-center py-16">
            <CreditCard size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No payment methods saved yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add a card, UPI, or net banking to get started.</p>
          </div>
        )}

        <div className="space-y-3">
          {methods.map(method => (
            <div key={method.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl flex-shrink-0">
                {method.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{method.label}</span>
                  {method.isDefault && (
                    <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Star size={8} /> Default
                    </span>
                  )}
                  <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full capitalize">{method.type}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{method.details}</p>
              </div>
              <div className="flex gap-2">
                {!method.isDefault && (
                  <button onClick={() => setDefault(method.id)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                    Set Default
                  </button>
                )}
                <button onClick={() => handleDelete(method.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

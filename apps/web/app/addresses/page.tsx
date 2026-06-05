'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Edit2, Trash2, Check, X, Home, Building2,
  Star, ChevronLeft, Loader2,
} from 'lucide-react';
import Link from 'next/link';

type Address = {
  id: number;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

const EMPTY: Omit<Address, 'id' | 'isDefault'> = {
  name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
};

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [defaultBillingId, setDefaultBillingId] = useState<number | null>(null);
  const [defaultShippingId, setDefaultShippingId] = useState<number | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : '';

  useEffect(() => {
    if (!token) { router.push('/signin'); return; }
    fetchAddresses();
    fetchProfile();
  }, []);

  async function fetchAddresses() {
    setLoading(true);
    try {
      const res = await fetch('/api/user/addresses', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
    } catch { setAddresses([]); }
    setLoading(false);
  }

  async function fetchProfile() {
    try {
      const res = await fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDefaultBillingId(data.profile?.defaultBillingAddressId || null);
      setDefaultShippingId(data.profile?.defaultShippingAddressId || null);
    } catch {}
  }

  async function handleSave() {
    setError('');
    if (!form.name || !form.line1 || !form.city || !form.state || !form.pincode) {
      setError('Please fill all required fields'); return;
    }
    if (!/^\d{6}$/.test(form.pincode)) { setError('Pincode must be 6 digits'); return; }

    setSaving(true);
    try {
      const method = editing === 'new' ? 'POST' : 'PUT';
      const body = editing === 'new' ? form : { ...form, id: editing };
      const res = await fetch('/api/user/addresses', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      await fetchAddresses();
      setEditing(null);
      setForm(EMPTY);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this address?')) return;
    await fetch(`/api/user/addresses?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchAddresses();
  }

  async function setDefault(type: 'billing' | 'shipping', addressId: number) {
    const key = type === 'billing' ? 'defaultBillingAddressId' : 'defaultShippingAddressId';
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [key]: addressId }),
    });
    if (type === 'billing') setDefaultBillingId(addressId);
    else setDefaultShippingId(addressId);
  }

  function startEdit(addr: Address) {
    setEditing(addr.id);
    setForm({ name: addr.name, phone: addr.phone || '', line1: addr.line1, line2: addr.line2 || '', city: addr.city, state: addr.state, pincode: addr.pincode });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/account" className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white mb-4 transition-colors">
            <ChevronLeft size={16} /> Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <MapPin size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Your Addresses</h1>
              <p className="text-sm text-white/80">{addresses.length} saved address{addresses.length !== 1 ? 'es' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Default badges */}
        {addresses.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {defaultBillingId && (
              <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5">
                <Building2 size={14} /> Default Billing: <span className="font-semibold">{addresses.find(a => a.id === defaultBillingId)?.name || '—'}</span>
              </div>
            )}
            {defaultShippingId && (
              <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5">
                <Home size={14} /> Default Shipping: <span className="font-semibold">{addresses.find(a => a.id === defaultShippingId)?.name || '—'}</span>
              </div>
            )}
          </div>
        )}

        {/* Add New Address Button */}
        {editing !== 'new' && (
          <button
            onClick={() => { setEditing('new'); setForm(EMPTY); setError(''); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus size={20} /> Add New Address
          </button>
        )}

        {/* New Address Form */}
        <AnimatePresence>
          {editing === 'new' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4"
            >
              <h3 className="font-bold text-gray-900 dark:text-white">New Address</h3>
              <AddressForm form={form} setForm={setForm} error={error} />
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                </button>
                <button onClick={() => { setEditing(null); setError(''); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <X size={14} /> Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 size={32} className="mx-auto animate-spin text-blue-600" />
          </div>
        )}

        {/* Address List */}
        {!loading && addresses.length === 0 && editing !== 'new' && (
          <div className="text-center py-16">
            <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No addresses saved yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {addresses.map(addr => (
            <div key={addr.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:shadow-md transition-shadow">
              {editing === addr.id ? (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 dark:text-white">Edit Address</h3>
                  <AddressForm form={form} setForm={setForm} error={error} />
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                    </button>
                    <button onClick={() => { setEditing(null); setError(''); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">{addr.name}</span>
                      {addr.id === defaultShippingId && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">Shipping Default</span>
                      )}
                      {addr.id === defaultBillingId && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Billing Default</span>
                      )}
                    </div>
                    {addr.phone && <p className="text-xs text-gray-500 mb-1">{addr.phone}</p>}
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDefault('shipping', addr.id)} title="Set as default shipping"
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${addr.id === defaultShippingId ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      <Home size={12} /> Shipping
                    </button>
                    <button onClick={() => setDefault('billing', addr.id)} title="Set as default billing"
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${addr.id === defaultBillingId ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      <Building2 size={12} /> Billing
                    </button>
                    <button onClick={() => startEdit(addr)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                      <Edit2 size={12} /> Edit
                    </button>
                    <button onClick={() => handleDelete(addr.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddressForm({ form, setForm, error }: {
  form: typeof EMPTY;
  setForm: (f: typeof EMPTY) => void;
  error: string;
}) {
  const update = (key: string, value: string) => setForm({ ...form, [key]: value });

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
          <input value={form.phone} onChange={e => update('phone', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="9876543210" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 1 *</label>
        <input value={form.line1} onChange={e => update('line1', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="123 Main Street" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 2</label>
        <input value={form.line2} onChange={e => update('line2', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Apartment, suite, etc." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">City *</label>
          <input value={form.city} onChange={e => update('city', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Mumbai" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">State *</label>
          <input value={form.state} onChange={e => update('state', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Maharashtra" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pincode *</label>
          <input value={form.pincode} onChange={e => update('pincode', e.target.value)} maxLength={6} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="400001" />
        </div>
      </div>
    </div>
  );
}

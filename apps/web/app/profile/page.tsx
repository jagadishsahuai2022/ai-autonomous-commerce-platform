'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, Lock, Save, MessageSquare, ShieldCheck, IndianRupee,
  X, Loader2, Plus, Trash2, Star, Settings, Brain, CreditCard, Home, Building2, Check,
  Wallet, Package, Copy, ChevronRight, AlertCircle, CheckCircle2, Truck, ChevronDown
} from 'lucide-react';
import { useForm, UseFormRegister, UseFormWatch, FieldErrors } from 'react-hook-form';
import { useCurrentUser } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import { saveAutoCheckoutSettings, fromProfileForm } from '@/lib/auto-checkout-settings';

export interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  displayName?: string;
  aliasName?: string;
  preferredCommunicationEmail?: string;
  whatsappNumber?: string;
  subscriptionPlan: 'BASIC' | 'AI_PLUS';
  preferredModel: string;
  monthlyAiBudget: number;
  defaultDeliveryDays: number;
  defaultPaymentMethod: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    newsletter: boolean;
    autoPurchaseEnabled: boolean;
    autoPurchaseThreshold: number;
  };
}

interface Address {
  id: number;
  name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

// ── Section Card Wrapper (Collapsible) ──────────────────────────────────────
function SectionCard({ title, icon: Icon, children, delay = 0, defaultOpen = true, badge }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  delay?: number;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex-1">{title}</h2>
        {badge && <span className="mr-1">{badge}</span>}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="section-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Address Management Sub-component ──────────────────────────────────────────
function AddressSection({
  defaultBillingId,
  defaultShippingId,
  onDefaultsChange,
}: {
  defaultBillingId: number | null;
  defaultShippingId: number | null;
  onDefaultsChange: (billing: number | null, shipping: number | null) => void;
}) {
  const toast = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [setAsDefaultShipping, setSetAsDefaultShipping] = useState(false);
  const [setAsDefaultBilling, setSetAsDefaultBilling] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setForm({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
    setFormErrors({});
    setSetAsDefaultShipping(false);
    setSetAsDefaultBilling(false);
    setEditingId(null);
  };

  // Validate form fields, returning a map of fieldName → errorMessage
  const validateAddressForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Full name is required';
    if (!form.line1.trim()) errors.line1 = 'Address line 1 is required';
    if (!form.city.trim()) errors.city = 'City is required';
    if (!form.state) errors.state = 'Please select a state';
    if (!form.pincode.trim()) errors.pincode = 'Pincode is required';
    else if (!/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'Pincode must be 6 digits';
    if (form.phone) {
      const cleaned = form.phone.replace(/[\s+\-]/g, '').replace(/^0+/, '');
      const normalized = cleaned.length === 12 && cleaned.startsWith('91') ? cleaned.slice(2) : cleaned;
      if (!/^\d{10}$/.test(normalized)) errors.phone = 'Enter a valid 10-digit phone number';
    }
    return errors;
  };

  const loadAddresses = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch('/api/user/addresses', { headers: { Authorization: `Bearer ${token}`, 'X-User-Email': localStorage.getItem('userEmail') || '' } });
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
      }
    } catch (err) { console.error('Failed to load addresses:', err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  const handleSave = async () => {
    // Run full inline validation — show per-field errors
    const errors = validateAddressForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }
    setFormErrors({});
    setSaving(true);
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch('/api/user/addresses', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-User-Email': localStorage.getItem('userEmail') || '' },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(editingId ? 'Address updated successfully' : 'Address added successfully');
        setShowForm(false);
        resetForm();
        await loadAddresses();
        // If user wants to set this address as default shipping/billing, persist immediately
        if (!editingId && data.address) {
          const newId = data.address.id;
          const newBilling = setAsDefaultBilling ? newId : defaultBillingId;
          const newShipping = setAsDefaultShipping ? newId : defaultShippingId;
          if (setAsDefaultBilling || setAsDefaultShipping) {
            // Immediately sync to DB — don't require "Save All Changes" button
            await fetch('/api/user/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-User-Email': localStorage.getItem('userEmail') || '' },
              body: JSON.stringify({
                defaultBillingAddressId: newBilling,
                defaultShippingAddressId: newShipping,
              }),
            });
            onDefaultsChange(newBilling, newShipping);
          }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to save address');
      }
    } catch { toast.error('Network error — please try again'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch(`/api/user/addresses?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-User-Email': localStorage.getItem('userEmail') || '' },
      });
      if (res.ok) {
        toast.success('Address removed');
        loadAddresses();
        if (defaultBillingId === id) onDefaultsChange(null, defaultShippingId);
        if (defaultShippingId === id) onDefaultsChange(defaultBillingId, null);
      }
    } catch { toast.error('Failed to delete'); }
  };

  const startEdit = (addr: Address) => {
    setForm({ name: addr.name, phone: addr.phone || '', line1: addr.line1, line2: addr.line2 || '', city: addr.city, state: addr.state, pincode: addr.pincode });
    setFormErrors({});
    setSetAsDefaultShipping(false);
    setSetAsDefaultBilling(false);
    setEditingId(addr.id);
    setShowForm(true);
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !showForm && (
        <p className="text-sm text-slate-500 dark:text-slate-400">No addresses saved yet. Add one to speed up checkout.</p>
      )}

      {/* Address list */}
      <div className="space-y-3">
        {addresses.map((addr) => {
          const isBilling = defaultBillingId === addr.id;
          const isShipping = defaultShippingId === addr.id;
          return (
            <div key={addr.id} className={`border-2 rounded-xl p-4 relative transition-all ${isBilling && isShipping
              ? 'border-violet-400 dark:border-violet-500 bg-gradient-to-br from-violet-50/60 to-blue-50/40 dark:from-violet-900/20 dark:to-blue-900/10 shadow-md shadow-violet-200/50 dark:shadow-violet-900/20'
              : isBilling
                ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/40 dark:bg-emerald-900/10 shadow-sm shadow-emerald-200/50 dark:shadow-emerald-900/20'
                : isShipping
                  ? 'border-blue-400 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-900/10 shadow-sm shadow-blue-200/50 dark:shadow-blue-900/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
              }`}>
              {/* Default badge ribbon */}
              {(isBilling || isShipping) && (
                <div className="absolute -top-3 left-3 flex gap-1.5">
                  {isShipping && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-sm shadow-blue-400/40">
                      <Truck className="w-3 h-3" /> DEFAULT SHIPPING
                    </span>
                  )}
                  {isBilling && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-400/40">
                      <CreditCard className="w-3 h-3" /> DEFAULT BILLING
                    </span>
                  )}
                </div>
              )}
              <div className={`flex items-start justify-between ${(isBilling || isShipping) ? 'mt-2' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{addr.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}
                  </p>
                  {addr.phone && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{addr.phone}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onDefaultsChange(defaultBillingId, addr.id)} title="Set as default shipping"
                    className={`p-1.5 rounded-lg text-xs transition-all ${isShipping ? 'bg-blue-600 text-white shadow-sm shadow-blue-400/30' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-600'}`}>
                    <Truck className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => onDefaultsChange(addr.id, defaultShippingId)} title="Set as default billing"
                    className={`p-1.5 rounded-lg text-xs transition-all ${isBilling ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-400/30' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-600'}`}>
                    <CreditCard className="w-3.5 h-3.5" />
                  </button>
                  {defaultShippingId === addr.id && defaultBillingId !== addr.id && (
                    <button type="button" onClick={() => onDefaultsChange(addr.id, defaultShippingId)} title="Also use as billing address"
                      className="p-1.5 rounded-lg text-xs hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-400 hover:text-violet-600 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(addr)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><Settings className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => handleDelete(addr.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint: Use same address */}
      {defaultShippingId && !defaultBillingId && addresses.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
          <span>No billing address selected. Your default shipping address will be used for billing.</span>
        </div>
      )}

      {/* Add / Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900/70 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <input placeholder="Full name *" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(fe => ({ ...fe, name: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:outline-none transition-colors ${formErrors.name ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-400'}`} />
                  {formErrors.name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.name}</p>}
                </div>
                <div className="space-y-1">
                  <input placeholder="Phone (optional)" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setFormErrors(fe => ({ ...fe, phone: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:outline-none transition-colors ${formErrors.phone ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-400'}`} />
                  {formErrors.phone && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.phone}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <input placeholder="Address line 1 *" value={form.line1} onChange={e => { setForm(f => ({ ...f, line1: e.target.value })); setFormErrors(fe => ({ ...fe, line1: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:outline-none transition-colors ${formErrors.line1 ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-400'}`} />
                {formErrors.line1 && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.line1}</p>}
              </div>
              <input placeholder="Address line 2 (optional)" value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none transition-colors" />
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <input placeholder="City *" value={form.city} onChange={e => { setForm(f => ({ ...f, city: e.target.value })); setFormErrors(fe => ({ ...fe, city: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:outline-none transition-colors ${formErrors.city ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-400'}`} />
                  {formErrors.city && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.city}</p>}
                </div>
                <div className="space-y-1">
                  <select value={form.state} onChange={e => { setForm(f => ({ ...f, state: e.target.value })); setFormErrors(fe => ({ ...fe, state: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:outline-none transition-colors ${formErrors.state
                      ? 'border-red-400 focus:ring-red-300 text-red-500 dark:text-red-400'
                      : form.state
                        ? 'border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-400'
                        : 'border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 focus:ring-blue-500 focus:border-blue-400'
                      }`}>
                    <option value="">Select State *</option>
                    {['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {formErrors.state && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.state}</p>}
                </div>
                <div className="space-y-1">
                  <input placeholder="Pincode *" value={form.pincode} onChange={e => { setForm(f => ({ ...f, pincode: e.target.value })); setFormErrors(fe => ({ ...fe, pincode: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:outline-none transition-colors ${formErrors.pincode ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-400'}`} />
                  {formErrors.pincode && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.pincode}</p>}
                </div>
              </div>
              {/* Default shipping/billing options (only when adding new address) */}
              {!editingId && (
                <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={setAsDefaultShipping}
                      onChange={e => setSetAsDefaultShipping(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-500" /> Set as default shipping
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={setAsDefaultBilling}
                      onChange={e => setSetAsDefaultBilling(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-500" /> Set as default billing
                    </span>
                  </label>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="px-5 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-1.5 font-medium shadow-sm shadow-blue-400/30 transition-all">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add address
        </button>
      )}
    </div>
  );
}

// ── Terms Modal ───────────────────────────────────────────────────────────────
function TermsModal({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Auto-Checkout Terms &amp; Conditions</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
          <div className="overflow-y-auto px-6 py-4 text-sm text-slate-700 dark:text-slate-300 space-y-4">
            <p className="font-semibold text-slate-900 dark:text-white">Effective Date: March 2026</p>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">1. Overview</h3><p>By enabling Auto-Checkout, you authorize DelegateCart&apos;s AI agent to automatically place orders on your behalf when all specified conditions are met.</p></section>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">2. Auto-Checkout Conditions</h3><p>An automatic order will only be placed when ALL conditions are satisfied: exact product match, validated payment method, total within auto-payment limit, items in stock, account in good standing.</p></section>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">3. Payment Authorization</h3><p>For COD: Orders placed, pay on delivery. For online payments: Charged to your default payment method.</p></section>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">4. Payment Limits</h3><p>Auto-checkout is subject to your configured payment limit. Orders exceeding this limit require manual approval.</p></section>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">5. Order Failures &amp; Risks</h3><p>Payment failures cancel orders. Stock changes hold orders for review. Price changes &gt;5% require approval.</p></section>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">6. Cancellation &amp; Returns</h3><p>Same policies as manual orders. Standard cancellation windows and return policies apply.</p></section>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">7. Liability</h3><p>DelegateCart is not liable for losses from auto-checkout orders placed per your configured preferences.</p></section>
            <section><h3 className="font-semibold text-slate-900 dark:text-white mb-1">8. Disabling Auto-Checkout</h3><p>Disable at any time via Shopping List page or Profile Settings. Pending orders will be cancelled.</p></section>
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Last updated: March 2026</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 rounded-lg">Close</button>
              <button onClick={onAccept} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">I Accept</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Profile Form ─────────────────────────────────────────────────────────

function ProfileForm() {
  const { data: user, isLoading } = useCurrentUser();
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [profileFromApi, setProfileFromApi] = useState<any>(null);
  const [defaultBillingId, setDefaultBillingId] = useState<number | null>(null);
  const [defaultShippingId, setDefaultShippingId] = useState<number | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ProfileFormData>({
    defaultValues: {
      subscriptionPlan: 'BASIC',
      preferredModel: 'gpt-4o-mini',
      monthlyAiBudget: 50000,
      defaultDeliveryDays: 7,
      defaultPaymentMethod: 'cod',
      preferences: {
        autoPurchaseEnabled: false,
        autoPurchaseThreshold: 10000,
      },
    },
  });

  const autoPurchaseEnabled = watch('preferences.autoPurchaseEnabled');
  const subscriptionPlan = watch('subscriptionPlan');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('profileTermsAccepted') === 'true' : false;
    setTermsAccepted(saved);
  }, []);

  // Load profile from API
  useEffect(() => {
    const loadProfile = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (!token) return;
      try {
        const res = await fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}`, 'X-User-Email': localStorage.getItem('userEmail') || '' } });
        if (res.ok) {
          const data = await res.json();
          setProfileFromApi(data);
          setDefaultBillingId(data.defaultBillingAddressId || null);
          setDefaultShippingId(data.defaultShippingAddressId || null);
          const nameParts = (data.name || '').split(' ');
          reset({
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: data.email || '',
            displayName: data.displayName || '',
            aliasName: data.aliasName || '',
            preferredCommunicationEmail: data.preferredCommunicationEmail || '',
            whatsappNumber: data.whatsappNumber || '',
            subscriptionPlan: data.subscriptionPlan || 'BASIC',
            preferredModel: data.preferredModel || 'gpt-4o-mini',
            monthlyAiBudget: data.monthlyAiBudget ?? 50000,
            defaultDeliveryDays: data.defaultDeliveryDays ?? 7,
            defaultPaymentMethod: data.defaultPaymentMethod || 'cod',
            preferences: {
              theme: 'system',
              notifications: true,
              newsletter: false,
              autoPurchaseEnabled: data.autoPurchaseEnabled ?? false,
              autoPurchaseThreshold: data.autoPurchaseThreshold ?? 10000,
            },
          });
          localStorage.setItem('autoPurchaseEnabled', String(data.autoPurchaseEnabled ?? false));
          localStorage.setItem('autoPurchaseThreshold', String(data.autoPurchaseThreshold ?? 10000));
          if (data.whatsappNumber) localStorage.setItem('whatsappNumber', data.whatsappNumber);
        }
      } catch { /* ignore */ }
    };
    loadProfile();
  }, [reset]);

  const handleDefaultsChange = async (billing: number | null, shipping: number | null) => {
    setDefaultBillingId(billing);
    setDefaultShippingId(shipping);
    // Persist immediately instead of waiting for "Save All Changes" button
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token) {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-User-Email': localStorage.getItem('userEmail') || '' },
        body: JSON.stringify({ defaultBillingAddressId: billing, defaultShippingAddressId: shipping }),
      });
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();

      if (token) {
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-User-Email': localStorage.getItem('userEmail') || '' },
          body: JSON.stringify({
            name: fullName,
            displayName: data.displayName || null,
            aliasName: data.aliasName || null,
            preferredCommunicationEmail: data.preferredCommunicationEmail || null,
            whatsappNumber: data.whatsappNumber || null,
            autoPurchaseEnabled: data.preferences.autoPurchaseEnabled,
            autoPurchaseThreshold: data.preferences.autoPurchaseThreshold,
            subscriptionPlan: data.subscriptionPlan,
            preferredModel: data.preferredModel,
            monthlyAiBudget: data.monthlyAiBudget,
            defaultDeliveryDays: data.defaultDeliveryDays,
            defaultPaymentMethod: data.defaultPaymentMethod,
            defaultBillingAddressId: defaultBillingId,
            defaultShippingAddressId: defaultShippingId,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to save profile');
        }
      }

      if (data.whatsappNumber) localStorage.setItem('whatsappNumber', data.whatsappNumber);
      localStorage.setItem('autoPurchaseEnabled', String(data.preferences.autoPurchaseEnabled));
      localStorage.setItem('autoPurchaseThreshold', String(data.preferences.autoPurchaseThreshold));

      // Sync to shared auto-checkout settings store (single source of truth)
      saveAutoCheckoutSettings(fromProfileForm({
        autoPurchaseEnabled: data.preferences.autoPurchaseEnabled,
        autoPurchaseThreshold: data.preferences.autoPurchaseThreshold,
        monthlyAiBudget: data.monthlyAiBudget,
        defaultDeliveryDays: data.defaultDeliveryDays,
        defaultPaymentMethod: data.defaultPaymentMethod,
      }));

      toast.success('Profile saved successfully');
    } catch (error: any) {
      console.error('Profile save error:', error);
      if (data.whatsappNumber) localStorage.setItem('whatsappNumber', data.whatsappNumber);
      localStorage.setItem('autoPurchaseEnabled', String(data.preferences.autoPurchaseEnabled));
      localStorage.setItem('autoPurchaseThreshold', String(data.preferences.autoPurchaseThreshold));

      // Also sync locally even if API fails
      saveAutoCheckoutSettings(fromProfileForm({
        autoPurchaseEnabled: data.preferences.autoPurchaseEnabled,
        autoPurchaseThreshold: data.preferences.autoPurchaseThreshold,
        monthlyAiBudget: data.monthlyAiBudget,
        defaultDeliveryDays: data.defaultDeliveryDays,
        defaultPaymentMethod: data.defaultPaymentMethod,
      }));

      toast.success('Profile saved locally (DB sync will retry)');
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
  const labelCls = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5";
  const disabledCls = "w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed";

  // Always render the form immediately with default values.
  // Profile data populates the form asynchronously via reset() when available.

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Section 1: Personal Information ───────────────────────────── */}
      <SectionCard title="Personal Information" icon={User} delay={0}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name</label>
              <input type="text" {...register('firstName')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input type="text" {...register('lastName')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" {...register('email')} disabled className={disabledCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Display Name</label>
              <input type="text" {...register('displayName')} placeholder="How others see you" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Alias Name</label>
              <input type="text" {...register('aliasName')} placeholder="Optional nickname" className={inputCls} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Communication ──────────────────────────────────── */}
      <SectionCard title="Communication" icon={MessageSquare} delay={0.05}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Preferred Contact Email</label>
            <input type="email" {...register('preferredCommunicationEmail', {
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
            })} placeholder="Separate from login email" className={inputCls} />
            {errors.preferredCommunicationEmail && (
              <p className="text-xs text-red-500 mt-1">{errors.preferredCommunicationEmail.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>WhatsApp Number</label>
            <input type="tel" {...register('whatsappNumber', {
              pattern: { value: /^[+]?[0-9]{10,15}$/, message: 'Enter a valid phone number (10-15 digits)' },
            })} placeholder="+91 9876543210" className={inputCls} />
            {errors.whatsappNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.whatsappNumber.message}</p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Receive shopping list results, order updates, and approve purchases via WhatsApp.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: Saved Addresses ────────────────────────────────── */}
      <SectionCard title="Saved Addresses" icon={MapPin} delay={0.1}>
        <AddressSection
          defaultBillingId={defaultBillingId}
          defaultShippingId={defaultShippingId}
          onDefaultsChange={handleDefaultsChange}
        />
      </SectionCard>

      {/* ── Section 3.5: Digital Wallet ───────────────────────────────── */}
      <SectionCard title="Digital Wallet" icon={Wallet} delay={0.12}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage your wallet balance, spending limits, and AI checkout authorization.
          </p>
          <Link href="/wallet" className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
            Open Wallet <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </SectionCard>

      {/* ── Section 4: AI & Subscription Settings ─────────────────────── */}
      <SectionCard title="AI & Subscription" icon={Brain} delay={0.15}>
        <div className="space-y-5">
          {/* Subscription Plan */}
          <div>
            <label className={labelCls}>Subscription Plan</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'BASIC', label: 'Basic', desc: 'Standard AI features', icon: Star },
                { value: 'AI_PLUS', label: 'AI Plus', desc: 'Advanced models + priority', icon: Brain },
              ] as const).map(plan => (
                <label key={plan.value}
                  className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${subscriptionPlan === plan.value
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                    }`}>
                  <input type="radio" value={plan.value} {...register('subscriptionPlan')} className="sr-only" />
                  <div className="flex items-center gap-2 mb-1">
                    <plan.icon className={`w-4 h-4 ${subscriptionPlan === plan.value ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{plan.label}</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{plan.desc}</span>
                  {subscriptionPlan === plan.value && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* AI Model */}
          <div>
            <label className={labelCls}>Preferred AI Model</label>
            <select {...register('preferredModel')} className={inputCls}>
              <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
              <option value="gpt-4o">GPT-4o (Balanced)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo (Premium)</option>
              <option value="claude-3-haiku">Claude 3 Haiku (Fast)</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet (Premium)</option>
            </select>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {subscriptionPlan === 'BASIC' ? 'Basic plan uses GPT-4o Mini. Upgrade for more models.' : 'AI Plus unlocks all models.'}
            </p>
          </div>

          {/* Auto-Checkout — NATIVE PRODUCTS ONLY */}
          <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50/30 dark:bg-blue-900/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">Agentic Auto-Checkout</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 uppercase tracking-wider">Native Only</span>
              </div>
            </div>
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Auto-checkout is <strong className="text-blue-700 dark:text-blue-300">restricted to native products</strong> saved in the DelegateCart database.
                External aggregator products (Amazon, Flipkart) are permanently blocked from auto-checkout because the app has no control over third-party order fulfilment.
              </p>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-blue-100 dark:border-blue-800/40">
                <AlertCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Native products matching your search will auto-checkout via wallet payment. External products require manual purchase on the retailer&apos;s website.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Save Button ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <button type="submit" disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isSaving ? 'Saving...' : 'Save All Changes'}
        </button>
      </motion.div>

      <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)}
        onAccept={() => { setTermsAccepted(true); localStorage.setItem('profileTermsAccepted', 'true'); setShowTermsModal(false); }} />
    </form>
  );
}

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">My Profile</h1>
          <p className="text-sm text-slate-600 dark:text-gray-400">Manage your account, addresses, and AI settings</p>
        </motion.div>
        <Suspense fallback={
          <div className="space-y-6">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        }>
          <ProfileForm />
        </Suspense>
      </div>
    </div>
  );
}

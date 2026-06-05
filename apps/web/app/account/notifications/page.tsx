'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Bell, ChevronLeft, Package, Tag, Brain, MessageSquare, Mail, Smartphone, Save, CheckCircle } from 'lucide-react';

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};
function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700'
        }`}
        aria-label={label}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

type Prefs = {
  orderUpdates: boolean;
  priceDrops: boolean;
  aiRecommendations: boolean;
  weeklyDigest: boolean;
  newArrivals: boolean;
  flashSales: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
};

const DEFAULT_PREFS: Prefs = {
  orderUpdates: true,
  priceDrops: true,
  aiRecommendations: true,
  weeklyDigest: false,
  newArrivals: false,
  flashSales: true,
  pushEnabled: true,
  smsEnabled: false,
  emailEnabled: true,
};

export default function NotificationsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { router.push('/signin'); return; }
    try {
      const stored = localStorage.getItem('notificationPrefs');
      if (stored) setPrefs(JSON.parse(stored));
    } catch {}
    // Pre-fill from localStorage
    setNotificationEmail(localStorage.getItem('notificationEmail') || '');
    setWhatsappNumber(localStorage.getItem('whatsappNumber') || '');

    // Try to load from DB
    fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}`, 'x-user-email': localStorage.getItem('userEmail') || '' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          if (data.notificationEmail) setNotificationEmail(data.notificationEmail);
          if (data.whatsappNumber) setWhatsappNumber(data.whatsappNumber);
        }
      })
      .catch(() => {});

    setMounted(true);
  }, [router]);

  const handleSaveContact = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    setSavingContact(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-user-email': localStorage.getItem('userEmail') || '' },
        body: JSON.stringify({ notificationEmail: notificationEmail.trim(), whatsappNumber: whatsappNumber.trim() }),
      });
      if (res.ok) {
        localStorage.setItem('notificationEmail', notificationEmail.trim());
        localStorage.setItem('whatsappNumber', whatsappNumber.trim());
        setContactSaved(true);
        setTimeout(() => setContactSaved(false), 2000);
      }
    } catch {}
    setSavingContact(false);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const set = (key: keyof Prefs) => (val: boolean) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    localStorage.setItem('notificationPrefs', JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Link href="/account" className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-white/80 text-sm">Manage alerts, digests, and communication preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400 font-medium text-center"
          >
            Preferences saved ✓
          </motion.div>
        )}

        {/* Order & Shopping */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Orders &amp; Shopping</h2>
          </div>
          <ToggleRow label="Order Updates" description="Shipping, delivery, and return status" checked={prefs.orderUpdates} onChange={set('orderUpdates')} />
          <ToggleRow label="Price Drop Alerts" description="When items in your wishlist go on sale" checked={prefs.priceDrops} onChange={set('priceDrops')} />
          <ToggleRow label="Flash Sales" description="Limited-time deals and early access offers" checked={prefs.flashSales} onChange={set('flashSales')} />
          <ToggleRow label="New Arrivals" description="Fresh products matching your preferences" checked={prefs.newArrivals} onChange={set('newArrivals')} />
        </motion.div>

        {/* AI Notifications */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">AI &amp; Personalization</h2>
          </div>
          <ToggleRow label="AI Recommendations" description="Personalized product suggestions from your delegate" checked={prefs.aiRecommendations} onChange={set('aiRecommendations')} />
          <ToggleRow label="Weekly AI Digest" description="Summary of AI activity and spending insights" checked={prefs.weeklyDigest} onChange={set('weeklyDigest')} />
        </motion.div>

        {/* Channels */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Notification Channels</h2>
          </div>
          <div className="flex items-center gap-2 py-3 border-b border-gray-100 dark:border-gray-800">
            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Email</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Digest and important alerts</p>
            </div>
            <button onClick={() => set('emailEnabled')(!prefs.emailEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${prefs.emailEnabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 py-3 border-b border-gray-100 dark:border-gray-800">
            <Smartphone className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Browser &amp; mobile app alerts</p>
            </div>
            <button onClick={() => set('pushEnabled')(!prefs.pushEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${prefs.pushEnabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs.pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 py-3">
            <Tag className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">SMS Alerts</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Critical order & delivery updates</p>
            </div>
            <button onClick={() => set('smsEnabled')(!prefs.smsEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${prefs.smsEnabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs.smsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </motion.div>

        {/* Notification Contact Info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4 text-pink-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Notification Contact Details</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Set a separate notification email and WhatsApp number for alerts. These can be different from your login email.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Notification Email
              </label>
              <input
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="alerts@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="text-xs text-gray-400 mt-1">Order updates and AI alerts will be sent here</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="text-xs text-gray-400 mt-1">Shopping list results will be sent to WhatsApp with a direct view link</p>
            </div>

            <button
              onClick={handleSaveContact}
              disabled={savingContact}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {contactSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {contactSaved ? 'Saved!' : savingContact ? 'Saving...' : 'Save Contact Info'}
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Brain, ChevronLeft, Loader2, Save, ToggleLeft, ToggleRight,
  Zap, Shield, Target, Sliders, Lock,
} from 'lucide-react';

export default function AIPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // AI preferences
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState(true);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [budgetPreference, setBudgetPreference] = useState('balanced');
  const [deliveryPreference, setDeliveryPreference] = useState('standard');

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : '';

  const ALL_CATEGORIES = [
    'Electronics', 'Fashion', 'Home & Kitchen', 'Beauty', 'Sports',
    'Books', 'Grocery', 'Stationery', 'Fitness', 'Toys',
  ];

  useEffect(() => {
    if (!token) { router.push('/signin'); return; }
    loadPreferences();
  }, []);

  async function loadPreferences() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-preferences', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      if (data.priceAlerts !== undefined) setPriceAlerts(data.priceAlerts);
      if (data.aiRecommendations !== undefined) setAiRecommendations(data.aiRecommendations);
      if (Array.isArray(data.preferredCategories)) setPreferredCategories(data.preferredCategories);
      if (data.budgetPreference) setBudgetPreference(data.budgetPreference);
      if (data.deliveryPreference) setDeliveryPreference(data.deliveryPreference);
    } catch {}
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/ai-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          priceAlerts,
          aiRecommendations,
          preferredCategories,
          budgetPreference,
          deliveryPreference,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }

  const toggleCategory = (cat: string) => {
    setPreferredCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-600" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI Plus Required</h2>
          <p className="text-sm text-gray-500 mb-6">AI Preferences are available exclusively to AI Plus subscribers. Upgrade your plan to configure your AI assistant.</p>
          <Link href="/ai-plus" className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors">
            Upgrade to AI Plus
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/account" className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white mb-4 transition-colors">
            <ChevronLeft size={16} /> Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Brain size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Preferences</h1>
              <p className="text-sm text-white/80">Configure how your AI assistant behaves</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Recommendations */}
        <Section title="Recommendations & Alerts" icon={Zap} desc="Manage how AI communicates with you">
          <ToggleRow label="AI Product Recommendations" desc="Get personalized product suggestions" checked={aiRecommendations} onChange={setAiRecommendations} />
          <ToggleRow label="Price Drop Alerts" desc="Get notified when tracked items drop in price" checked={priceAlerts} onChange={setPriceAlerts} />
        </Section>

        {/* Budget Preference */}
        <Section title="Budget Intelligence" icon={Target} desc="Tell AI how to prioritize your spending">
          <div className="space-y-2">
            {[
              { value: 'budget', label: 'Budget-Friendly', desc: 'Prioritize lower prices and deals' },
              { value: 'balanced', label: 'Balanced', desc: 'Mix of quality and value' },
              { value: 'premium', label: 'Premium', desc: 'Prioritize quality and top brands' },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${budgetPreference === opt.value ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <input type="radio" name="budget" value={opt.value} checked={budgetPreference === opt.value} onChange={() => setBudgetPreference(opt.value)} className="accent-violet-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Delivery Preference */}
        <Section title="Delivery Preference" icon={Sliders} desc="How AI should prioritize delivery speed">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'fastest', label: 'Fastest Delivery' },
              { value: 'standard', label: 'Standard (Free)' },
              { value: 'cheapest', label: 'Cheapest Option' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setDeliveryPreference(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${deliveryPreference === opt.value ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Preferred Categories */}
        <Section title="Preferred Categories" icon={Shield} desc="Help AI understand your shopping interests">
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${preferredCategories.includes(cat) ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                {cat}
              </button>
            ))}
          </div>
        </Section>

        {/* Save Button */}
        <div className="sticky bottom-4 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 shadow-lg shadow-violet-500/25 transition-all">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, desc, children }: { title: string; icon: any; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
          <Icon size={18} className="text-violet-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h2>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button onClick={() => onChange(!checked)} className="flex-shrink-0">
        {checked ? (
          <ToggleRight size={32} className="text-violet-600" />
        ) : (
          <ToggleLeft size={32} className="text-gray-400" />
        )}
      </button>
    </div>
  );
}

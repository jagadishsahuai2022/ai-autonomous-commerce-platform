/**
 * Memory Insights Dashboard - Show user preferences and AI insights
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MemoryDashboardPage() {
  const [memory, setMemory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchMemory();
  }, []);

  const fetchMemory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/memory/summary', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setMemory(data);
    } catch (error) {
      console.error('Failed to fetch memory:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading your memory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="border-b border-indigo-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 mb-3 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">🧠 Your Memory AI</h1>
          <p className="text-gray-600 mt-1">Personalization insights & recommendations powered by AI</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Memory Quality Score */}
        <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Memory Health Score</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MemoryMetricCard
              label="Accuracy"
              value={Math.round(memory?.insights?.predictionAccuracy * 100 || 75)}
              unit="%"
              icon="🎯"
            />
            <MemoryMetricCard
              label="Auto-Decision Confidence"
              value={Math.round(memory?.insights?.autoDecisionConfidence * 100 || 65)}
              unit="%"
              icon="🤖"
            />
            <MemoryMetricCard
              label="Conversion Lift"
              value={Math.round(memory?.insights?.conversionLift || 12)}
              unit="%"
              icon="📈"
            />
            <MemoryMetricCard
              label="Churn Risk"
              value={Math.round(memory?.insights?.churnRisk * 100 || 10)}
              unit="%"
              icon="⚠️"
              isRisk
            />
            <MemoryMetricCard
              label="Memory Age"
              value={memory?.memory?.memoryAge || 0}
              unit="days"
              icon="📅"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          {['overview', 'preferences', 'patterns', 'recommendations'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-semibold transition ${
                activeTab === tab
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab memory={memory} />}
        {activeTab === 'preferences' && <PreferencesTab preferences={memory?.preferences} />}
        {activeTab === 'patterns' && <PatternsTab patterns={memory?.patterns} />}
        {activeTab === 'recommendations' && <RecommendationsTab insights={memory?.insights} />}
      </div>
    </div>
  );
}

// ==================== Tab Components ====================

function OverviewTab({ memory }: { memory: any }) {
  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🧠 AI Insights</h3>
        <ul className="space-y-2">
          {memory?.insights?.topInsights?.map((insight: string, i: number) => (
            <li key={i} className="flex gap-3 text-gray-700">
              <span className="text-indigo-600 font-bold">▸</span>
              {insight}
            </li>
          )) || <p className="text-gray-600">No insights yet. Keep shopping to build your memory!</p>}
        </ul>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricBox
          title="Purchase Probability"
          value={Math.round(memory?.insights?.purchaseProbability * 100 || 0)}
          unit="%"
          color="blue"
        />
        <MetricBox
          title="Avg Order Value Lift"
          value={Math.round(memory?.insights?.avgOrderValueLift || 0)}
          unit="%"
          color="green"
        />
        <MetricBox
          title="Engagement Increase"
          value={Math.round(memory?.insights?.engagementIncrease || 0)}
          unit="%"
          color="purple"
        />
      </div>

      {/* Auto-Decisions Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Auto-Decision Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Decisions</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {memory?.recentAutoDecisions?.length || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Acceptance Rate</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {memory?.memory?.autoDecisionSuccessRate
                ? Math.round(memory.memory.autoDecisionSuccessRate * 100)
                : 0}
              %
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Enabled Features</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {[memory?.preferences?.autoDecisionsEnabled, memory?.preferences?.autoAddToCart, memory?.preferences?.autoPurchaseEnabled].filter(Boolean).length}
              /3
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferencesTab({ preferences }: { preferences: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Preferred Categories</h3>
        <div className="flex flex-wrap gap-2">
          {preferences?.preferredCategories?.length ? (
            preferences.preferredCategories.map((cat: string, i: number) => (
              <span
                key={i}
                className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold"
              >
                ✓ {cat}
              </span>
            ))
          ) : (
            <p className="text-gray-600">No preferences set yet</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Preferred Brands</h3>
        <div className="flex flex-wrap gap-2">
          {preferences?.preferredBrands?.length ? (
            preferences.preferredBrands.map((brand: string, i: number) => (
              <span
                key={i}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold"
              >
                {brand}
              </span>
            ))
          ) : (
            <p className="text-gray-600">No preferred brands yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Price Range</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {preferences?.priceMin || '—'} — {preferences?.priceMax || '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Minimum Quality Rating</p>
          <p className="text-2xl font-bold text-yellow-600 mt-2">
            ⭐ {preferences?.minQualityRating || 3.0} / 5.0
          </p>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Auto-Decision Settings</h3>
        <div className="space-y-2">
          <SettingRow
            label="Auto-Add to Cart"
            enabled={preferences?.autoAddToCart}
          />
          <SettingRow
            label="Auto-Purchase Enabled"
            enabled={preferences?.autoPurchaseEnabled}
          />
          <SettingRow
            label="Personalization Active"
            enabled={preferences?.autoDecisionsEnabled}
          />
        </div>
      </div>
    </div>
  );
}

function PatternsTab({ patterns }: { patterns: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Shopping Behavior</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PatternMetric
            label="Purchases/Month"
            value={Math.round(patterns?.avgPurchasesPerMonth * 10) / 10 || 0}
          />
          <PatternMetric
            label="Avg Order Value"
            value={`₹${Math.round(patterns?.averageOrderValue || 0)}`}
          />
          <PatternMetric
            label="Category Variety"
            value={`${Math.round(patterns?.categoryVariety * 100 || 0)}%`}
          />
          <PatternMetric
            label="Purchase Gap"
            value={`${patterns?.purchaseGap || 30} days`}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Top Categories</h3>
        <div className="space-y-2">
          {patterns?.topCategories?.slice(0, 5).map((cat: string, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{ width: `${(5 - i) * 20}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-700 w-24">{cat}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Spending Trend</p>
          <p className="text-xl font-bold text-green-600 mt-2">
            📈 {patterns?.spendingTrend || 'stable'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Brand Loyalty</p>
          <p className="text-xl font-bold text-blue-600 mt-2">
            {Math.round((patterns?.repeatBrandPurchaseRate || 0) * 100)}%
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Next Purchase In</p>
          <p className="text-xl font-bold text-purple-600 mt-2">
            ~{patterns?.daysUntilNextPurchase || 21} days
          </p>
        </div>
      </div>
    </div>
  );
}

function RecommendationsTab({ insights }: { insights: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Recommended For You</h3>
        <p className="text-gray-700 mb-4">
          Based on your preferences and shopping history
        </p>
        <div className="flex flex-wrap gap-2">
          {insights?.recommendedCategories?.map((cat: string, i: number) => (
            <span
              key={i}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              {cat} +
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🏆 Top Brands For You</h3>
        <div className="space-y-2">
          {insights?.recommendedBrands?.slice(0, 5).map((brand: string, i: number) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold text-gray-900">{brand}</p>
              <p className="text-xs text-gray-600 mt-1">Based on your preferences</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Emerging Interests</p>
          <div className="space-y-1">
            {insights?.emergingInterests?.slice(0, 3).map((interest: string, i: number) => (
              <p key={i} className="text-sm text-green-700">📌 {interest}</p>
            ))}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Fading Interests</p>
          <div className="space-y-1">
            {insights?.fadingInterests?.slice(0, 3).map((interest: string, i: number) => (
              <p key={i} className="text-sm text-orange-700">📉 {interest}</p>
            ))}
          </div>
        </div>
      </div>

      <button className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition">
        View All Recommendations →
      </button>
    </div>
  );
}

// ==================== Helper Components ====================

function MemoryMetricCard({
  label,
  value,
  unit,
  icon,
  isRisk,
}: {
  label: string;
  value: number;
  unit: string;
  icon: string;
  isRisk?: boolean;
}) {
  const color = isRisk
    ? value < 20
      ? 'green'
      : value < 50
        ? 'yellow'
        : 'red'
    : value > 80
      ? 'green'
      : value > 60
        ? 'yellow'
        : 'red';

  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <p className="text-3xl">{icon}</p>
      <p className="text-sm text-gray-600 mt-2">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${
        color === 'green' ? 'text-green-600' :
        color === 'yellow' ? 'text-yellow-600' :
        'text-red-600'
      }`}>
        {value}{unit}
      </p>
    </div>
  );
}

function MetricBox({
  title,
  value,
  unit,
  color,
}: {
  title: string;
  value: number;
  unit: string;
  color: string;
}) {
  const bgColor =
    color === 'green'
      ? 'bg-green-50'
      : color === 'purple'
        ? 'bg-purple-50'
        : 'bg-blue-50';
  const textColor =
    color === 'green'
      ? 'text-green-600'
      : color === 'purple'
        ? 'text-purple-600'
        : 'text-blue-600';
  const borderColor =
    color === 'green'
      ? 'border-green-200'
      : color === 'purple'
        ? 'border-purple-200'
        : 'border-blue-200';

  return (
    <div className={`${bgColor} rounded-lg border ${borderColor} p-6`}>
      <p className="text-sm text-gray-600">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${textColor}`}>
        {value}{unit}
      </p>
    </div>
  );
}

function PatternMetric({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
      <p className="text-xs text-gray-600 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-indigo-600 mt-2">{value}</p>
    </div>
  );
}

function SettingRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
      <p className="font-semibold text-gray-900">{label}</p>
      <div className={`w-12 h-6 rounded-full transition ${
        enabled ? 'bg-green-500' : 'bg-gray-300'
      }`}>
        <div className={`w-5 h-5 rounded-full bg-white transition transform ${
          enabled ? 'translate-x-6' : 'translate-x-0.5'
        }`} />
      </div>
    </div>
  );
}

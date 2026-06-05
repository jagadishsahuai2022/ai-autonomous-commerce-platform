/**
 * Seller Dashboard Page
 * Main dashboard for sellers with AI-powered insights
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Demo data - replace with API calls
const DEMO_DASHBOARD = {
  overview: {
    activeListings: 24,
    totalSales: 450000,
    totalRevenue: 1250000,
    averageRating: 4.7,
  },
  performanceMetrics: {
    totalViews: 12450,
    totalClicks: 1870,
    totalConversions: 145,
    overallConversionRate: 7.75,
    weekOverWeekGrowth: 12.5,
  },
  aiInsights: {
    generatedListingsCount: 8,
    avgGeneratedListingScore: 87,
    priceSuggestionsAccepted: 5,
    revenueLiftFromAi: 85000,
    demandForecastAccuracy: 82,
  },
  topProducts: [
    { name: 'Samsung TV 55"', sales: 42, revenue: 188000 },
    { name: 'iPhone 14 Pro', sales: 28, revenue: 280000 },
    { name: 'AirPods Pro', sales: 35, revenue: 105000 },
    { name: 'iPad Air', sales: 22, revenue: 165000 },
    { name: 'MacBook Air', sales: 18, revenue: 198000 },
  ],
  chartData: [
    { date: 'Mon', views: 320, clicks: 48, conversions: 4 },
    { date: 'Tue', views: 240, clicks: 36, conversions: 3 },
    { date: 'Wed', views: 200, clicks: 30, conversions: 2 },
    { date: 'Thu', views: 278, clicks: 42, conversions: 3 },
    { date: 'Fri', views: 189, clicks: 28, conversions: 2 },
    { date: 'Sat', views: 239, clicks: 36, conversions: 3 },
    { date: 'Sun', views: 349, clicks: 52, conversions: 4 },
  ],
};

export default function SellerDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(DEMO_DASHBOARD);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch dashboard metrics from API
    // const fetchDashboard = async () => {
    //   setLoading(true);
    //   try {
    //     const response = await fetch('/api/sellers/dashboard', {
    //       headers: { Authorization: `Bearer ${token}` },
    //     });
    //     const data = await response.json();
    //     setDashboard(data);
    //   } finally {
    //     setLoading(false);
    //   }
    // };
    // fetchDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="border-b border-indigo-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Seller Dashboard</h1>
              <p className="text-gray-600 mt-1">AI-powered insights and recommendations</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/sellers/create-listing"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                + Create Listing
              </Link>
              <Link
                href="/sellers/profile"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Store Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <OverviewCard
            title="Active Listings"
            value={dashboard.overview.activeListings}
            icon="📦"
            trend="+5 this week"
          />
          <OverviewCard
            title="Total Sales"
            value={`₹${(dashboard.overview.totalSales / 1000).toFixed(0)}K`}
            icon="💰"
            trend="+12% growth"
          />
          <OverviewCard
            title="Avg Rating"
            value={dashboard.overview.averageRating}
            icon="⭐"
            trend="From 142 reviews"
          />
          <OverviewCard
            title="Revenue"
            value={`₹${(dashboard.overview.totalRevenue / 100000).toFixed(1)}L`}
            icon="📈"
            trend="Last 30 days"
          />
        </div>

        {/* AI Insights Highlight */}
        <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">🤖 AI Insights</h2>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              Active
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <AIInsightBox
              label="Auto-Generated"
              value={dashboard.aiInsights.generatedListingsCount}
              unit="listings"
              icon="✨"
            />
            <AIInsightBox
              label="Avg Quality"
              value={dashboard.aiInsights.avgGeneratedListingScore}
              unit="/100"
              icon="📊"
            />
            <AIInsightBox
              label="Price Accept"
              value={dashboard.aiInsights.priceSuggestionsAccepted}
              unit="accepted"
              icon="💵"
            />
            <AIInsightBox
              label="Revenue Lift"
              value={`₹${dashboard.aiInsights.revenueLiftFromAi / 1000}K`}
              unit="from AI"
              icon="🚀"
            />
            <AIInsightBox
              label="Forecast"
              value={dashboard.aiInsights.demandForecastAccuracy}
              unit="% accurate"
              icon="🎯"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          {['overview', 'products', 'pricing', 'demand'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Performance Chart */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboard.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#6366f1"
                    name="Views"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="#f59e0b"
                    name="Clicks"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="conversions"
                    stroke="#10b981"
                    name="Conversions"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion Rates */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">CTR</span>
                    <span className="text-sm font-bold text-indigo-600">
                      {((dashboard.performanceMetrics.totalClicks / dashboard.performanceMetrics.totalViews) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: `${(dashboard.performanceMetrics.totalClicks / dashboard.performanceMetrics.totalViews) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Conversion</span>
                    <span className="text-sm font-bold text-green-600">
                      {dashboard.performanceMetrics.overallConversionRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${dashboard.performanceMetrics.overallConversionRate}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Week-over-week growth</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{dashboard.performanceMetrics.weekOverWeekGrowth}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Top Performing Products</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboard.topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill="#6366f1" name="Units Sold" />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <PricingSuggestions />
          </div>
        )}

        {activeTab === 'demand' && (
          <div className="space-y-6">
            <DemandPrediction />
          </div>
        )}
      </div>
    </div>
  );
}

// Overview Card Component
function OverviewCard({ title, value, icon, trend }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-2">
        <span className="text-3xl">{icon}</span>
        <span className="text-green-600 text-sm font-semibold">{trend}</span>
      </div>
      <p className="text-gray-600 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}

// AI Insight Box Component
function AIInsightBox({ label, value, unit, icon }: any) {
  return (
    <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-xs text-gray-600 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{unit}</p>
    </div>
  );
}

// Pricing Suggestions Component
function PricingSuggestions() {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);

  const getSuggestions = async () => {
    setLoading(true);
    // Mock API call
    setTimeout(() => {
      setSuggestions({
        recommendedPrice: 45000,
        basePrice: 40000,
        priceRange: { min: 38000, max: 52000 },
        expectedImpact: {
          salesLift: 15,
          revenueChange: 225000,
          conversionImprovement: 8,
        },
        confidence: 82,
      });
      setLoading(false);
    }, 500);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">💵 Price Optimization</h3>
          <p className="text-gray-600 text-sm mt-1">AI-powered price recommendations</p>
        </div>
        <button
          onClick={getSuggestions}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Get Suggestions'}
        </button>
      </div>

      {suggestions && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Current Price</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">₹{suggestions.basePrice}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Recommended</p>
              <p className="text-2xl font-bold text-green-600 mt-2">₹{suggestions.recommendedPrice}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Confidence</p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">{suggestions.confidence}%</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Expected Impact</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Sales Lift</span>
                <span className="font-bold text-green-600">+{suggestions.expectedImpact.salesLift}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Revenue Change</span>
                <span className="font-bold text-green-600">+₹{suggestions.expectedImpact.revenueChange}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Demand Prediction Component
function DemandPrediction() {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);

  const getPrediction = async () => {
    setLoading(true);
    setTimeout(() => {
      setPrediction({
        trend: 'up',
        percentageChange: 25,
        expectedConversions: 180,
        recommendation: 'Increase inventory by 50% for expected surge',
        peakDays: ['4-7', '12-14'],
      });
      setLoading(false);
    }, 500);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">📊 Demand Forecast</h3>
          <p className="text-gray-600 text-sm mt-1">Next 7 days prediction</p>
        </div>
        <button
          onClick={getPrediction}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Forecasting...' : 'Get Forecast'}
        </button>
      </div>

      {prediction && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Trend</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-3xl">{prediction.trend === 'up' ? '📈' : '📉'}</span>
                <span className="text-2xl font-bold text-purple-600">{prediction.percentageChange}%</span>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Expected Sales</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{prediction.expectedConversions}</p>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm font-semibold text-gray-900 mb-2">AI Recommendation</p>
            <p className="text-gray-700">{prediction.recommendation}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Peak Days</p>
            <div className="flex gap-2">
              {prediction.peakDays.map((day: string) => (
                <span key={day} className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-full">
                  Day {day}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

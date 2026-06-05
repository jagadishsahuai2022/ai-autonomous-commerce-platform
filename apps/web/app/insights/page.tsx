'use client';

import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, Lightbulb, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics.service';

function InsightCard({ icon: Icon, title, description, value = '' }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
          <Icon size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">{description}</p>
          {value && <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-2">{value}</p>}
        </div>
      </div>
    </motion.div>
  );
}

function InsightsContent() {
  const { data: insights, isLoading } = useQuery({
    queryKey: ['insights-dashboard'],
    queryFn: () => analyticsService.getInsights(),
  });

  const { data: trends } = useQuery({
    queryKey: ['demand-trends'],
    queryFn: () => analyticsService.getDemandTrends(),
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded" />)}</div>;

  return (
    <>
      {/* Pricing Insights */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">💰 Pricing Optimization</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights?.pricingInsights?.slice(0, 2).map((insight: any, i: number) => (
            <InsightCard
              key={i}
              icon={TrendingUp}
              title="Price Optimization"
              description={`Suggested: ₹${insight.suggestedPrice?.toLocaleString('en-IN')} (+${insight.priceOptimization}% lift expected)`}
              value={`₹${insight.currentPrice?.toLocaleString('en-IN')} → ₹${insight.suggestedPrice?.toLocaleString('en-IN')}`}
            />
          ))}
        </div>
      </div>

      {/* Demand Trends */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">📈 Demand Trends</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trends?.slice(0, 2).map((trend: any, i: number) => (
            <InsightCard
              key={i}
              icon={trend.trend === 'up' ? Zap : AlertCircle}
              title={`${trend.category} ${trend.trend === 'up' ? '↑' : '↓'}`}
              description={`${trend.percentageChange > 0 ? '+' : ''}${trend.percentageChange}% change in demand`}
              value={`Forecast: ${trend.forecastedDemand} units`}
            />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">🎯 AI Recommendations</h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700"
        >
          <ul className="space-y-3">
            {insights?.marketOpportunities?.slice(0, 5).map((opportunity: string, i: number) => (
              <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                <Lightbulb className="text-yellow-500" size={20} />
                {opportunity}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </>
  );
}

export default function InsightsDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">🧠 AI Insights</h1>
          <p className="text-slate-600 dark:text-gray-400">AI-powered recommendations for your business</p>
        </motion.div>

        <Suspense fallback={<div className="animate-pulse">Loading insights...</div>}>
          <InsightsContent />
        </Suspense>
      </div>
    </div>
  );
}

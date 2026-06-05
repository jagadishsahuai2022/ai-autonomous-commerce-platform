'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    percent: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'primary';
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon,
  variant = 'primary',
  onClick,
  className = '',
}: MetricCardProps) {
  const variantClasses = {
    success: 'from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 border-green-200/50 dark:border-green-500/20',
    warning: 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5 border-amber-200/50 dark:border-amber-500/20',
    error: 'from-red-500/10 to-pink-500/10 dark:from-red-500/5 dark:to-pink-500/5 border-red-200/50 dark:border-red-500/20',
    info: 'from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 border-blue-200/50 dark:border-blue-500/20',
    primary: 'from-primary-500/10 to-accent-500/10 dark:from-primary-500/5 dark:to-accent-500/5 border-primary-200/50 dark:border-primary-500/20',
  };

  const iconBgClasses = {
    success: 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    error: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    primary: 'bg-primary-100 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400',
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={cn(
        'neon-box rounded-2xl p-6 cursor-pointer',
        'bg-gradient-to-br', variantClasses[variant],
        'border transition-all duration-300',
        'hover:shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]',
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
        </div>

        {icon && <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', iconBgClasses[variant])}>{icon}</div>}
      </div>

      {change && (
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-sm font-semibold">
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full',
              change.isPositive ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
            )}
          >
            {change.isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>{change.isPositive ? '+' : '-'}
              {Math.abs(change.percent)}%</span>
          </div>
          <span className="text-gray-600 dark:text-gray-400">vs last month</span>
        </motion.div>
      )}
    </motion.div>
  );
}

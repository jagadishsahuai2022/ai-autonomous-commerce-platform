'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  min?: number;
  animated?: boolean;
  showPercentage?: boolean;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  min = 0,
  animated = true,
  showPercentage = true,
  variant = 'primary',
  size = 'md',
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);

  const variantClasses = {
    success: 'from-green-500 to-emerald-500',
    warning: 'from-amber-500 to-orange-500',
    error: 'from-red-500 to-pink-500',
    info: 'from-blue-500 to-cyan-500',
    primary: 'from-primary-500 to-primary-600',
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden',
          'shadow-inset',
          sizeClasses[size]
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            `bg-gradient-to-r ${variantClasses[variant]}`,
            'shadow-lg',
            animated && 'animate-gradient-shift',
            'will-change-transform'
          )}
        />
      </div>
      {showPercentage && (
        <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-400 text-right">
          {Math.round(percentage * 100)}%
        </div>
      )}
    </div>
  );
}

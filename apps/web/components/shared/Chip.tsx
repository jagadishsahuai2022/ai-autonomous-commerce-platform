'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ChipProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  removable?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function Chip({
  label,
  variant = 'default',
  removable = false,
  onRemove,
  icon,
  className = '',
}: ChipProps) {
  const variantClasses = {
    default: 'bg-primary-100 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-500/20',
    success: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/20',
    warning: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
    error: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20',
    info: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'inline-flex items-center gap-2',
        'px-3 py-1.5 rounded-full',
        'border text-xs font-semibold',
        'transition-all duration-200',
        variantClasses[variant],
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
      {removable && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRemove}
          className="ml-1 flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X size={14} />
        </motion.button>
      )}
    </motion.div>
  );
}

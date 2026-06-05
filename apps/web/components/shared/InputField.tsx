'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  variant?: 'default' | 'glass' | 'gradient';
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
  helperText?: string;
  className?: string;
}

export function InputField({
  label,
  variant = 'default',
  error,
  success,
  icon,
  helperText,
  className = '',
  disabled,
  ...props
}: InputFieldProps) {
  const variantClasses = {
    default: 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900',
    glass: 'input-ai-glass border-0',
    gradient: 'gradient-border-animated border-0 relative',
  };

  const focusClasses = 'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">{icon}</div>}

        <input
          disabled={disabled}
          className={cn(
            'w-full px-4 py-2.5 rounded-lg',
            'text-gray-900 dark:text-white',
            'placeholder-gray-400 dark:placeholder-gray-500',
            focusClasses,
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            variantClasses[variant],
            icon && 'pl-10',
            error && 'border-red-500 dark:border-red-400',
            success && 'border-green-500 dark:border-green-400',
            className
          )}
          {...props}
        />

        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
            <AlertCircle size={18} />
          </div>
        )}
        {success && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <CheckCircle2 size={18} />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
      {helperText && !error && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{helperText}</p>}
    </motion.div>
  );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  neon?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function GradientButton({
  children,
  variant = 'primary',
  size = 'md',
  neon = false,
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}: GradientButtonProps) {
  const variantClasses = {
    primary: 'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-lg hover:shadow-ai-glow',
    secondary: 'bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-gray-900 dark:text-white hover:shadow-md',
    ghost: 'bg-transparent border border-primary-500/50 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <motion.button
      ref={undefined as any}
      whileHover={!disabled && !loading ? { scale: 1.05 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.95 } : undefined}
      disabled={disabled || loading}
      className={cn(
        'font-semibold rounded-lg transition-all duration-200',
        'flex items-center justify-center gap-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        neon && 'neon-button',
        className
      )}
      {...(props as any)}
    >
      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-transparent border-t-current rounded-full"
        />
      ) : (
        icon
      )}
      <span>{children}</span>
    </motion.button>
  );
}

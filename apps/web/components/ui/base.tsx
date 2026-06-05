'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export function SkeletonLoader({
  count = 3,
  height = 'h-16',
}: {
  count?: number;
  height?: string;
}) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`${height} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl`}
          animate={{
            backgroundPosition: ['0%', '100%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
        />
      ))}
    </div>
  );
}

export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center space-y-4 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-8 h-8 text-indigo-600" />
      </motion.div>
      <p className="text-sm text-gray-600">{label}</p>
    </motion.div>
  );
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variants = {
    default: 'bg-indigo-100 text-indigo-800',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-800',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = '',
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      className={`rounded-2xl bg-white border border-gray-100 ${
        hover ? 'hover:border-gray-200 hover:shadow-lg' : ''
      } transition-all ${className}`}
      whileHover={hover ? { y: -2 } : {}}
    >
      {children}
    </motion.div>
  );
}

export function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={`rounded-2xl bg-white/80 backdrop-blur-md border border-white/20 shadow-lg ${className}`}
      whileHover={{ y: -2 }}
    >
      {children}
    </motion.div>
  );
}

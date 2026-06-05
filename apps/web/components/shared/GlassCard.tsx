'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface GlassCardProps {
  children: React.ReactNode;
  hoverable?: boolean;
  neon?: boolean;
  depth?: 'shallow' | 'medium' | 'deep';
  onClick?: () => void;
  className?: string;
}

export function GlassCard({
  children,
  hoverable = true,
  neon = false,
  depth = 'medium',
  onClick,
  className = '',
}: GlassCardProps) {
  const depthClasses = {
    shallow: 'glass-layer-1',
    medium: 'glass-layer-2',
    deep: 'glass-depth',
  };

  return (
    <motion.div
      whileHover={hoverable ? { y: -2 } : undefined}
      onClick={onClick}
      className={cn(
        depthClasses[depth],
        neon && 'neon-box',
        'rounded-2xl backdrop-blur-glass transition-all duration-300',
        'border border-white/10 dark:border-white/5',
        'bg-white/5 dark:bg-white/[0.03]',
        hoverable && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

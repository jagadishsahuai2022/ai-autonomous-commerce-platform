'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ConfidenceIndicatorProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { container: 48, stroke: 4, fontSize: 'text-xs', labelSize: 'text-[8px]' },
  md: { container: 72, stroke: 5, fontSize: 'text-sm', labelSize: 'text-[10px]' },
  lg: { container: 96, stroke: 6, fontSize: 'text-base', labelSize: 'text-xs' },
};

function getColor(score: number) {
  if (score >= 80) return { stroke: '#22c55e', text: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30' };
  if (score >= 60) return { stroke: '#f59e0b', text: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' };
  return { stroke: '#ef4444', text: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' };
}

function getLabel(score: number) {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
}

export function ConfidenceIndicator({
  score,
  size = 'md',
  showLabel = true,
  className,
}: ConfidenceIndicatorProps) {
  const { container, stroke, fontSize, labelSize } = SIZE_MAP[size];
  const { stroke: strokeColor, text } = getColor(score);
  const radius = (container - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = container / 2;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: container, height: container }}>
        <svg width={container} height={container} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Animated progress ring */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn('font-bold tabular-nums', fontSize, text)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}%
          </motion.span>
        </div>
      </div>
      {showLabel && (
        <span className={cn('font-semibold', labelSize, text)}>{getLabel(score)}</span>
      )}
    </div>
  );
}

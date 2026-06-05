/**
 * Unified Loading Component — single source of truth for all loading states.
 * Use <UnifiedLoader /> in all loading.tsx files and inline loading states.
 */

import { motion } from 'framer-motion';

interface UnifiedLoaderProps {
  /** Text below the spinner. Defaults to "Loading..." */
  text?: string;
  /** Overall size: 'sm' | 'md' | 'lg'. Default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to center in full page viewport. Default true */
  fullPage?: boolean;
}

const SIZES = {
  sm: { ring: 'w-6 h-6 border-2', dot: 'w-1.5 h-1.5', text: 'text-xs', gap: 'gap-2' },
  md: { ring: 'w-10 h-10 border-[3px]', dot: 'w-2 h-2', text: 'text-sm', gap: 'gap-3' },
  lg: { ring: 'w-14 h-14 border-4', dot: 'w-2.5 h-2.5', text: 'text-base', gap: 'gap-4' },
};

export default function UnifiedLoader({ text = 'Loading...', size = 'md', fullPage = true }: UnifiedLoaderProps) {
  const s = SIZES[size];

  return (
    <div className={fullPage ? 'min-h-[60vh] flex items-center justify-center p-6' : 'flex items-center justify-center py-8'}>
      <div className={`flex flex-col items-center ${s.gap}`}>
        {/* Gradient spinning ring */}
        <div className="relative">
          <div
            className={`${s.ring} rounded-full border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 animate-spin`}
          />
          {/* Pulsing dot in center */}
          <span className={`absolute inset-0 m-auto ${s.dot} rounded-full bg-indigo-500 animate-pulse`} />
        </div>
        {text && (
          <p className={`${s.text} font-medium text-slate-500 dark:text-slate-400 animate-pulse`}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Static variant that doesn't require framer-motion (safe for loading.tsx files
 * which must be plain React since they render before client JS loads).
 */
export function StaticLoader({ text = 'Loading...', size = 'md', fullPage = true }: UnifiedLoaderProps) {
  const s = SIZES[size];

  return (
    <div className={fullPage ? 'min-h-[60vh] flex items-center justify-center p-6' : 'flex items-center justify-center py-8'}>
      <div className={`flex flex-col items-center ${s.gap}`}>
        <div className="relative">
          <div
            className={`${s.ring} rounded-full border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 animate-spin`}
          />
          <span className={`absolute inset-0 m-auto ${s.dot} rounded-full bg-indigo-500 animate-pulse`} />
        </div>
        {text && (
          <p className={`${s.text} font-medium text-slate-500 dark:text-slate-400 animate-pulse`}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}

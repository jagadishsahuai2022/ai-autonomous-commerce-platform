/**
 * DelegateCart Unified Logo Component
 * 
 * A single reusable SVG logo used across the entire app — header, footer,
 * shopping assistant, loading states, etc.
 *
 * Features an AI-themed futuristic design combining a shopping cart with
 * neural network nodes, encapsulating the AI+Commerce brand identity.
 */

'use client';

import React from 'react';

interface LogoProps {
  size?: number;
  variant?: 'full' | 'icon' | 'text';
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

/**
 * Icon-only logo — the "DC" glyph with AI circuit accent
 */
export function LogoIcon({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DelegateCart logo"
    >
      <defs>
        <linearGradient id="dc-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="dc-accent" x1="28" y1="4" x2="36" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="40" height="40" rx="10" fill="url(#dc-grad)" />
      {/* "DC" text */}
      <text x="20" y="26" textAnchor="middle" fill="white" fontFamily="system-ui, -apple-system, sans-serif" fontSize="17" fontWeight="800" letterSpacing="-0.5">
        DC
      </text>
      {/* AI circuit nodes — top-right accent */}
      <circle cx="32" cy="8" r="2" fill="url(#dc-accent)" opacity="0.9" />
      <circle cx="36" cy="12" r="1.5" fill="#06B6D4" opacity="0.7" />
      <line x1="32" y1="8" x2="36" y2="12" stroke="#06B6D4" strokeWidth="0.8" opacity="0.6" />
      <circle cx="28" cy="5" r="1" fill="#8B5CF6" opacity="0.5" />
      <line x1="28" y1="5" x2="32" y2="8" stroke="#8B5CF6" strokeWidth="0.6" opacity="0.4" />
    </svg>
  );
}

/**
 * Full logo with icon + text
 */
export function Logo({ size = 36, variant = 'full', theme = 'auto', className = '' }: LogoProps) {
  if (variant === 'icon') {
    return <LogoIcon size={size} className={className} />;
  }

  const textClass = theme === 'dark'
    ? 'text-white'
    : theme === 'light'
    ? 'text-gray-900'
    : 'text-gray-900 dark:text-white';

  const subtitleClass = theme === 'dark'
    ? 'text-gray-400'
    : theme === 'light'
    ? 'text-slate-500'
    : 'text-slate-500 dark:text-gray-400';

  if (variant === 'text') {
    return (
      <div className={`flex flex-col gap-0.5 ${className}`}>
        <span className={`text-xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent leading-tight`}>
          DelegateCart
        </span>
        <span className={`text-[10px] font-medium leading-none ${subtitleClass}`}>
          AI-Powered E-Commerce
        </span>
      </div>
    );
  }

  // Full variant: icon + text
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={size} />
      <div className="hidden sm:flex flex-col gap-0.5">
        <span className={`text-xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent leading-tight`}>
          DelegateCart
        </span>
        <span className={`text-[10px] font-medium leading-none ${subtitleClass}`}>
          AI-Powered E-Commerce
        </span>
      </div>
    </div>
  );
}

/**
 * Footer logo variant — lighter colors for dark backgrounds
 */
export function FooterLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={32} />
      <span className="text-white font-bold text-lg tracking-tight">DelegateCart</span>
      <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-600/80 to-cyan-600/80 text-white text-[9px] font-bold">AI+</span>
    </div>
  );
}

export default Logo;

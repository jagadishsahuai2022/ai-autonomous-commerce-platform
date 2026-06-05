'use client';

import { motion, Variants } from 'framer-motion';
import { Search, AlertCircle, ShoppingCart, Clock } from 'lucide-react';
import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'search' | 'no-results' | 'no-history';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  const getDefaultIcon = () => {
    switch (variant) {
      case 'search':
        return Search;
      case 'no-results':
        return ShoppingCart;
      case 'no-history':
        return Clock;
      default:
        return AlertCircle;
    }
  };

  const DefaultIcon = getDefaultIcon() as React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  const DisplayIcon = Icon || DefaultIcon;

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut' as const,
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      {/* Icon */}
      <motion.div
        variants={itemVariants}
        className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50"
      >
        <DisplayIcon className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
      </motion.div>

      {/* Title */}
      <motion.h3 variants={itemVariants} className="text-lg font-bold text-slate-900 mb-2">
        {title}
      </motion.h3>

      {/* Description */}
      {description && (
        <motion.p
          variants={itemVariants}
          className="text-sm text-slate-600 text-center max-w-sm mb-6"
        >
          {description}
        </motion.p>
      )}

      {/* Action Button */}
      {action && (
        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * Error State Component
 */
interface ErrorStateProps {
  title: string;
  description?: string;
  error?: Error;
  onRetry?: () => void;
  showDetails?: boolean;
}

export function ErrorState({
  title,
  description,
  error,
  onRetry,
  showDetails = false,
}: ErrorStateProps) {
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 p-6"
    >
      <div className="flex gap-4">
        {/* Icon */}
        <motion.div
          initial={{ rotate: -90 }}
          animate={{ rotate: 0 }}
          className="flex-shrink-0"
        >
          <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={2} />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-red-900 mb-1">{title}</h3>

          {description && (
            <p className="text-sm text-red-800 mb-3">{description}</p>
          )}

          {/* Error Details */}
          {showDetails && error && (
            <motion.div
              initial={{ opacity: 0, maxHeight: 0 }}
              animate={{ opacity: 1, maxHeight: 200 }}
              className="mt-3 p-3 bg-red-100 rounded-lg text-xs text-red-900 font-mono overflow-auto max-h-32"
            >
              {error.message}
            </motion.div>
          )}

          {/* Retry Button */}
          {onRetry && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRetry}
              className="mt-3 text-sm font-semibold text-red-600 hover:text-red-700 underline"
            >
              Try again
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Error Boundary Component
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <div className="p-4">
          <ErrorState
            title="Something went wrong"
            description="We encountered an unexpected error. Please try again."
            error={this.state.error}
            onRetry={this.handleRetry}
            showDetails={process.env.NODE_ENV === 'development'}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Loading State Component
 */
interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  const dotVariants = {
    animate: {
      y: [0, -10, 0],
      opacity: [1, 0.5, 1],
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      {/* Animated Spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="mb-4"
      >
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-600 shadow-lg" />
      </motion.div>

      {/* Loading Dots */}
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            variants={dotVariants}
            animate="animate"
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.2,
            }}
            className="w-2 h-2 rounded-full bg-indigo-600"
          />
        ))}
      </div>

      {/* Message */}
      <p className="text-sm text-slate-600 font-medium">{message}</p>
    </motion.div>
  );
}

/**
 * Skeleton Block Component (generic placeholder)
 */
interface SkeletonBlockProps {
  width?: string;
  height?: string;
  className?: string;
}

export function SkeletonBlock({
  width = 'w-full',
  height = 'h-8',
  className = '',
}: SkeletonBlockProps) {
  return (
    <motion.div
      animate={{
        backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        backgroundSize: '200% 100%',
      }}
      className={`${width} ${height} rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 ${className}`}
    />
  );
}

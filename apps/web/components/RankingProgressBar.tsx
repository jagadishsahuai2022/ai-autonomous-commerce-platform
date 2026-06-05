/**
 * Ranking Progress Bar Component
 * Displays real-time progress of product ranking
 */

'use client';

import React from 'react';
import { Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface RankingProgressBarProps {
  progress: number; // 0-100
  status?: 'pending' | 'processing' | 'completed' | 'error';
  productsRanked?: number;
  totalProducts?: number;
  message?: string;
}

export const RankingProgressBar: React.FC<RankingProgressBarProps> = ({
  progress = 0,
  status = 'processing',
  productsRanked = 0,
  totalProducts = 0,
  message,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
      case 'processing':
      default:
        return <Zap className="w-5 h-5 text-blue-600 animate-pulse" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Ranking Complete!';
      case 'error':
        return 'Ranking Error';
      case 'pending':
        return 'Starting Ranking...';
      case 'processing':
      default:
        return 'Analyzing Products...';
    }
  };

  const getProgressBarColor = () => {
    switch (status) {
      case 'completed':
        return 'from-green-400 to-green-600';
      case 'error':
        return 'from-red-400 to-red-600';
      case 'pending':
        return 'from-gray-400 to-gray-600';
      case 'processing':
      default:
        return 'from-blue-400 to-purple-600';
    }
  };

  const displayProgress = status === 'error' ? 0 : progress;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-semibold text-gray-900">{getStatusText()}</span>
        </div>
        <span className="text-sm font-bold text-gray-900">{displayProgress}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-full bg-gradient-to-r ${getProgressBarColor()} transition-all duration-300`}
          style={{ width: `${displayProgress}%` }}
        >
          {status === 'processing' && (
            <div className="w-full h-full animate-shimmer"></div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div>
          {productsRanked > 0 && totalProducts > 0 && (
            <span>{productsRanked} of {totalProducts} products ranked</span>
          )}
          {message && <span className="block">{message}</span>}
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-gray-500">Algorithm Components</p>
            <div className="flex gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-gray-700">Quality</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-gray-700">Price</span>
            </div>
          </div>
        </div>
      </div>

      {/* Estimation */}
      {status === 'processing' && progress < 100 && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Analyzing budget fit, quality scores, brand preferences, delivery times, and ratings...
        </div>
      )}

      {status === 'completed' && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          ✓ Ranking complete! Recommendations are ready.
        </div>
      )}

      {status === 'error' && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          ✗ Error during ranking. Please try again.
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Animated Shimmer Style
// ============================================================================

export const ShimmerStyle = () => (
  <style>{`
    @keyframes shimmer {
      0% {
        background-position: -1200px 0;
      }
      100% {
        background-position: calc(1200px + 100%) 0;
      }
    }
    
    .animate-shimmer {
      animation: shimmer 1s infinite;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.3) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      background-size: 1200px 100%;
    }
  `}</style>
);

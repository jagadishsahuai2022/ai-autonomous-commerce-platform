/**
 * Feature Flags System
 * Dynamic feature toggle without code deployment
 * Supports: A/B testing, gradual rollouts, experiments
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  variant?: string;
  rolloutPercentage?: number;
  targetUsers?: string[];
  expiresAt?: Date;
}

interface FeatureFlagsContextType {
  flags: Map<string, FeatureFlag>;
  isFeatureEnabled: (name: string) => boolean;
  getFeatureVariant: (name: string) => string | undefined;
  reloadFlags: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

/**
 * Provider component - wrap your app with this
 */
export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Map<string, FeatureFlag>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Load feature flags from server
  const reloadFlags = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/feature-flags');
      if (!res.ok) throw new Error('Failed to fetch feature flags');

      const raw = await res.json();
      // Normalise: backend may return array or wrapped object
      const data: FeatureFlag[] = Array.isArray(raw) ? raw : (raw.data ?? raw.features ?? []);
      setFlags(new Map(data.map((flag: FeatureFlag) => [flag.name, flag])));
    } catch (error) {
      console.error('[FeatureFlags] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load on mount and refresh every 30 seconds
  useEffect(() => {
    reloadFlags();
    const interval = setInterval(reloadFlags, 30000);
    return () => clearInterval(interval);
  }, []);

  const isFeatureEnabled = (name: string): boolean => {
    const flag = flags.get(name);
    if (!flag) return false;

    // Check expiration
    if (flag.expiresAt && new Date() > flag.expiresAt) {
      return false;
    }

    // Respect explicit enabled/disabled
    if (!flag.enabled) return false;

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      // Use user ID for consistent rollout
      const userId = (typeof window !== 'undefined' && (window as any).__userId) || 'anonymous';
      const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return (hash % 100) < flag.rolloutPercentage;
    }

    return true;
  };

  const getFeatureVariant = (name: string): string | undefined => {
    return flags.get(name)?.variant;
  };

  const value: FeatureFlagsContextType = {
    flags,
    isFeatureEnabled,
    getFeatureVariant,
    reloadFlags,
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to use feature flags
 * 
 * Usage:
 * const { isFeatureEnabled } = useFeatureFlags();
 * 
 * if (isFeatureEnabled('new-dashboard')) {
 *   return <NewDashboard />;
 * }
 */
export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }
  return context;
}

/**
 * Component to conditionally render based on feature flag
 * 
 * Usage:
 * <FeatureGate name="new-dashboard" fallback={<OldDashboard />}>
 *   <NewDashboard />
 * </FeatureGate>
 */
export function FeatureGate({
  name,
  children,
  fallback = null,
  variant,
}: {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  variant?: string;
}) {
  const { isFeatureEnabled, getFeatureVariant } = useFeatureFlags();

  if (!isFeatureEnabled(name)) {
    return <>{fallback}</>;
  }

  if (variant && getFeatureVariant(name) !== variant) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Prebuilt feature flags for common use cases
 */
export const FEATURE_FLAGS = {
  // UI Features
  DARK_MODE: 'dark-mode',
  NEW_DASHBOARD: 'new-dashboard',
  AI_COPILOT_V2: 'ai-copilot-v2',
  REAL_TIME_TRACKING: 'real-time-tracking',

  // Performance
  LAZY_LOAD_IMAGES: 'lazy-load-images',
  CODE_SPLITTING: 'code-splitting',
  SERVICE_WORKER: 'service-worker-enabled',

  // Beta Features
  EXPERIMENTAL_TIMELINE: 'experimental-timeline',
  BETA_COMPARISON_V2: 'beta-comparison-v2',

  // Accessibility
  HIGH_CONTRAST_MODE: 'high-contrast-mode',

  // Analytics
  ANALYTICS_V2: 'analytics-v2',
} as const;

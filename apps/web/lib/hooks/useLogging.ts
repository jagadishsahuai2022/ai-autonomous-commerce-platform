/**
 * Logging Hooks
 * Client-side observability and analytics
 * Tracks user interactions, errors, performance metrics
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

export interface LogEvent {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

/**
 * Queue for batching log events (reduce API calls)
 */
class LogQueue {
  private queue: LogEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds

  add(event: LogEvent) {
    this.queue.push(event);
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush() {
    if (this.queue.length === 0) return;

    const eventsToSend = [...this.queue];
    this.queue = [];

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
      });
    } catch (error) {
      // Log locally on failure
      console.error('[LogQueue] Send failed:', error);
      // Re-add events to queue for retry
      this.queue = eventsToSend;
    }
  }

  clear() {
    this.queue = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

const logQueue = new LogQueue();

/**
 * Logger utility
 */
export class Logger {
  private userId?: string;
  private sessionId: string;

  constructor(userId?: string) {
    this.userId = userId;
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEvent(
    level: LogEvent['level'],
    message: string,
    context?: Record<string, any>
  ): LogEvent {
    return {
      timestamp: Date.now(),
      level,
      message,
      context,
      userId: this.userId,
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
  }

  debug(message: string, context?: Record<string, any>) {
    const event = this.createEvent('debug', message, context);
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${event.timestamp}] ${message}`, context);
    }
    logQueue.add(event);
  }

  info(message: string, context?: Record<string, any>) {
    const event = this.createEvent('info', message, context);
    console.info(message, context);
    logQueue.add(event);
  }

  warn(message: string, context?: Record<string, any>) {
    const event = this.createEvent('warn', message, context);
    console.warn(message, context);
    logQueue.add(event);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, any>) {
    const errorContext = {
      ...(error instanceof Error && {
        errorMessage: error.message,
        errorStack: error.stack,
      }),
      ...context,
    };

    const event = this.createEvent('error', message, errorContext);
    console.error(message, error, context);
    logQueue.add(event);
  }

  async flush() {
    await logQueue.flush();
  }
}

// Global logger instance
let logger: Logger;

/**
 * Hook: Initialize logger for a component
 *
 * Usage:
 * useLogger('FeatureName');
 * logger.info('User clicked button', { buttonId: 'submit' });
 */
export function useLogger(feature?: string) {
  const { data: session } = useSession();

  const getLogger = useCallback(() => {
    if (!logger) {
      logger = new Logger((session?.user as any)?.id);
    }
    return logger;
  }, [session]);

  useEffect(() => {
    // Ensure logger exists
    getLogger();
  }, [getLogger]);

  return {
    log: (message: string, context?: Record<string, any>) => {
      const log = getLogger();
      log.info(message, {
        feature,
        ...context,
      });
    },
    error: (message: string, error?: Error | unknown, context?: Record<string, any>) => {
      const log = getLogger();
      log.error(message, error, {
        feature,
        ...context,
      });
    },
  };
}

/**
 * Hook: Track component performance
 *
 * Usage:
 * usePerformanceTracking('ProductList');
 */
export function usePerformanceTracking(componentName: string) {
  const mountTimeRef = useRef(Date.now());
  const { log } = useLogger(componentName);

  useEffect(() => {
    const mountTime = Date.now() - mountTimeRef.current;
    log(`Component mounted in ${mountTime}ms`, {
      mountTime,
    });

    return () => {
      log(`Component unmounted`, {
        totalTime: Date.now() - mountTimeRef.current,
      });
    };
  }, [componentName, log]);

  const measureOperation = useCallback(
    (operationName: string, fn: () => any) => {
      const start = performance.now();
      const result = fn();
      const duration = performance.now() - start;

      log(`Operation: ${operationName}`, {
        operation: operationName,
        duration: duration.toFixed(2),
      });

      return result;
    },
    [log]
  );

  return { measureOperation, log };
}

/**
 * Hook: Track user interactions (clicks, scrolls, forms)
 *
 * Usage:
 * useInteractionTracking('ProductCard');
 */
export function useInteractionTracking(componentName: string) {
  const { log } = useLogger(componentName);

  const trackClick = useCallback(
    (elementId: string, label?: string) => {
      log('User clicked', {
        elementId,
        label,
        interaction: 'click',
      });
    },
    [log]
  );

  const trackScroll = useCallback(
    (scrollPercentage: number) => {
      log('User scrolled', {
        scrollPercentage,
        interaction: 'scroll',
      });
    },
    [log]
  );

  const trackFormSubmit = useCallback(
    (formId: string, data?: Record<string, any>) => {
      log('Form submitted', {
        formId,
        interaction: 'form_submit',
        fieldCount: data ? Object.keys(data).length : 0,
      });
    },
    [log]
  );

  const trackApiCall = useCallback(
    (endpoint: string, method: string, statusCode: number, duration: number) => {
      log('API call', {
        endpoint,
        method,
        statusCode,
        duration: duration.toFixed(2),
        interaction: 'api_call',
      });
    },
    [log]
  );

  return {
    trackClick,
    trackScroll,
    trackFormSubmit,
    trackApiCall,
  };
}

/**
 * Hook: Track errors
 *
 * Usage:
 * useErrorTracking('OrderForm');
 */
export function useErrorTracking(componentName: string) {
  const { error: logError } = useLogger(componentName);

  const trackError = useCallback(
    (error: Error | unknown, context?: Record<string, any>) => {
      logError(`Error in ${componentName}`, error, {
        component: componentName,
        ...context,
      });
    },
    [componentName, logError]
  );

  return { trackError };
}

/**
 * Utility: Flush all pending logs on page unload
 */
export function registerLogFlushOnPageUnload() {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      logQueue.flush();
    });
  }
}

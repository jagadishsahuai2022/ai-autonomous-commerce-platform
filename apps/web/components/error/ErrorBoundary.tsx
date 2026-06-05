/**
 * Error Boundary & Retry UI Component
 * Catches React errors, displays user-friendly fallback, enables retry
 * Integrates with logging for observability
 */

'use client';

import React, { ReactNode, ReactElement } from 'react';
import { useErrorTracking } from '@/lib/hooks/useLogging';
import { useToast } from '@/lib/contexts/ToastContext';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactElement;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'section' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * Error Boundary Class Component
 * Catches React rendering errors and displays retry UI
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track error to observability layer
    console.error('[ErrorBoundary]', {
      error,
      componentStack: errorInfo.componentStack,
      level: this.props.level || 'component',
    });

    // Call custom handler if provided
    this.props.onError?.(error, errorInfo);

    // Increment error count
    this.setState((prev) => ({
      errorCount: prev.errorCount + 1,
    }));
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorCount={this.state.errorCount}
          onReset={this.handleReset}
          fallback={this.props.fallback}
          level={this.props.level || 'component'}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Error Fallback UI Component
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorCount: number;
  onReset: () => void;
  fallback?: ReactElement;
  level: 'page' | 'section' | 'component';
}

function ErrorFallback({
  error,
  errorCount,
  onReset,
  fallback,
  level,
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development';

  if (fallback) {
    return fallback;
  }

  const containerClass = {
    page: 'min-h-screen',
    section: 'min-h-96',
    component: 'min-h-32',
  };

  const bgClass = {
    page: 'bg-gradient-to-br from-red-50 to-orange-50',
    section: 'bg-red-50',
    component: 'bg-red-50',
  };

  return (
    <div
      className={`${containerClass[level]} ${bgClass[level]} flex flex-col items-center justify-center p-6 rounded-lg`}
      role="alert"
    >
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mb-4 text-4xl">⚠️</div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {level === 'page'
            ? 'Something went wrong'
            : 'Unable to load content'}
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-4">
          {level === 'page'
            ? 'We encountered an unexpected error. Please try again.'
            : 'This section encountered an error. Try refreshing or going back.'}
        </p>

        {/* Error Details (Dev only) */}
        {isDev && error && (
          <div className="mb-4 bg-red-100 border border-red-300 rounded p-3 text-left">
            <p className="text-xs font-mono text-red-800 break-words">
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        )}

        {/* Retry Count */}
        {errorCount > 1 && (
          <p className="text-xs text-gray-500 mb-4">
            Retry attempt {errorCount}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <button
            onClick={onReset}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
          >
            Try Again
          </button>
          {level !== 'page' && (
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
            >
              Refresh Page
            </button>
          )}
        </div>

        {/* Support Link */}
        {level === 'page' && (
          <p className="text-xs text-gray-500 mt-4">
            If this persists,{' '}
            <a
              href="/support"
              className="text-red-600 hover:underline font-semibold"
            >
              contact support
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Higher-Order Component: withErrorBoundary
 * 
 * Usage:
 * export default withErrorBoundary(MyComponent, { level: 'component' });
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    level?: 'page' | 'section' | 'component';
    fallback?: ReactElement;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}

/**
 * Hook: useAsyncError
 * Throw errors from async code to be caught by ErrorBoundary
 * 
 * Usage:
 * const throwError = useAsyncError();
 * 
 * useEffect(async () => {
 *   try {
 *     await fetchData();
 *   } catch (error) {
 *     throwError(error);
 *   }
 * }, []);
 */
export function useAsyncError() {
  const [, setError] = React.useState();

  return React.useCallback(
    (error: Error) => {
      setError(() => {
        throw error;
      });
    },
    [setError]
  );
}

/**
 * Wrapper Component: AsyncErrorHandler
 * For catching errors from async operations inside ErrorBoundary
 * 
 * Usage:
 * <ErrorBoundary>
 *   <AsyncErrorHandler>
 *     <YourAsyncComponent />
 *   </AsyncErrorHandler>
 * </ErrorBoundary>
 */
export function AsyncErrorHandler({
  children,
}: {
  children: React.ReactNode;
}) {
  const throwError = useAsyncError();
  const { trackError } = useErrorTracking('AsyncErrorHandler');

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackError(event.error);
      throwError(event.error);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      trackError(error);
      throwError(error);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [throwError, trackError]);

  return children;
}

/**
 * Hook: useErrorHandler with async error catching
 * Can be used inside ErrorBoundary to handle async errors
 * 
 * Usage:
 * const handleError = useErrorBoundaryHandler();
 * 
 * const handleClick = async () => {
 *   try {
 *     await fetchData();
 *   } catch (error) {
 *     handleError(error);
 *   }
 * };
 */
export function useErrorBoundaryHandler() {
  const throwError = useAsyncError();
  const { error: showError } = useToast();

  return useCallback(
    (error: Error | unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Error Handler]', err);

      showError(err.message || 'An error occurred');
      throwError(err);
    },
    [throwError, showError]
  );
}

import { useCallback } from 'react';

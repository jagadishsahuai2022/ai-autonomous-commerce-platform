/**
 * Error state component for displaying API errors with retry capability
 */

import { AlertCircle, RotateCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export const ErrorState = ({
  title = '❌ Something went wrong',
  message = 'We encountered an error while loading this content. Please try again.',
  onRetry,
  showRetry = true,
}: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 bg-red-50 border border-red-200 rounded-lg">
      <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-gray-600 text-sm text-center mb-4 max-w-md">{message}</p>
      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RotateCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
};

export const EmptyState = ({
  title = '📭 No items found',
  message = 'We couldn\'t find any items matching your criteria.',
  actionLabel,
  onAction,
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-gray-600 text-sm text-center mb-4 max-w-md">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const NotFoundState = () => (
  <EmptyState
    title="🔍 404 - Not Found"
    message="The page or resource you're looking for doesn't exist."
  />
);

export const TimeoutState = ({ onRetry }: { onRetry: () => void }) => (
  <ErrorState
    title="⏱️ Request Timeout"
    message="The request took too long. Your internet might be slow. Try again?"
    onRetry={onRetry}
    showRetry
  />
);

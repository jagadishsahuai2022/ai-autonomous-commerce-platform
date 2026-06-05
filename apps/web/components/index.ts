/**
 * Components Index
 * Centralized exports for all chat components
 */

export { ChatWindow } from './ChatWindow';
export { ChatMessage } from './ChatMessage';
export { ChatInput } from './ChatInput';
export { ChatToggle } from './ChatToggle';
export { NotificationContainer, NotificationBadge } from './NotificationToast';
export { RealtimeOrderList } from './RealtimeOrderStatus';
export { RealtimeRecommendations } from './RealtimeRecommendations';
export { default as RecommendationCard } from './RecommendationCard';

// ============ PREMIUM UI COMPONENTS ============

// Loaders
export {
  SkeletonLoader,
  ProductCardSkeleton,
  ChatMessageSkeleton,
  TimelineSkeleton,
  ComparisonTableSkeleton,
  OrderSummarySkeleton,
} from './loaders/SkeletonLoaders';

// Buttons
export { PremiumButton, ButtonGroup, IconButton, TextLink, Badge } from './buttons/PremiumButtons';

// Chat Premium
export { ChatMessagePremium, ChatMessagesContainer } from './chat/ChatMessagePremium';

// Modal
export { PremiumModal, ConfirmationModal } from './modal/PremiumModal';

// States
export {
  EmptyState,
  ErrorState,
  ErrorBoundary,
  LoadingState,
  SkeletonBlock,
} from './states/EmptyAndErrorStates';

// Product
export { ProductCard } from './shared/ProductCard';

/**
 * useOrder Hook
 * - React Query integration for order management
 * - Mutations for creating orders
 * - Real-time tracking via WebSocket
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  orderService,
  type Order,
  type OrderFilter,
  type CreateOrderRequest,
  type OrderTimeline,
  type Shipment,
  type OrderReturn,
} from '@/services/order.service';
import { toast } from '@/hooks/useToast';

/**
 * Query keys for orders
 */
export const orderQueryKeys = {
  all: ['orders'] as const,
  lists: () => [...orderQueryKeys.all, 'list'] as const,
  list: (filters: OrderFilter) => [...orderQueryKeys.lists(), { ...filters }] as const,
  details: () => [...orderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderQueryKeys.details(), id] as const,
  timeline: (id: string) => [...orderQueryKeys.details(), id, 'timeline'] as const,
  shipment: (id: string) => [...orderQueryKeys.details(), id, 'shipment'] as const,
  summary: () => [...orderQueryKeys.all, 'summary'] as const,
};

/**
 * useOrders - Get user orders with filtering
 */
export const useOrders = (filters: OrderFilter = {}) => {
  return useQuery({
    queryKey: orderQueryKeys.list(filters),
    queryFn: () => orderService.getOrders(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * useOrder - Get single order by ID
 */
export const useOrder = (orderId: string | null) => {
  return useQuery({
    queryKey: orderId ? orderQueryKeys.detail(orderId) : ['order-no-id'],
    queryFn: () => orderService.getOrder(orderId!),
    enabled: !!orderId,
    staleTime: 1000 * 60 * 2, // 2 minutes (frequently changes)
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * useOrderTimeline - Get order status timeline
 */
export const useOrderTimeline = (orderId: string | null) => {
  return useQuery({
    queryKey: orderId ? orderQueryKeys.timeline(orderId) : ['timeline-no-id'],
    queryFn: () => orderService.getOrderTimeline(orderId!),
    enabled: !!orderId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * useShipment - Get shipment details
 */
export const useShipment = (orderId: string | null) => {
  return useQuery({
    queryKey: orderId ? orderQueryKeys.shipment(orderId) : ['shipment-no-id'],
    queryFn: () => orderService.getShipment(orderId!),
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * useOrderSummary - Get order summary/dashboard
 */
export const useOrderSummary = () => {
  return useQuery({
    queryKey: orderQueryKeys.summary(),
    queryFn: () => orderService.getOrderSummary(),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

/**
 * useCreateOrder - Create new order mutation
 */
export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderRequest) => orderService.createOrder(data),
    onSuccess: (newOrder) => {
      // Invalidate orders list
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });

      // Cache the new order
      queryClient.setQueryData(orderQueryKeys.detail(newOrder.id), newOrder);

      toast('Order created successfully!', 'success');
    },
    onError: () => {
      toast('Failed to create order. Please try again.', 'error');
    },
  });
};

/**
 * useCancelOrder - Cancel order mutation
 */
export const useCancelOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      orderService.cancelOrder(orderId, reason),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(orderQueryKeys.detail(updatedOrder.id), updatedOrder);
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
      toast('Order cancelled successfully', 'success');
    },
    onError: () => {
      toast('Failed to cancel order', 'error');
    },
  });
};

/**
 * useRequestReturn - Request product return
 */
export const useRequestReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: { reason: string; description?: string };
    }) => orderService.requestReturn(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
      toast('Return requested. We will review your request shortly.', 'success');
    },
    onError: () => {
      toast('Failed to request return', 'error');
    },
  });
};

/**
 * useGetReturn - Get return details for an order
 */
export const useGetReturn = (orderId: string | null) => {
  return useQuery({
    queryKey: orderId ? [...orderQueryKeys.detail(orderId), 'return'] : ['return-no-id'],
    queryFn: () => orderService.getReturn(orderId!),
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * useValidateOrder - Validate order before creation
 */
export const useValidateOrder = (data: CreateOrderRequest | null, enabled: boolean = false) => {
  return useQuery({
    queryKey: ['validate-order', data],
    queryFn: () => orderService.validateOrder(data!),
    enabled: enabled && !!data,
    staleTime: 0, // Always fresh
  });
};

/**
 * useInvalidateOrders - Helper to manually invalidate order queries
 */
export const useInvalidateOrders = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.summary() });
  };
};

/**
 * useInvalidateOrder - Helper to invalidate specific order
 */
export const useInvalidateOrder = () => {
  const queryClient = useQueryClient();

  return (orderId: string) => {
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.timeline(orderId) });
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.shipment(orderId) });
  };
};

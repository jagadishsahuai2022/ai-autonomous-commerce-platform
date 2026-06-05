/**
 * useCart Hook
 * - React Query integration for cart management
 * - Mutations for adding/removing items
 * - Optimistic updates with error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApiErrorHandler } from '@/lib/error-handling';
import {
  cartService,
  type Cart,
  type CartItem,
  type AddToCartRequest,
  type UpdateCartItemRequest,
} from '@/services/cart.service';

/**
 * Query keys for cart
 */
export const cartQueryKeys = {
  all: ['cart'] as const,
  lists: () => [...cartQueryKeys.all, 'list'] as const,
  list: () => [...cartQueryKeys.lists()] as const,
  count: () => [...cartQueryKeys.all, 'count'] as const,
  estimates: () => [...cartQueryKeys.all, 'estimates'] as const,
};

/**
 * useCart - Get current cart
 */
export const useCart = () => {
  return useQuery({
    queryKey: cartQueryKeys.list(),
    queryFn: () => cartService.getCart(),
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * useCartCount - Get cart item count (lightweight)
 */
export const useCartCount = () => {
  return useQuery({
    queryKey: cartQueryKeys.count(),
    queryFn: () => cartService.getCartCount(),
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60, // 1 minute
  });
};

/**
 * useAddToCart - Add item to cart mutation with optimistic updates
 */
export const useAddToCart = () => {
  const queryClient = useQueryClient();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: (data: AddToCartRequest) => cartService.addToCart(data),
    onMutate: async (newItem) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: cartQueryKeys.list() });

      // Get previous cart
      const previousCart = queryClient.getQueryData<Cart>(cartQueryKeys.list());

      // Optimistically update cart
      if (previousCart) {
        const updatedCart: Cart = {
          ...previousCart,
          items: [
            ...previousCart.items,
            {
              id: `temp-${Date.now()}`,
              productId: newItem.productId,
              quantity: newItem.quantity,
              price: 0, // Will be updated on success
              totalPrice: 0,
              selectedOptions: newItem.selectedOptions,
              addedAt: new Date().toISOString(),
            },
          ],
        };

        queryClient.setQueryData(cartQueryKeys.list(), updatedCart);
      }

      return { previousCart };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousCart) {
        queryClient.setQueryData(cartQueryKeys.list(), context.previousCart);
      }
      const message = handleError(error);
      toast.error(message);
    },
    onSuccess: () => {
      // Revalidate cart data
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.count() });
      toast.success('Item added to cart');
    },
  });
};

/**
 * useUpdateCartItem - Update cart item quantity
 */
export const useUpdateCartItem = () => {
  const queryClient = useQueryClient();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateCartItemRequest }) =>
      cartService.updateCartItem(itemId, data),
    onMutate: async ({ itemId, data }) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKeys.list() });

      const previousCart = queryClient.getQueryData<Cart>(cartQueryKeys.list());

      if (previousCart) {
        const updatedCart: Cart = {
          ...previousCart,
          items: previousCart.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  quantity: data.quantity,
                  totalPrice: item.price * data.quantity,
                }
              : item
          ),
        };

        queryClient.setQueryData(cartQueryKeys.list(), updatedCart);
      }

      return { previousCart };
    },
    onError: (error, _, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(cartQueryKeys.list(), context.previousCart);
      }
      const message = handleError(error);
      toast.error(message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.list() });
      toast.success('Quantity updated');
    },
  });
};

/**
 * useRemoveFromCart - Remove item from cart
 */
export const useRemoveFromCart = () => {
  const queryClient = useQueryClient();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: (itemId: string) => cartService.removeFromCart(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKeys.list() });

      const previousCart = queryClient.getQueryData<Cart>(cartQueryKeys.list());

      if (previousCart) {
        const updatedCart: Cart = {
          ...previousCart,
          items: previousCart.items.filter((item) => item.id !== itemId),
        };

        queryClient.setQueryData(cartQueryKeys.list(), updatedCart);
      }

      return { previousCart };
    },
    onError: (error, _, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(cartQueryKeys.list(), context.previousCart);
      }
      const message = handleError(error);
      toast.error(message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.count() });
      toast.success('Item removed from cart');
    },
  });
};

/**
 * useClearCart - Clear entire cart
 */
export const useClearCart = () => {
  const queryClient = useQueryClient();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: () => cartService.clearCart(),
    onError: (error) => {
      const message = handleError(error);
      toast.error(message);
    },
    onSuccess: () => {
      queryClient.setQueryData(cartQueryKeys.list(), { items: [] });
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.count() });
      toast.success('Cart cleared');
    },
  });
};

/**
 * useApplyCoupon - Apply coupon code
 */
export const useApplyCoupon = () => {
  const queryClient = useQueryClient();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: (couponCode: string) => cartService.applyCoupon(couponCode),
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(cartQueryKeys.list(), updatedCart);
      toast.success('Coupon applied');
    },
    onError: (error) => {
      const message = handleError(error);
      toast.error(message);
    },
  });
};

/**
 * useRemoveCoupon - Remove/clear coupon
 */
export const useRemoveCoupon = () => {
  const queryClient = useQueryClient();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: () => cartService.removeCoupon(),
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(cartQueryKeys.list(), updatedCart);
      toast.success('Coupon removed');
    },
    onError: (error) => {
      const message = handleError(error);
      toast.error(message);
    },
  });
};

/**
 * useGetShippingEstimates - Get shipping cost estimates
 */
export const useGetShippingEstimates = (addressId?: string) => {
  return useQuery({
    queryKey: [...cartQueryKeys.estimates(), { addressId }],
    queryFn: () => cartService.getShippingEstimates(addressId),
    enabled: !!addressId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * useValidateCart - Validate cart before checkout
 */
export const useValidateCart = (enabled: boolean = false) => {
  return useQuery({
    queryKey: [...cartQueryKeys.list(), 'validate'],
    queryFn: () => cartService.validateCart(),
    enabled,
    staleTime: 0, // Always fresh
  });
};

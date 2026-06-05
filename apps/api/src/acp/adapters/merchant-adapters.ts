/**
 * Merchant Adapters
 * Part 5: Support for multiple merchant integrations
 * Amazon, Flipkart, and Internal Seller adapters
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  MerchantAdapter,
  MerchantAdapterResponse,
  ProductOption,
  SellerInfo,
  CheckoutIntent,
  OrderConfirmation,
  AgentContext,
} from '../schemas/acp.types';
import { RetryUtilityService } from '../../common/services/retry-utility.service';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

// ============================================
// AMAZON ADAPTER
// ============================================

@Injectable()
export class AmazonMerchantAdapter implements MerchantAdapter {
  readonly name = 'amazon';
  readonly supportedOperations: ('search' | 'quote' | 'checkout')[] = [
    'search',
    'quote',
    'checkout',
  ];

  private readonly logger = new Logger('AmazonAdapter');

  constructor(
    private retry: RetryUtilityService,
    private breaker: CircuitBreakerService
  ) {}

  async search(query: string, context: AgentContext): Promise<ProductOption[]> {
    const result = await this.retry.executeWithRetry(
      async () => this.breaker.execute('amazon_search', async () => this.mockAmazonSearch(query)),
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        timeoutMs: 10000,
      },
      'AmazonSearch'
    );

    if (!result.success) {
      throw result.error || new Error('Amazon search failed');
    }
    return result.data || [];
  }

  async quote(productId: string, quantity: number): Promise<MerchantAdapterResponse> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('amazon_quote', async () => this.mockAmazonQuote(productId, quantity)),
      {
        maxRetries: 2,
        initialDelayMs: 50,
        maxDelayMs: 3000,
        backoffMultiplier: 2,
        timeoutMs: 5000,
      },
      'AmazonQuote'
    );

    if (!result.success) {
      throw result.error || new Error('Amazon quote failed');
    }
    return result.data!;
  }

  async checkout(order: CheckoutIntent, paymentToken: string): Promise<OrderConfirmation> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('amazon_checkout', async () =>
          this.mockAmazonCheckout(order, paymentToken)
        ),
      {
        maxRetries: 3,
        initialDelayMs: 200,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        timeoutMs: 30000,
      },
      'AmazonCheckout'
    );

    if (!result.success) {
      throw result.error || new Error('Amazon checkout failed');
    }
    return result.data!;
  }

  private mockAmazonSearch(query: string): ProductOption[] {
    return [
      {
        productId: `amz_${Math.random().toString(36).slice(2, 9)}`,
        title: `Amazon - ${query} (Premium Edition)`,
        price: 4999,
        currency: 'INR',
        seller: {
          sellerId: 'amazon-seller',
          name: 'Amazon.in',
          trustScore: 95,
          responseTime: 2,
          returnPolicy: 'Free returns within 30 days',
        },
        availability: 'in_stock',
        deliveryEstimate: { minDays: 1, maxDays: 2, type: 'prime' },
        ratings: { score: 4.7, count: 5000, trustScore: 95 },
        relevanceScore: 92,
      },
    ];
  }

  private mockAmazonQuote(productId: string, quantity: number): MerchantAdapterResponse {
    return {
      productId,
      available: true,
      price: 4999 * quantity,
      deliveryDays: 2,
      seller: {
        sellerId: 'amazon-seller',
        name: 'Amazon.in',
        trustScore: 95,
      },
      responseMeta: {
        source: 'amazon',
        latencyMs: Math.random() * 500,
        timestamp: new Date(),
      },
    };
  }

  private mockAmazonCheckout(order: CheckoutIntent, paymentToken: string): OrderConfirmation {
    return {
      orderId: `AMAZON_${Date.now()}`,
      status: 'confirmed',
      items: order.products.map((p) => ({
        productId: p.productId,
        quantity: p.quantity,
        price: 4999,
        seller: {
          sellerId: 'amazon-seller',
          name: 'Amazon.in',
          trustScore: 95,
        },
      })),
      totalAmount: order.products.reduce((sum) => sum + 4999, 0),
      currency: 'INR',
      estimatedDelivery: {
        minDate: new Date(Date.now() + 86400000),
        maxDate: new Date(Date.now() + 172800000),
      },
      paymentStatus: 'completed',
      trackingId: `AMZ_TRACK_${Math.random().toString(36).slice(2, 9)}`,
      nextSteps: ['Order placed successfully', 'You will receive tracking details soon'],
      confirmationUrl: 'https://amazon.in/orders',
    };
  }
}

// ============================================
// FLIPKART ADAPTER
// ============================================

@Injectable()
export class FlipkartMerchantAdapter implements MerchantAdapter {
  readonly name = 'flipkart';
  readonly supportedOperations: ('search' | 'quote' | 'checkout')[] = [
    'search',
    'quote',
    'checkout',
  ];

  private readonly logger = new Logger('FlipkartAdapter');

  constructor(
    private retry: RetryUtilityService,
    private breaker: CircuitBreakerService
  ) {}

  async search(query: string, context: AgentContext): Promise<ProductOption[]> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('flipkart_search', async () => this.mockFlipkartSearch(query)),
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        timeoutMs: 10000,
      },
      'FlipkartSearch'
    );

    if (!result.success) {
      throw result.error || new Error('Flipkart search failed');
    }
    return result.data || [];
  }

  async quote(productId: string, quantity: number): Promise<MerchantAdapterResponse> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('flipkart_quote', async () =>
          this.mockFlipkartQuote(productId, quantity)
        ),
      {
        maxRetries: 2,
        initialDelayMs: 50,
        maxDelayMs: 3000,
        backoffMultiplier: 2,
        timeoutMs: 5000,
      },
      'FlipkartQuote'
    );

    if (!result.success) {
      throw result.error || new Error('Flipkart quote failed');
    }
    return result.data!;
  }

  async checkout(order: CheckoutIntent, paymentToken: string): Promise<OrderConfirmation> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('flipkart_checkout', async () =>
          this.mockFlipkartCheckout(order, paymentToken)
        ),
      {
        maxRetries: 3,
        initialDelayMs: 200,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        timeoutMs: 30000,
      },
      'FlipkartCheckout'
    );

    if (!result.success) {
      throw result.error || new Error('Flipkart checkout failed');
    }
    return result.data!;
  }

  private mockFlipkartSearch(query: string): ProductOption[] {
    return [
      {
        productId: `fk_${Math.random().toString(36).slice(2, 9)}`,
        title: `Flipkart - ${query} (Super Saver)`,
        price: 3999,
        currency: 'INR',
        seller: {
          sellerId: 'flipkart-seller',
          name: 'Flipkart',
          trustScore: 92,
          responseTime: 4,
          returnPolicy: '10-day returns',
        },
        availability: 'in_stock',
        deliveryEstimate: { minDays: 2, maxDays: 4, type: 'standard' },
        ratings: { score: 4.5, count: 3000, trustScore: 92 },
        relevanceScore: 88,
      },
    ];
  }

  private mockFlipkartQuote(productId: string, quantity: number): MerchantAdapterResponse {
    return {
      productId,
      available: true,
      price: 3999 * quantity,
      deliveryDays: 3,
      seller: {
        sellerId: 'flipkart-seller',
        name: 'Flipkart',
        trustScore: 92,
      },
      responseMeta: {
        source: 'flipkart',
        latencyMs: Math.random() * 600,
        timestamp: new Date(),
      },
    };
  }

  private mockFlipkartCheckout(order: CheckoutIntent, paymentToken: string): OrderConfirmation {
    return {
      orderId: `FLIPKART_${Date.now()}`,
      status: 'confirmed',
      items: order.products.map((p) => ({
        productId: p.productId,
        quantity: p.quantity,
        price: 3999,
        seller: {
          sellerId: 'flipkart-seller',
          name: 'Flipkart',
          trustScore: 92,
        },
      })),
      totalAmount: order.products.reduce((sum) => sum + 3999, 0),
      currency: 'INR',
      estimatedDelivery: {
        minDate: new Date(Date.now() + 172800000),
        maxDate: new Date(Date.now() + 345600000),
      },
      paymentStatus: 'completed',
      trackingId: `FK_TRACK_${Math.random().toString(36).slice(2, 9)}`,
      nextSteps: ['Order confirmed', 'Seller preparing for shipment'],
      confirmationUrl: 'https://flipkart.com/orders',
    };
  }
}

// ============================================
// INTERNAL SELLER ADAPTER
// ============================================

@Injectable()
export class InternalSellerAdapter implements MerchantAdapter {
  readonly name = 'internal';
  readonly supportedOperations: ('search' | 'quote' | 'checkout')[] = [
    'search',
    'quote',
    'checkout',
  ];

  private readonly logger = new Logger('InternalSellerAdapter');

  constructor(
    private retry: RetryUtilityService,
    private breaker: CircuitBreakerService
  ) {}

  async search(query: string, context: AgentContext): Promise<ProductOption[]> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('internal_search', async () => this.mockInternalSearch(query)),
      {
        maxRetries: 2,
        initialDelayMs: 50,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        timeoutMs: 5000,
      },
      'InternalSearch'
    );

    if (!result.success) {
      throw result.error || new Error('Internal search failed');
    }
    return result.data || [];
  }

  async quote(productId: string, quantity: number): Promise<MerchantAdapterResponse> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('internal_quote', async () =>
          this.mockInternalQuote(productId, quantity)
        ),
      {
        maxRetries: 1,
        initialDelayMs: 25,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        timeoutMs: 3000,
      },
      'InternalQuote'
    );

    if (!result.success) {
      throw result.error || new Error('Internal quote failed');
    }
    return result.data!;
  }

  async checkout(order: CheckoutIntent, paymentToken: string): Promise<OrderConfirmation> {
    const result = await this.retry.executeWithRetry(
      async () =>
        this.breaker.execute('internal_checkout', async () =>
          this.mockInternalCheckout(order, paymentToken)
        ),
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        timeoutMs: 15000,
      },
      'InternalCheckout'
    );

    if (!result.success) {
      throw result.error || new Error('Internal checkout failed');
    }
    return result.data!;
  }

  private mockInternalSearch(query: string): ProductOption[] {
    return [
      {
        productId: `int_${Math.random().toString(36).slice(2, 9)}`,
        title: `DelegateCart - ${query} (Exclusive)`,
        price: 3499,
        currency: 'INR',
        seller: {
          sellerId: 'delegatecart',
          name: 'DelegateCart',
          trustScore: 98,
          responseTime: 1,
          returnPolicy: '15-day free returns',
        },
        availability: 'in_stock',
        deliveryEstimate: { minDays: 1, maxDays: 1, type: 'express' },
        ratings: { score: 4.9, count: 8000, trustScore: 98 },
        relevanceScore: 95,
      },
    ];
  }

  private mockInternalQuote(productId: string, quantity: number): MerchantAdapterResponse {
    return {
      productId,
      available: true,
      price: 3499 * quantity,
      deliveryDays: 1,
      seller: {
        sellerId: 'delegatecart',
        name: 'DelegateCart',
        trustScore: 98,
      },
      responseMeta: {
        source: 'internal',
        latencyMs: Math.random() * 100,
        timestamp: new Date(),
      },
    };
  }

  private mockInternalCheckout(order: CheckoutIntent, paymentToken: string): OrderConfirmation {
    return {
      orderId: `DC_${Date.now()}`,
      status: 'confirmed',
      items: order.products.map((p) => ({
        productId: p.productId,
        quantity: p.quantity,
        price: 3499,
        seller: {
          sellerId: 'delegatecart',
          name: 'DelegateCart',
          trustScore: 98,
        },
      })),
      totalAmount: order.products.reduce((sum) => sum + 3499, 0),
      currency: 'INR',
      estimatedDelivery: {
        minDate: new Date(Date.now() + 86400000),
        maxDate: new Date(Date.now() + 86400000),
      },
      paymentStatus: 'completed',
      trackingId: `DC_TRACK_${Math.random().toString(36).slice(2, 9)}`,
      nextSteps: ['Order placed', 'Processing for same-day delivery'],
      confirmationUrl: 'https://delegatecart.com/orders',
    };
  }
}

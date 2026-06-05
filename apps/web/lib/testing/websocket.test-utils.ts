/**
 * WebSocket Testing Utilities
 * For developers to test WebSocket functionality during development
 *
 * Usage:
 * import { createTestClient, simulateEvents } from '@/lib/testing/websocket.test-utils';
 *
 * const client = createTestClient();
 * await client.connect(1, 'test-token');
 */

import io, { Socket } from 'socket.io-client';

interface TestEvent {
  type: string;
  data: any;
  delay?: number; // Delay before emitting (ms)
}

interface TestScenario {
  name: string;
  events: TestEvent[];
  duration?: number; // Total scenario duration
}

/**
 * Create a test client with logging
 */
export function createTestClient(
  url: string = 'http://localhost:3002',
  userId: number = 1,
  token: string = 'test-token'
): Socket {
  console.log(`🧪 Creating test client for user ${userId}`);

  const socket = io(url, {
    auth: {
      userId,
      token,
    },
    transports: ['websocket'],
    reconnection: true,
  });

  // Log all events
  socket.on('connect', () => {
    console.log('✅ Test client connected', {
      socketId: socket.id,
      userId,
    });
  });

  socket.on('disconnect', () => {
    console.log('⚠️ Test client disconnected');
  });

  socket.on('error', (error) => {
    console.error('❌ Test client error:', error);
  });

  return socket;
}

/**
 * Simulate real-time events for testing
 */
export async function simulateEvents(socket: Socket, scenario: TestScenario): Promise<void> {
  console.log(`🎬 Running scenario: ${scenario.name}`);

  const startTime = Date.now();

  for (const event of scenario.events) {
    // Wait for delay
    if (event.delay) {
      await new Promise((resolve) => setTimeout(resolve, event.delay));
    }

    console.log(`📤 Emitting: ${event.type}`, event.data);

    // Emit event
    socket.emit(event.type, event.data, (response) => {
      console.log(`📥 Response for ${event.type}:`, response);
    });

    // Check duration limit
    if (scenario.duration && Date.now() - startTime > scenario.duration) {
      console.log(`⏱️ Scenario duration exceeded (${scenario.duration}ms)`);
      break;
    }
  }

  console.log(`✅ Scenario completed: ${scenario.name}`);
}

/**
 * Predefined test scenarios
 */
export const TEST_SCENARIOS = {
  /**
   * Test basic connection and message received
   */
  basicConnection: (): TestScenario => ({
    name: 'Basic Connection',
    events: [
      {
        type: 'ping',
        data: {},
        delay: 1000,
      },
    ],
  }),

  /**
   * Test recommendation updates
   */
  recommendations: (): TestScenario => ({
    name: 'Real-time Recommendations',
    events: [
      {
        type: 'recommendation:updated',
        data: {
          payload: {
            recommendations: [
              {
                id: 'test-1',
                productId: 1,
                productName: 'Test Laptop',
                price: 999.99,
                image: 'https://via.placeholder.com/300',
                score: 0.95,
              },
              {
                id: 'test-2',
                productId: 2,
                productName: 'Test Mouse',
                price: 29.99,
                image: 'https://via.placeholder.com/300',
                score: 0.87,
              },
            ],
          },
        },
        delay: 500,
      },
    ],
  }),

  /**
   * Test cart updates
   */
  cartUpdates: (): TestScenario => ({
    name: 'Cart Updates',
    events: [
      {
        type: 'cart:updated',
        data: {
          payload: {
            items: [
              {
                productId: 1,
                productName: 'Laptop',
                quantity: 1,
                price: 999.99,
                image: 'https://via.placeholder.com/300',
              },
            ],
          },
        },
        delay: 500,
      },
      {
        type: 'cart:updated',
        data: {
          payload: {
            items: [
              {
                productId: 1,
                productName: 'Laptop',
                quantity: 2,
                price: 999.99,
                image: 'https://via.placeholder.com/300',
              },
              {
                productId: 2,
                productName: 'Mouse',
                quantity: 1,
                price: 29.99,
                image: 'https://via.placeholder.com/300',
              },
            ],
          },
        },
        delay: 2000,
      },
    ],
  }),

  /**
   * Test order status transitions
   */
  orderStatus: (): TestScenario => ({
    name: 'Order Status Updates',
    events: [
      {
        type: 'order:status_changed',
        data: {
          payload: {
            orderId: 123,
            status: 'confirmed',
            previousStatus: 'pending',
            message: 'Your order has been confirmed!',
            createdAt: new Date().toISOString(),
          },
        },
        delay: 500,
      },
      {
        type: 'order:status_changed',
        data: {
          payload: {
            orderId: 123,
            status: 'shipped',
            previousStatus: 'confirmed',
            message: 'Your order is on its way!',
            createdAt: new Date().toISOString(),
          },
        },
        delay: 3000,
      },
      {
        type: 'order:status_changed',
        data: {
          payload: {
            orderId: 123,
            status: 'completed',
            previousStatus: 'shipped',
            message: 'Your order has been delivered!',
            createdAt: new Date().toISOString(),
          },
        },
        delay: 5000,
      },
    ],
    duration: 15000, // Total 15 seconds
  }),

  /**
   * Test notifications
   */
  notifications: (): TestScenario => ({
    name: 'Notifications',
    events: [
      {
        type: 'notification:created',
        data: {
          payload: {
            type: 'success',
            title: 'Recommendation!',
            message: 'We have new recommendations for you!',
            action: { type: 'navigate', target: '/recommendations' },
          },
        },
        delay: 500,
      },
      {
        type: 'notification:created',
        data: {
          payload: {
            type: 'info',
            title: 'Cart Reminder',
            message: 'You have items in your cart!',
            action: { type: 'navigate', target: '/cart' },
          },
        },
        delay: 3000,
      },
      {
        type: 'notification:created',
        data: {
          payload: {
            type: 'success',
            title: 'Order Placed!',
            message: 'Your order #123 has been placed successfully!',
            action: { type: 'navigate', target: '/orders/123' },
          },
        },
        delay: 2000,
      },
    ],
  }),

  /**
   * Stress test: rapid events
   */
  stressTest: (): TestScenario => ({
    name: 'Stress Test - Rapid Events',
    events: Array.from({ length: 50 }, (_, i) => ({
      type: Math.random() > 0.5 ? 'recommendation:updated' : 'cart:updated',
      data: {
        payload: {
          itemId: i,
          timestamp: new Date().toISOString(),
        },
      },
      delay: 100, // 100ms between each
    })),
    duration: 10000,
  }),

  /**
   * Full user journey
   */
  fullJourney: (): TestScenario => ({
    name: 'Full User Journey',
    events: [
      {
        type: 'recommendation:updated',
        data: {
          payload: {
            recommendations: [
              { id: '1', productId: 1, productName: 'Laptop', price: 999.99, score: 0.95 },
            ],
          },
        },
        delay: 500,
      },
      {
        type: 'notification:created',
        data: {
          payload: { type: 'info', title: 'New', message: 'New recommendations available' },
        },
        delay: 500,
      },
      {
        type: 'cart:updated',
        data: {
          payload: { items: [{ productId: 1, quantity: 1, price: 999.99 }] },
        },
        delay: 2000,
      },
      {
        type: 'order:status_changed',
        data: {
          payload: { orderId: 1, status: 'confirmed', message: 'Order confirmed!' },
        },
        delay: 2000,
      },
    ],
  }),
};

/**
 * Test connection with latency measurement
 */
export async function testConnectionLatency(
  url: string = 'http://localhost:3002',
  iterations: number = 10
): Promise<{
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
}> {
  const socket = createTestClient(url);

  const latencies: number[] = [];

  await new Promise((resolve) => {
    socket.on('connect', async () => {
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        socket.emit('ping', {}, () => {
          const latency = Date.now() - start;
          latencies.push(latency);
          console.log(`Ping ${i + 1}/${iterations}: ${latency}ms`);
        });

        await new Promise((r) => setTimeout(r, 100));
      }

      socket.disconnect();
      resolve(null);
    });
  });

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  return {
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    avgLatency: Math.round(avgLatency),
  };
}

/**
 * Test load: multiple concurrent clients
 */
export async function testLoad(
  url: string = 'http://localhost:3002',
  userCount: number = 10
): Promise<void> {
  console.log(`⚡ Load test: ${userCount} concurrent users`);

  const sockets = [];
  const startTime = Date.now();

  // Create connections
  for (let i = 1; i <= userCount; i++) {
    const socket = createTestClient(url, i);
    sockets.push(socket);
  }

  // Wait for all to connect
  await Promise.all(
    sockets.map(
      (socket) =>
        new Promise((resolve) => {
          socket.on('connect', resolve);
        })
    )
  );

  // Emit events simultaneously
  sockets.forEach((socket, index) => {
    socket.emit(
      'recommendation:updated',
      {
        payload: { recommendations: [{ id: index }] },
      },
      (response) => {
        console.log(`User ${index + 1}: Response received'`);
      }
    );
  });

  // Wait a bit and cleanup
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Disconnect all
  sockets.forEach((socket) => socket.disconnect());

  const duration = Date.now() - startTime;
  console.log(`✅ Load test completed in ${duration}ms`);
}

/**
 * Browser console helper
 */
export async function runTestScenario(scenarioName: keyof typeof TEST_SCENARIOS): Promise<void> {
  const socket = createTestClient();

  await new Promise((resolve) => {
    socket.on('connect', async () => {
      const scenario = TEST_SCENARIOS[scenarioName]();
      await simulateEvents(socket, scenario);
      resolve(null);
    });
  });
}

/**
 * Export for global use in browser console
 */
if (typeof window !== 'undefined') {
  (window as any).websocketTest = {
    createTestClient,
    simulateEvents,
    testConnectionLatency,
    testLoad,
    runTestScenario,
    scenarios: TEST_SCENARIOS,
  };

  console.log('🧪 WebSocket testing utilities loaded. Use window.websocketTest');
}

const websocketTestUtils = {
  createTestClient,
  simulateEvents,
  testConnectionLatency,
  testLoad,
  runTestScenario,
  scenarios: TEST_SCENARIOS,
};

export default websocketTestUtils;

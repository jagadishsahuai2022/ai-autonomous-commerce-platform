/**
 * Performance Testing Scripts - K6 Load Testing
 * Tests for critical API endpoints under load
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Gauge, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulLogins = new Counter('successful_logins');
const activeUsers = new Gauge('active_users');

// Test configuration
export const options = {
  vus: 10, // Virtual users
  duration: '30s',
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'error_rate': ['rate<0.1'],
    'http_req_failed': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const HOMEPAGE_URL = __ENV.HOMEPAGE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'TestPassword123!' },
  { email: 'test2@example.com', password: 'TestPassword123!' },
  { email: 'test3@example.com', password: 'TestPassword123!' },
];

const testProducts = [
  'laptop',
  'smartphone',
  'tablet',
  'headphones',
  'monitor',
];

/**
 * Authentication Performance Test
 */
export function testAuthenticationPerformance() {
  group('Authentication Tests', () => {
    const user = testUsers[Math.floor(Math.random() * testUsers.length)];

    // Test login
    const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    check(loginResponse, {
      'Login status is 200': (r) => r.status === 200,
      'Login response time < 500ms': (r) => r.timings.duration < 500,
      'Login has access token': (r) =>
        r.body && JSON.parse(r.body).accessToken,
    });

    errorRate.add(loginResponse.status !== 200);
    responseTime.add(loginResponse.timings.duration);

    if (loginResponse.status === 200) {
      successfulLogins.add(1);
      const token = JSON.parse(loginResponse.body).accessToken;

      // Test get profile
      const profileResponse = http.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      check(profileResponse, {
        'Profile status is 200': (r) => r.status === 200,
        'Profile response time < 300ms': (r) => r.timings.duration < 300,
      });

      responseTime.add(profileResponse.timings.duration);
      errorRate.add(profileResponse.status !== 200);

      // Test logout
      const logoutResponse = http.post(`${BASE_URL}/auth/logout`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });

      check(logoutResponse, {
        'Logout status is 200': (r) => r.status === 200,
      });
    }
  });

  sleep(1);
}

/**
 * Product Search Performance Test
 */
export function testProductSearchPerformance() {
  group('Product Search Tests', () => {
    const query = testProducts[Math.floor(Math.random() * testProducts.length)];

    // Test simple search
    const searchResponse = http.get(
      `${BASE_URL}/api/products?search=${query}&limit=20`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(searchResponse, {
      'Search status is 200': (r) => r.status === 200,
      'Search response time < 1000ms': (r) => r.timings.duration < 1000,
      'Search returns results': (r) => {
        const body = JSON.parse(r.body);
        return body.data && body.data.length > 0;
      },
    });

    responseTime.add(searchResponse.timings.duration);
    errorRate.add(searchResponse.status !== 200);

    // Test advanced search
    const advancedSearchResponse = http.get(
      `${BASE_URL}/api/search?query=${query} under $1000&filters[category]=electronics`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(advancedSearchResponse, {
      'Advanced search status is 200': (r) => r.status === 200,
      'Advanced search response time < 1500ms': (r) => r.timings.duration < 1500,
    });

    responseTime.add(advancedSearchResponse.timings.duration);
  });

  sleep(1);
}

/**
 * Product Catalog Performance Test
 */
export function testProductCatalogPerformance() {
  group('Product Catalog Tests', () => {
    // Test catalog list
    const listResponse = http.get(
      `${BASE_URL}/api/products?page=1&limit=20&sort=popularity&order=desc`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(listResponse, {
      'Catalog list status is 200': (r) => r.status === 200,
      'Catalog list response time < 800ms': (r) => r.timings.duration < 800,
    });

    responseTime.add(listResponse.timings.duration);
    errorRate.add(listResponse.status !== 200);

    if (listResponse.status === 200) {
      // Get first product ID and fetch details
      const body = JSON.parse(listResponse.body);
      if (body.data && body.data.length > 0) {
        const productId = body.data[0].id;

        // Test product details
        const detailResponse = http.get(
          `${BASE_URL}/api/products/${productId}`,
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );

        check(detailResponse, {
          'Product detail status is 200': (r) => r.status === 200,
          'Product detail response time < 500ms': (r) =>
            r.timings.duration < 500,
        });

        responseTime.add(detailResponse.timings.duration);
      }
    }
  });

  sleep(1);
}

/**
 * Shopping Cart Performance Test
 */
export function testShoppingCartPerformance() {
  group('Shopping Cart Tests', () => {
    // First authenticate
    const user = testUsers[0];
    const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginResponse.status === 200) {
      const token = JSON.parse(loginResponse.body).accessToken;

      // Get cart
      const cartResponse = http.get(`${BASE_URL}/api/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      check(cartResponse, {
        'Get cart status is 200': (r) => r.status === 200,
        'Get cart response time < 400ms': (r) => r.timings.duration < 400,
      });

      responseTime.add(cartResponse.timings.duration);

      // Add to cart (simulate)
      const addResponse = http.post(
        `${BASE_URL}/api/cart/items`,
        JSON.stringify({
          productId: 'prod-123',
          quantity: 1,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      check(addResponse, {
        'Add to cart status is 201 or 200': (r) =>
          r.status === 201 || r.status === 200,
        'Add to cart response time < 600ms': (r) => r.timings.duration < 600,
      });

      responseTime.add(addResponse.timings.duration);
      errorRate.add(addResponse.status > 299);
    }
  });

  sleep(1);
}

/**
 * Order Processing Performance Test
 */
export function testOrderProcessingPerformance() {
  group('Order Processing Tests', () => {
    const user = testUsers[0];
    const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginResponse.status === 200) {
      const token = JSON.parse(loginResponse.body).accessToken;

      // Get orders
      const ordersResponse = http.get(`${BASE_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      check(ordersResponse, {
        'Get orders status is 200': (r) => r.status === 200,
        'Get orders response time < 800ms': (r) => r.timings.duration < 800,
      });

      responseTime.add(ordersResponse.timings.duration);

      // Create order (simulate)
      const createOrderResponse = http.post(
        `${BASE_URL}/api/orders`,
        JSON.stringify({
          cartId: 'cart-123',
          shippingAddress: {
            firstName: 'John',
            lastName: 'Doe',
            address: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'US',
          },
          shippingMethod: 'standard',
          paymentMethod: 'credit_card',
          paymentToken: 'tok_visa',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      check(createOrderResponse, {
        'Create order response time < 2000ms': (r) =>
          r.timings.duration < 2000,
      });

      responseTime.add(createOrderResponse.timings.duration);
      errorRate.add(createOrderResponse.status > 299);
    }
  });

  sleep(1);
}

/**
 * Concurrent User Load Test
 */
export function testConcurrentUserLoad() {
  group('Concurrent Load Tests', () => {
    activeUsers.add(__VU);

    // Simulate multiple concurrent requests
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/products?page=1&limit=20`],
      ['GET', `${BASE_URL}/api/products?page=2&limit=20`],
      ['GET', `${BASE_URL}/api/products?page=3&limit=20`],
    ]);

    responses.forEach((response) => {
      check(response, {
        'Status is 200': (r) => r.status === 200,
        'Response time < 1000ms': (r) => r.timings.duration < 1000,
      });

      responseTime.add(response.timings.duration);
      errorRate.add(response.status !== 200);
    });

    activeUsers.add(-1);
  });

  sleep(1);
}

/**
 * Frontend Performance Test
 */
export function testFrontendPerformance() {
  group('Frontend Performance Tests', () => {
    // Test homepage load
    const homepageResponse = http.get(HOMEPAGE_URL);

    check(homepageResponse, {
      'Homepage status is 200': (r) => r.status === 200,
      'Homepage load time < 3000ms': (r) => r.timings.duration < 3000,
    });

    responseTime.add(homepageResponse.timings.duration);

    // Test product page navigation
    if (homepageResponse.status === 200) {
      sleep(1);
      const productsResponse = http.get(`${HOMEPAGE_URL}/products`);

      check(productsResponse, {
        'Products page status is 200': (r) => r.status === 200,
        'Products page load time < 2000ms': (r) => r.timings.duration < 2000,
      });

      responseTime.add(productsResponse.timings.duration);
    }
  });

  sleep(1);
}

/**
 * Database Query Performance Tests
 */
export function testDatabasePerformance() {
  group('Database Query Tests', () => {
    // Multiple queries to test database performance
    const queries = [
      `${BASE_URL}/api/products?search=laptop&limit=100`,
      `${BASE_URL}/api/products?category=electronics&limit=50`,
      `${BASE_URL}/api/products?sort=rating&order=desc&limit=20`,
    ];

    queries.forEach((query) => {
      const response = http.get(query);

      check(response, {
        'Query status is 200': (r) => r.status === 200,
        'Query response time < 2000ms': (r) => r.timings.duration < 2000,
      });

      responseTime.add(response.timings.duration);
      errorRate.add(response.status !== 200);
    });
  });

  sleep(2);
}

/**
 * API Rate Limiting Test
 */
export function testRateLimiting() {
  group('Rate Limiting Tests', () => {
    // Simulate rapid requests
    for (let i = 0; i < 50; i++) {
      const response = http.get(
        `${BASE_URL}/api/products?page=${Math.ceil(i / 20)}`
      );

      check(response, {
        'Request status is 200 or 429': (r) =>
          r.status === 200 || r.status === 429,
      });

      if (response.status === 429) {
        console.log(`Rate limited after ${i} requests`);
      }

      responseTime.add(response.timings.duration);
    }
  });

  sleep(2);
}

/**
 * Main load test execution
 */
export default function () {
  // Run different test scenarios
  testAuthenticationPerformance();
  testProductSearchPerformance();
  testProductCatalogPerformance();
  testShoppingCartPerformance();
  testOrderProcessingPerformance();
  testConcurrentUserLoad();
  testFrontendPerformance();
  testDatabasePerformance();
  testRateLimiting();
}

/**
 * Setup and teardown
 */
export function setup() {
  console.log('Setting up performance tests...');
}

export function teardown() {
  console.log('Tearing down performance tests...');
  console.log('Performance test results available in summary');
}

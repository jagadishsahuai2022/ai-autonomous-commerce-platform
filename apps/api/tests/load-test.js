import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

/**
 * PRODUCTION-GRADE LOAD TESTING SCRIPT
 * Simulates 10k-100k concurrent users with realistic scenarios
 * Run with: k6 run -u 10000 -d 10m load-test.js
 */

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const searchDuration = new Trend('search_duration');
const rankingDuration = new Trend('ranking_duration');
const purchaseDuration = new Trend('purchase_duration');
const totalRequests = new Counter('total_requests');
const activeUsers = new Gauge('active_users');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp-up to 100 users
    { duration: '5m', target: 1000 }, // Ramp-up to 1000 users
    { duration: '10m', target: 5000 }, // Ramp-up to 5000 users
    { duration: '5m', target: 10000 }, // Ramp-up to 10000 users
    { duration: '20m', target: 10000 }, // Stress test at 10000 users
    { duration: '5m', target: 0 }, // Ramp-down
  ],
  thresholds: {
    errors: ['rate<0.1'], // Error rate should be < 10%
    api_duration: ['p(95)<500'], // 95th percentile under 500ms
    search_duration: ['p(95)<2000'], // Search under 2s
    ranking_duration: ['p(95)<5000'], // Ranking under 5s
    purchase_duration: ['p(95)<1000'], // Purchase under 1s
    http_req_failed: ['rate<0.1'], // HTTP failure rate < 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const DEMO_PRODUCTS_COUNT = 500;
const DEMO_USERS_COUNT = 10;

export default function () {
  activeUsers.add(__VU);

  // Simulate realistic user behavior

  group('User Authentication & Session', () => {
    authenticateUser();
    sleep(1);
  });

  group('Product Search Scenario', () => {
    searchProducts();
    sleep(2);
  });

  group('Product Ranking Scenario', () => {
    rankProducts();
    sleep(3);
  });

  group('Cart Operations', () => {
    addToCart();
    viewCart();
    sleep(1);
  });

  group('Checkout & Payment', () => {
    checkout();
    sleep(2);
  });

  group('AI Chat Interaction', () => {
    chatWithAI();
    sleep(2);
  });

  // Random browsing
  sleep(__VU % 5);
}

/**
 * Authentication & Session Management
 */
function authenticateUser() {
  const demoUserId = (__VU % DEMO_USERS_COUNT) + 1;
  const payload = JSON.stringify({
    email: `user${demoUserId}@demo.com`,
    password: 'demo123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/auth/login`, payload, params);

  totalRequests.add(1);
  apiDuration.add(res.timings.duration);

  check(res, {
    'Login successful': (r) => r.status === 200 || r.status === 201,
    'Response has access token': (r) => r.body.includes('accessToken'),
  }) || errorRate.add(1);

  // Store token for subsequent requests
  if (res.status === 200 || res.status === 201) {
    const body = JSON.parse(res.body);
    const token = body.data.accessToken;
    // Token would be stored in context for use in other requests
  }
}

/**
 * Product Search with Filters
 */
function searchProducts() {
  const categories = ['Electronics', 'Groceries', 'Fashion', 'Home & Kitchen'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const queryParams = `query=${randomCategory}&page=1&limit=20&sort=relevance`;

  const res = http.get(`${BASE_URL}/products/search?${queryParams}`, params);

  totalRequests.add(1);
  searchDuration.add(res.timings.duration);

  check(res, {
    'Search successful': (r) => r.status === 200,
    'Has product results': (r) => r.body.includes('products'),
    'Response time < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);
}

/**
 * Product Ranking Request
 */
function rankProducts() {
  const payload = JSON.stringify({
    productIds: Array.from({ length: 10 }, (_, i) => i + 1),
    filters: {
      maxPrice: 100000,
      minRating: 3.5,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/ranking/rank-products`, payload, params);

  totalRequests.add(1);
  rankingDuration.add(res.timings.duration);

  check(res, {
    'Ranking successful': (r) => r.status === 200,
    'Has ranked products': (r) => r.body.includes('ranked'),
    'Response time < 5s': (r) => r.timings.duration < 5000,
  }) || errorRate.add(1);
}

/**
 * Add to Cart
 */
function addToCart() {
  const productId = Math.floor(Math.random() * DEMO_PRODUCTS_COUNT) + 1;

  const payload = JSON.stringify({
    productId,
    quantity: Math.floor(Math.random() * 3) + 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/cart/add`, payload, params);

  totalRequests.add(1);
  apiDuration.add(res.timings.duration);

  check(res, {
    'Add to cart successful': (r) => r.status === 200 || r.status === 201,
  }) || errorRate.add(1);
}

/**
 * View Cart
 */
function viewCart() {
  const res = http.get(`${BASE_URL}/cart`);

  totalRequests.add(1);
  apiDuration.add(res.timings.duration);

  check(res, {
    'View cart successful': (r) => r.status === 200,
    'Has cart items': (r) => r.body.includes('items'),
  }) || errorRate.add(1);
}

/**
 * Checkout
 */
function checkout() {
  const payload = JSON.stringify({
    shippingAddress: {
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
    },
    paymentMethod: 'wallet',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `checkout-${Date.now()}-${__VU}`,
    },
  };

  const res = http.post(`${BASE_URL}/orders/checkout`, payload, params);

  totalRequests.add(1);
  purchaseDuration.add(res.timings.duration);

  check(res, {
    'Checkout successful': (r) => r.status === 200 || r.status === 201,
    'Order created': (r) => r.body.includes('orderId'),
  }) || errorRate.add(1);
}

/**
 * AI Chat Interaction
 */
function chatWithAI() {
  const queries = [
    'Show me best laptops under 100000',
    'I need daily grocery items',
    'Best smartphones available',
    'Fashion deals for men',
  ];

  const randomQuery = queries[Math.floor(Math.random() * queries.length)];

  const payload = JSON.stringify({
    message: randomQuery,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/chat/message`, payload, params);

  totalRequests.add(1);
  apiDuration.add(res.timings.duration);

  check(res, {
    'Chat request successful': (r) => r.status === 200,
    'Has AI response': (r) => r.body.includes('response'),
  }) || errorRate.add(1);
}

/**
 * Metrics summary line
 * Shows final metrics after test completes
 */
export function handleSummary(data) {
  console.log('📊 Load Test Results Summary 📊');
  console.log(`
    Total Requests: ${data.metrics.total_requests.value}
    Error Rate: ${((data.metrics.errors.value / data.metrics.total_requests.value) * 100).toFixed(2)}%
    
    API Latency:
    - Average: ${(data.metrics.api_duration.values.avg / 1000).toFixed(2)}s
    - p95: ${(data.metrics.api_duration.values['p(95)'] / 1000).toFixed(2)}s
    - p99: ${(data.metrics.api_duration.values['p(99)'] / 1000).toFixed(2)}s
    
    Search Latency:
    - Average: ${(data.metrics.search_duration.values.avg / 1000).toFixed(2)}s
    - p95: ${(data.metrics.search_duration.values['p(95)'] / 1000).toFixed(2)}s
    
    Ranking Latency:
    - Average: ${(data.metrics.ranking_duration.values.avg / 1000).toFixed(2)}s
    - p95: ${(data.metrics.ranking_duration.values['p(95)'] / 1000).toFixed(2)}s
    
    Purchase Latency:
    - Average: ${(data.metrics.purchase_duration.values.avg / 1000).toFixed(2)}s
    - p95: ${(data.metrics.purchase_duration.values['p(95)'] / 1000).toFixed(2)}s
  `);

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

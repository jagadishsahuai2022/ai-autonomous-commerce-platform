/**
 * K6 Performance Tests — DelegateCart API
 *
 * Scenarios:
 *   1. Load test     — ramp to 1000 VUs, hold 5 min
 *   2. Spike test    — sudden burst to 5000 VUs
 *   3. Endurance     — 200 VUs for 1 hour
 *   4. Smoke         — 5 VUs for 1 min (CI gate)
 *
 * Run: k6 run tests/performance/load.test.js --scenario load
 * Run smoke: k6 run tests/performance/load.test.js --scenario smoke
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────

const errorRate = new Rate('errors');
const productListLatency = new Trend('product_list_latency', true);
const featuredLatency = new Trend('featured_products_latency', true);
const authLatency = new Trend('auth_latency', true);
const aiChatLatency = new Trend('ai_chat_latency', true);
const successfulRequests = new Counter('successful_requests');

// ─── Options ──────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      tags: { scenario: 'smoke' },
    },

    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // warm-up
        { duration: '5m', target: 500 },   // ramp to 500
        { duration: '5m', target: 1000 },  // ramp to 1000
        { duration: '5m', target: 1000 },  // hold at 1000
        { duration: '3m', target: 0 },     // ramp down
      ],
      tags: { scenario: 'load' },
    },

    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },   // baseline
        { duration: '30s', target: 5000 },  // spike
        { duration: '1m', target: 5000 },   // hold spike
        { duration: '30s', target: 200 },   // recover
        { duration: '30s', target: 0 },     // ramp down
      ],
      tags: { scenario: 'spike' },
    },

    endurance: {
      executor: 'constant-vus',
      vus: 200,
      duration: '1h',
      tags: { scenario: 'endurance' },
    },
  },

  thresholds: {
    // API latency targets
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    product_list_latency: ['p(95)<300'],
    featured_products_latency: ['p(95)<200'],
    auth_latency: ['p(95)<400'],
    ai_chat_latency: ['p(95)<800'],

    // Error rate — max 1%
    errors: ['rate<0.01'],

    // HTTP failure rate — max 0.5%
    http_req_failed: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

// ─── VU Scenarios ─────────────────────────────────────────────────────────────

export default function () {
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% — Browse products (most common)
    browseProducts();
  } else if (scenario < 0.6) {
    // 20% — View featured products
    viewFeaturedProducts();
  } else if (scenario < 0.75) {
    // 15% — View product detail
    viewProductDetail();
  } else if (scenario < 0.88) {
    // 13% — Auth flow
    authFlow();
  } else {
    // 12% — AI chat
    aiChatFlow();
  }

  sleep(1 + Math.random() * 2); // 1-3s think time
}

// ─── Scenario Functions ───────────────────────────────────────────────────────

function browseProducts() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/products?take=20&skip=0`, {
    headers: { 'Accept': 'application/json' },
    tags: { name: 'products_list' },
  });

  productListLatency.add(Date.now() - start);

  const ok = check(res, {
    'products list: status 200': r => r.status === 200,
    'products list: has data': r => {
      try { return JSON.parse(String(r.body)).data?.length > 0; }
      catch { return false; }
    },
    'products list: response < 300ms': r => r.timings.duration < 300,
  });

  errorRate.add(!ok);
  if (ok) successfulRequests.add(1);
}

function viewFeaturedProducts() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/products/featured?limit=12`, {
    headers: { 'Accept': 'application/json' },
    tags: { name: 'products_featured' },
  });

  featuredLatency.add(Date.now() - start);

  const ok = check(res, {
    'featured: status 200': r => r.status === 200,
    'featured: response < 200ms': r => r.timings.duration < 200,
  });

  errorRate.add(!ok);
  if (ok) successfulRequests.add(1);
}

function viewProductDetail() {
  const productIds = [1, 2, 3, 4, 5];
  const id = productIds[Math.floor(Math.random() * productIds.length)];

  const res = http.get(`${BASE_URL}/products/${id}`, {
    headers: { 'Accept': 'application/json' },
    tags: { name: 'product_detail' },
  });

  const ok = check(res, {
    'product detail: status 200 or 404': r => r.status === 200 || r.status === 404,
    'product detail: response < 300ms': r => r.timings.duration < 300,
  });

  errorRate.add(!ok);
  if (ok) successfulRequests.add(1);
}

function authFlow() {
  const start = Date.now();
  const payload = JSON.stringify({
    email: `loadtest+${__VU}@delegatecart.com`,
    password: 'LoadTest123!',
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    tags: { name: 'auth_login' },
  });

  authLatency.add(Date.now() - start);

  // 200 (success) or 401 (wrong creds) are both acceptable
  const ok = check(res, {
    'auth: responds': r => r.status === 200 || r.status === 401 || r.status === 400,
    'auth: latency < 400ms': r => r.timings.duration < 400,
  });

  errorRate.add(res.status >= 500);
  if (ok) successfulRequests.add(1);
}

function aiChatFlow() {
  const queries = [
    'best phone under 50000',
    'laptop for gaming',
    'wireless headphones with noise cancellation',
    'running shoes under 3000',
  ];
  const query = queries[Math.floor(Math.random() * queries.length)];

  const start = Date.now();
  const payload = JSON.stringify({ query, userId: `load-test-${__VU}` });

  const res = http.post(`${BASE_URL}/ai-chat/parse-intent`, payload, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    tags: { name: 'ai_chat' },
    timeout: '10s',
  });

  aiChatLatency.add(Date.now() - start);

  const ok = check(res, {
    'ai chat: responds': r => r.status === 200 || r.status === 201 || r.status === 404,
    'ai chat: latency < 800ms': r => r.timings.duration < 800,
  });

  errorRate.add(res.status >= 500);
  if (ok) successfulRequests.add(1);
}

// ─── Lifecycle Hooks ──────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      http_req_duration_p95: data.metrics.http_req_duration?.values?.['p(95)'],
      http_req_duration_p99: data.metrics.http_req_duration?.values?.['p(99)'],
      error_rate: data.metrics.errors?.values?.rate,
      vus_max: data.metrics.vus_max?.values?.max,
      successful_requests: data.metrics.successful_requests?.values?.count,
    },
    thresholds_passed: Object.values(data.metrics).every(
      (m) => !m.thresholds || Object.values(m.thresholds).every((t) => t.ok)
    ),
  };

  console.log('\n=== PERFORMANCE SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  return {
    'tests/performance/results/latest.json': JSON.stringify(data, null, 2),
    stdout: `\n✅ Load test complete. P95: ${summary.metrics.http_req_duration_p95?.toFixed(0)}ms\n`,
  };
}

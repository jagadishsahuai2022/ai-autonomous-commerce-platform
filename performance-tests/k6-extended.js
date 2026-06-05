/**
 * DelegateCart — Extended K6 Performance & Load Tests
 * Round 58: post-migration stack (NestJS 11 + Next.js 16.2.3 + React 19.2)
 *
 * Scenarios:
 *   1. smoke       — 1 VU × 30s (sanity check)
 *   2. load        — ramp to 20 VU over 2m, hold 3m
 *   3. stress      — ramp to 50 VU over 3m, check breaking point
 *   4. api_only    — API-only load (no browser rendering)
 *
 * Run:
 *   k6 run performance-tests/k6-extended.js
 *   k6 run --env SCENARIO=smoke performance-tests/k6-extended.js
 *   k6 run --env BASE_URL=http://localhost:3000 --env API_URL=http://localhost:3001 performance-tests/k6-extended.js
 */

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ── Custom Metrics ────────────────────────────────────────────────────────────
const errorRate         = new Rate('error_rate');
const homepageLatency   = new Trend('homepage_latency_ms');
const productApiLatency = new Trend('product_api_latency_ms');
const searchLatency     = new Trend('search_latency_ms');
const authLatency       = new Trend('auth_latency_ms');
const obsLatency        = new Trend('observability_latency_ms');
const requestCount      = new Counter('total_requests');
const activeVUs         = new Gauge('active_vus');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE     = __ENV.BASE_URL ?? 'http://localhost:3000';
const API      = __ENV.API_URL  ?? 'http://localhost:3001';
const SCENARIO = __ENV.SCENARIO ?? 'load';

// ── Scenarios ─────────────────────────────────────────────────────────────────
const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    tags: { scenario: 'smoke' },
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '60s', target: 10 },
      { duration: '3m',  target: 20 },
      { duration: '30s', target: 0 },
    ],
    tags: { scenario: 'load' },
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '60s', target: 20 },
      { duration: '2m',  target: 50 },
      { duration: '60s', target: 80 },
      { duration: '30s', target: 0 },
    ],
    tags: { scenario: 'stress' },
  },
  api_only: {
    executor: 'constant-arrival-rate',
    rate: 30,          // 30 req/s
    timeUnit: '1s',
    duration: '2m',
    preAllocatedVUs: 20,
    maxVUs: 50,
    tags: { scenario: 'api_only' },
  },
};

export const options = {
  scenarios: { [SCENARIO]: SCENARIOS[SCENARIO] ?? SCENARIOS.load },
  thresholds: {
    'http_req_duration':           ['p(95)<2000', 'p(99)<5000'],
    'http_req_failed':             ['rate<0.05'],
    'error_rate':                  ['rate<0.05'],
    'homepage_latency_ms':         ['p(95)<5000'],
    'product_api_latency_ms':      ['p(95)<1000'],
    'search_latency_ms':           ['p(95)<2000'],
    'auth_latency_ms':             ['p(95)<1000'],
  },
};

// ── Test Data ─────────────────────────────────────────────────────────────────
const SEARCH_TERMS = ['laptop', 'phone', 'headphones', 'camera', 'tablet', 'watch', 'speaker'];
const PRODUCT_IDS  = Array.from({ length: 20 }, (_, i) => `mock-${i + 1}`);
const USERS = [
  { email: 'basicdemo@delegatecart.com' },
  { email: 'admin@delegatecart.com' },
  { email: 'analytics@delegatecart.com' },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
const jsonHeaders = { 'Content-Type': 'application/json' };

// ── Default Test Function ─────────────────────────────────────────────────────
export default function () {
  activeVUs.add(1);

  // ── Group 1: Homepage ──────────────────────────────────────────────────────
  group('Homepage', () => {
    const t0 = Date.now();
    const res = http.get(`${BASE}/`);
    const latency = Date.now() - t0;
    homepageLatency.add(latency);
    requestCount.add(1);

    const ok = check(res, {
      'homepage: status 200':        r => r.status === 200,
      'homepage: has DelegateCart':  r => r.body.includes('DelegateCart'),
      'homepage: latency < 8s':      () => latency < 8000,
    });
    errorRate.add(!ok);
    sleep(0.5);
  });

  // ── Group 2: Product Catalog API ───────────────────────────────────────────
  group('Product Catalog API', () => {
    const id = pick(PRODUCT_IDS);
    const t0 = Date.now();
    const res = http.get(`${BASE}/api/products/${id}`);
    const latency = Date.now() - t0;
    productApiLatency.add(latency);
    requestCount.add(1);

    const ok = check(res, {
      'product API: status 200':   r => r.status === 200,
      'product API: has id field': r => {
        try { return !!JSON.parse(r.body).id; } catch { return false; }
      },
      'product API: latency < 2s': () => latency < 2000,
    });
    errorRate.add(!ok);
    sleep(0.3);
  });

  // ── Group 3: Search API ────────────────────────────────────────────────────
  group('Search API', () => {
    const q = pick(SEARCH_TERMS);
    const t0 = Date.now();
    const res = http.get(`${BASE}/api/search?q=${q}&limit=10`);
    const latency = Date.now() - t0;
    searchLatency.add(latency);
    requestCount.add(1);

    const ok = check(res, {
      'search API: status 200':   r => r.status === 200,
      'search API: returns body': r => r.body.length > 10,
      'search API: latency < 3s': () => latency < 3000,
    });
    errorRate.add(!ok);
    sleep(0.3);
  });

  // ── Group 4: Auth Flow ─────────────────────────────────────────────────────
  group('Auth Flow', () => {
    const user = pick(USERS);
    const t0 = Date.now();
    const loginRes = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ email: user.email }),
      { headers: jsonHeaders }
    );
    const latency = Date.now() - t0;
    authLatency.add(latency);
    requestCount.add(1);

    const loginOk = check(loginRes, {
      'auth login: status 200':      r => r.status === 200,
      'auth login: returns token':   r => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
      'auth login: latency < 2s':    () => latency < 2000,
    });
    errorRate.add(!loginOk);

    // If login succeeded, exercise /api/auth/me
    if (loginOk && loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        if (body.token) {
          const meRes = http.get(`${BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${body.token}` },
          });
          requestCount.add(1);
          check(meRes, { 'auth me: status 200': r => r.status === 200 });
        }
      } catch {}
    }
    sleep(0.5);
  });

  // ── Group 5: Journey Events Tracking ──────────────────────────────────────
  group('Journey Tracking', () => {
    const eventTypes = ['product_viewed', 'cart_added', 'search_performed'];
    const payload = JSON.stringify({
      eventType: pick(eventTypes),
      productId: pick(PRODUCT_IDS),
      userId: `perf-user-${__VU}`,
      metadata: { source: 'k6-perf-test' },
    });
    const res = http.post(`${BASE}/api/events/journey`, payload, {
      headers: jsonHeaders,
    });
    requestCount.add(1);
    check(res, {
      'journey event: accepted': r => [200, 201, 204].includes(r.status),
    });
    sleep(0.2);
  });
}

// ── Summary Handler ───────────────────────────────────────────────────────────
export function handleSummary(data) {
  const passed = data.metrics['http_req_failed']?.values?.rate < 0.05;
  const p95    = data.metrics['http_req_duration']?.values?.['p(95)'] ?? 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Performance Test Summary — ${SCENARIO.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total requests:    ${data.metrics['total_requests']?.values?.count ?? 0}`);
  console.log(`Error rate:        ${((data.metrics['error_rate']?.values?.rate ?? 0) * 100).toFixed(2)}%`);
  console.log(`p(95) latency:     ${p95.toFixed(0)}ms`);
  console.log(`Status:            ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    'test-results/k6-r58-summary.json': JSON.stringify(data, null, 2),
    stdout: `\nK6 ${SCENARIO} complete — p95=${p95.toFixed(0)}ms errors=${((data.metrics['error_rate']?.values?.rate ?? 0) * 100).toFixed(2)}%\n`,
  };
}

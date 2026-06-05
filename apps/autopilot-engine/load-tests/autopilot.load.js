/**
 * Autopilot Engine - K6 Performance & Load Testing
 * Load testing for scalability validation
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const duration = new Trend('request_duration');
const successCount = new Counter('successful_requests');
const activeVUs = new Gauge('active_VUs');

// Test configurations
export const options = {
  stages: [
    // Ramp up to 100 VUs over 1 minute
    { duration: '1m', target: 100 },
    // Stay at 100 VUs for 2 minutes
    { duration: '2m', target: 100 },
    // Ramp up to 500 VUs over 2 minutes
    { duration: '2m', target: 500 },
    // Stay at 500 VUs for 3 minutes (stress test)
    { duration: '3m', target: 500 },
    // Ramp down to 0 VUs
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.1'], // Error rate below 10%
    request_duration: ['p(95)<500'], // 95% of requests under 500ms
  },
};

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

export function setup() {
  // Setup test data (authenticate, create test user, etc.)
  const authRes = http.post(`${API_BASE}/auth/login`, {
    email: 'loadtest@example.com',
    password: 'password123',
  });

  const authToken = authRes.json('token');
  return { token: authToken };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  };

  activeVUs.add(1);

  // Test 1: Rule Creation Load Test
  group('Rule Creation', () => {
    const rulePayload = JSON.stringify({
      userId: `user-${__VU}-${__ITER}`,
      name: `Load Test Rule ${__ITER}`,
      description: 'Automated load test rule',
      conditions: [
        {
          field: 'price',
          operator: 'lte',
          value: Math.floor(Math.random() * 100000) + 10000,
        },
        {
          field: 'category',
          operator: 'in',
          value: ['electronics', 'smartphones', 'accessories'],
        },
        {
          field: 'rating',
          operator: 'gte',
          value: 4.0,
        },
      ],
      action: {
        type: 'auto_buy',
        parameters: {
          quantity: 1,
          maxRetries: 3,
        },
      },
      maxSpendPerMonth: Math.floor(Math.random() * 500000) + 100000,
      maxOrderValue: Math.floor(Math.random() * 200000) + 50000,
    });

    const startTime = Date.now();
    const res = http.post(`${API_BASE}/autopilot/rules`, rulePayload, params);
    const requestDuration = Date.now() - startTime;

    duration.add(requestDuration);

    check(res, {
      'rule creation status is 201': (r) => r.status === 201,
      'rule creation response time < 1s': (r) => r.timings.duration < 1000,
      'response has rule ID': (r) => r.json('data.id') !== null,
    });

    if (res.status !== 201) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });

  sleep(1);

  // Test 2: Decision Evaluation Load Test
  group('Decision Evaluation', () => {
    const decisionPayload = JSON.stringify({
      userId: `user-${__VU}`,
      product: {
        id: `prod-${Math.random() * 10000}`,
        name: 'Load Test Product',
        price: Math.floor(Math.random() * 100000),
        category: 'electronics',
        brand: 'TestBrand',
        rating: Math.random() * 5,
        stock: Math.floor(Math.random() * 100) + 1,
        imageUrl: 'https://example.com/image.jpg',
      },
      userHistory: {
        userId: `user-${__VU}`,
        totalPurchases: Math.floor(Math.random() * 50),
        totalSpent: Math.floor(Math.random() * 1000000),
        returnRate: Math.random() * 0.3,
        averageRating: Math.random() * 5,
        purchasesByCategory: {
          electronics: Math.floor(Math.random() * 20),
        },
        lastPurchaseDate: new Date().toISOString(),
      },
      minimumConfidenceThreshold: 0.6,
    });

    const startTime = Date.now();
    const res = http.post(`${API_BASE}/autopilot/evaluate`, decisionPayload, params);
    const requestDuration = Date.now() - startTime;

    duration.add(requestDuration);

    check(res, {
      'decision evaluation status is 200': (r) => r.status === 200,
      'decision response time < 500ms': (r) => r.timings.duration < 500,
      'response has confidence': (r) => r.json('data.confidence.overall') !== null,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });

  sleep(1);

  // Test 3: Rule Retrieval Load Test
  group('Rule Retrieval', () => {
    const startTime = Date.now();
    const res = http.get(`${API_BASE}/autopilot/rules?userId=user-${__VU}&limit=50`, params);
    const requestDuration = Date.now() - startTime;

    duration.add(requestDuration);

    check(res, {
      'rule retrieval status is 200': (r) => r.status === 200,
      'retrieval response time < 300ms': (r) => r.timings.duration < 300,
      'response has data array': (r) => Array.isArray(r.json('data')),
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });

  sleep(1);

  // Test 4: Safety Check Load Test
  group('Safety Layer Check', () => {
    const safetyPayload = JSON.stringify({
      userId: `user-${__VU}`,
      proposedAmount: Math.floor(Math.random() * 100000),
      monthlyLimit: 500000,
    });

    const startTime = Date.now();
    const res = http.post(`${API_BASE}/autopilot/safety/check-anomaly`, safetyPayload, params);
    const requestDuration = Date.now() - startTime;

    duration.add(requestDuration);

    check(res, {
      'safety check status is 200': (r) => r.status === 200,
      'safety check response time < 200ms': (r) => r.timings.duration < 200,
      'response has anomaly data': (r) => r.json('data.isAnomaly') !== null,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });

  sleep(1);

  // Test 5: Approval Workflow Check
  group('Approval Workflow', () => {
    const approvalPayload = JSON.stringify({
      userId: `user-${__VU}`,
      decision: {
        confidence: Math.random(),
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        amount: Math.floor(Math.random() * 100000),
        monthlyLimit: 500000,
      },
    });

    const startTime = Date.now();
    const res = http.post(`${API_BASE}/autopilot/safety/check-approval`, approvalPayload, params);
    const requestDuration = Date.now() - startTime;

    duration.add(requestDuration);

    check(res, {
      'approval check status is 200': (r) => r.status === 200,
      'approval check response time < 200ms': (r) => r.timings.duration < 200,
      'response has approval data': (r) => r.json('data.requiresApproval') !== null,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });

  sleep(1);

  // Test 6: India Localization Features Load Test
  group('India Localization', () => {
    const localizationPayload = JSON.stringify({
      amount: Math.floor(Math.random() * 500000) + 10000,
      userPincode: '110001',
      userId: `user-${__VU}`,
    });

    const startTime = Date.now();
    const res = http.post(
      `${API_BASE}/autopilot/localization/india/emi-options`,
      localizationPayload,
      params
    );
    const requestDuration = Date.now() - startTime;

    duration.add(requestDuration);

    check(res, {
      'localization status is 200': (r) => r.status === 200,
      'localization response time < 300ms': (r) => r.timings.duration < 300,
      'response has EMI options': (r) => Array.isArray(r.json('data')),
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });

  activeVUs.add(-1);
  sleep(1);
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Helper function for text summary
function textSummary(data, options) {
  const { metrics } = data;
  const indent = options?.indent || '  ';

  let summary = '\n\n📊 Performance Test Summary\n';
  summary += '=' + '='.repeat(40) + '\n\n';

  // Request metrics
  if (metrics['request_duration']) {
    const durations = metrics['request_duration'];
    summary += `${indent}Request Duration (ms):\n`;
    summary += `${indent}  p50: ${durations.values.p50?.toFixed(2)}\n`;
    summary += `${indent}  p95: ${durations.values.p95?.toFixed(2)}\n`;
    summary += `${indent}  p99: ${durations.values.p99?.toFixed(2)}\n`;
    summary += `${indent}  max: ${durations.values.max?.toFixed(2)}\n\n`;
  }

  // Success/error metrics
  summary += `${indent}Request Results:\n`;
  if (metrics['successful_requests']) {
    summary += `${indent}  ✓ Successful: ${metrics['successful_requests'].value}\n`;
  }
  if (metrics['errors']) {
    summary += `${indent}  ✗ Error Rate: ${(metrics['errors'].value * 100).toFixed(2)}%\n`;
  }

  summary += '\n';

  return summary;
}

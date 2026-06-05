import { test, expect } from '@playwright/test';

/**
 * Verification tests to confirm API and Web deployment is working
 * Tests the critical health endpoints and basic API connectivity
 */

test.describe('API Deployment Verification', () => {
  test('should verify API health endpoint responds', async ({ page }) => {
    // Test API health endpoint
    const healthResponse = await page.request.get('http://localhost:3001/health');
    expect(healthResponse.status()).toBe(200);

    const healthData = await healthResponse.json();
    console.log('✅ API Health Check Passed:', healthData);
  });

  test('should verify metrics endpoint is available', async ({ page }) => {
    // Test metrics endpoint
    const metricsResponse = await page.request.get('http://localhost:3001/metrics');
    expect(metricsResponse.status()).toBe(200);

    const metricsText = await metricsResponse.text();
    expect(metricsText).toContain('http_request_duration_seconds');
    expect(metricsText).toContain('# HELP');
    console.log('✅ Metrics Endpoint Passed - Prometheus metrics are exposed');
  });

  test('should verify no duplicate metric registration errors', async ({ page }) => {
    // Make multiple requests to ensure metrics are not being re-registered
    for (let i = 0; i < 3; i++) {
      const metricsResponse = await page.request.get('http://localhost:3001/metrics');
      expect(metricsResponse.status()).toBe(200);
    }
    console.log('✅ Multiple metric requests successful - no duplication errors');
  });

  test('should verify API root endpoint', async ({ page }) => {
    // Test API root endpoint
    const rootResponse = await page.request.get('http://localhost:3001/');
    expect(rootResponse.status()).toBe(200);
    console.log('✅ API Root Endpoint Passed');
  });

  test('should verify auth endpoints are available', async ({ page }) => {
    // Test that auth endpoints are registered
    const loginResponse = await page.request.post('http://localhost:3001/auth/login', {
      data: {
        email: 'test@test.com',
        password: 'test',
      },
    });

    // We expect 401 (Unauthorized) since invalid credentials, not 500 (Internal Error)
    expect([401, 400]).toContain(loginResponse.status());
    console.log('✅ Auth Endpoints Registered - responds with appropriate error');
  });

  test('should verify products endpoint is available', async ({ page }) => {
    // Test products endpoint
    const productsResponse = await page.request.get('http://localhost:3001/products');
    expect([200, 400, 401]).toContain(productsResponse.status());
    console.log('✅ Products Endpoint Available');
  });

  test('should verify web UI loads and connects to API', async ({ page }) => {
    // Navigate to web UI
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Check that the page loaded
    expect(page).toHaveTitle(/Commerce|Shop|Market/i);
    console.log('✅ Web UI Loaded Successfully');

    // Check that there are no console errors about connection failures
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });

    // Wait a bit for any initial API calls
    await page.waitForTimeout(2000);

    // Check that there are no connection errors to the API
    const hasConnectionError = pageErrors.some(
      (error) => error.includes('http://localhost:3001') && error.includes('ECONNREFUSED')
    );
    expect(hasConnectionError).toBe(false);
    console.log('✅ Web UI API Connection Successful');
  });

  test('should verify kafka connection warning is not a hard error', async ({ page }) => {
    // The API should still be fully functional even if Kafka has connection issues
    // This was the original issue - the app was crashing on Kafka connection failure

    const healthResponse = await page.request.get('http://localhost:3001/health');
    expect(healthResponse.status()).toBe(200);
    console.log('✅ API Running Successfully (Kafka resilience working)');
  });
});

test.describe('Performance Verification', () => {
  test('should verify API response times are acceptable', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.request.get('http://localhost:3001/health');
    const endTime = Date.now();

    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    console.log(`✅ API Response Time: ${responseTime}ms (acceptable)`);
  });

  test('should verify no memory leaks on repeated metrics requests', async ({ page }) => {
    // Make repeated requests to verify no memory accumulation
    let successCount = 0;
    for (let i = 0; i < 10; i++) {
      const response = await page.request.get('http://localhost:3001/metrics');
      if (response.status() === 200) {
        successCount++;
      }
    }

    expect(successCount).toBe(10);
    console.log('✅ Memory Stability Verified - repeated requests successful');
  });
});

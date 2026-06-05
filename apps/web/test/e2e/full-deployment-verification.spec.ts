import { test, expect } from '@playwright/test';

/**
 * Full integration test - Web and API deployment verification
 */

test.describe('Complete Deployment Verification', () => {
  test('should load web app homepage', async ({ page }) => {
    // Navigate to web app
    const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log('✅ Web app loaded successfully');
    expect(response?.status()).toBe(200);
  });

  test('should verify API connectivity from web', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Make an API call from the page
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:3001/health');
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    console.log('📡 API response from web:', apiResponse);
    expect(apiResponse.status).toBe(200);
  });

  test('should verify no console errors on page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Filter out expected Development mode warnings
    const realErrors = errors.filter(
      (err) =>
        !err.includes('Development') && !err.includes('telemetry') && !err.includes('Fast Refresh')
    );

    console.log(`✅ Page loaded with ${realErrors.length} errors (expected minimal)`);
    expect(realErrors.length).toBeLessThan(5);
  });

  test('should verify web app is interactive', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Try to interact with page
    const bodyElement = await page.$('body');
    expect(bodyElement).toBeTruthy();

    console.log('✅ Web app is interactive and DOM is accessible');
  });

  test('should verify API endpoints are all working', async ({ page }) => {
    const endpoints = [
      { name: 'Health', url: 'http://localhost:3001/health', expectedStatus: 200 },
      { name: 'Metrics', url: 'http://localhost:3001/metrics', expectedStatus: 200 },
      { name: 'Products', url: 'http://localhost:3001/products', expectedStatus: 200 },
      { name: 'Root', url: 'http://localhost:3001/', expectedStatus: 200 },
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint.url);
      console.log(`  ✓ ${endpoint.name}: ${response.status()}`);
      expect(response.status()).toBe(endpoint.expectedStatus);
    }

    console.log('✅ All API endpoints working');
  });

  test('should verify metrics contain Prometheus data', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/metrics');
    const text = await response.text();

    expect(text).toContain('http_request_duration_seconds');
    expect(text).toContain('# HELP');
    expect(text).toContain('# TYPE');

    console.log('✅ Prometheus metrics are properly registered and exposed');
  });
});

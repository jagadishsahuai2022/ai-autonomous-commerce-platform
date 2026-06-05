import { chromium } from '@playwright/test';
import http from 'http';

/**
 * Global setup: Pre-warm all Next.js pages before tests run.
 * This ensures pages are compiled so individual tests don't hit compilation timeouts.
 */
async function warmPage(url: string): Promise<number> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume(); // drain body
      resolve(res.statusCode || 0);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(90000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

export default async function globalSetup() {
  console.log('\n[Global Setup] Pre-warming Next.js pages...');

  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
  const apiBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const pagesToWarm = [
    `${apiBase}`,
    `${apiBase}/products`,
    `${apiBase}/about`,
    `${apiBase}/signin`,
    `${apiBase}/ai-assistant`,
    `${apiBase}/dashboard`,
    `${apiBase}/orders`,
    `${apiBase}/account`,
    `${apiBase}/spending`,
    `${apiBase}/order-insights`,
    `${apiBase}/cart`,
    `${apiBase}/checkout`,
    `${apiBase}/profile`,
    `${apiBase}/shopping-list`,
    `${apiBase}/smart-delegate`,
    `${apiBase}/shopping-assistant`,
    `${apiBase}/shopping-assistant/metrics/validation`,
    `${apiBase}/checkout-failures`,
    `${apiBase}/failed-orders`,
    `${apiBase}/wallet`,
    `${apiBase}/copilot`,
    `${apiBase}/insights`,
    `${apiBase}/admin/learning`,
    `${apiBase}/admin/categories`,
    `${apiBase}/admin/tags`,
    `${apiBase}/api/auth/register`,
    `${apiBase}/api/orders`,
  ];

  for (const url of pagesToWarm) {
    const status = await warmPage(url);
    console.log(`  ${url} → HTTP ${status}`);
    // Small delay between warm-up requests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('[Global Setup] All pages warmed up. Starting tests...\n');
}

import { test, expect, Page } from '@playwright/test';

function seedSharedData(page: Page) {
  return page.evaluate(() => {
    const submissions = [
      {
        id: 'r44-u1',
        submittedAt: new Date(Date.now() - 20_000).toISOString(),
        userEmail: 'basicdemo@delegatecart.com',
        userName: 'Amit Kumar',
        results: [
          {
            productName: 'BASIC ONLY QUERY',
            preferredBrand: 'Dell',
            budget: 50000,
            quantity: 1,
            matches: [
              {
                name: 'Basic Laptop Model A',
                brand: 'Dell',
                price: 45999,
                rating: 4.2,
                matchScore: 88,
                estimatedDelivery: '2 days',
                emiAvailable: true,
                url: '#',
              },
            ],
          },
        ],
        summary: {
          totalItems: 1,
          totalMatches: 1,
          estimatedSavings: 'Rs 2,000',
        },
      },
      {
        id: 'r44-u2',
        submittedAt: new Date(Date.now() - 10_000).toISOString(),
        userEmail: 'aiplusdemo@delegatecart.com',
        userName: 'Ananya Rao',
        results: [
          {
            productName: 'AIPLUS ONLY QUERY',
            preferredBrand: 'HP',
            budget: 70000,
            quantity: 1,
            matches: [
              {
                name: 'AI Plus Laptop Model B',
                brand: 'HP',
                price: 66999,
                rating: 4.4,
                matchScore: 91,
                estimatedDelivery: '1 day',
                emiAvailable: true,
                url: '#',
              },
            ],
          },
        ],
        summary: {
          totalItems: 1,
          totalMatches: 1,
          estimatedSavings: 'Rs 3,500',
        },
      },
    ];

    const metricsHistory = [
      {
        id: 'r44-m1',
        userId: 'user-basicdemo',
        userEmail: 'basicdemo@delegatecart.com',
        query: 'BASIC METRICS QUERY',
        timestamp: Date.now() - 30_000,
        products: [],
        timeline: [],
      },
      {
        id: 'r44-m2',
        userId: 'user-aiplusdemo',
        userEmail: 'aiplusdemo@delegatecart.com',
        query: 'AIPLUS METRICS QUERY',
        timestamp: Date.now() - 15_000,
        products: [],
        timeline: [],
      },
    ];

    localStorage.setItem('shoppingListResults', JSON.stringify(submissions));
    localStorage.setItem('dc-metrics-history', JSON.stringify(metricsHistory));
    localStorage.removeItem('dc-validation-public-access');
  });
}

function setLoggedInUser(page: Page, email: string) {
  return page.evaluate((userEmail) => {
    localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('dc-user-email', userEmail);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('authToken', `token-${userEmail}`);
    localStorage.setItem('dc-auth-token', `token-${userEmail}`);
    localStorage.setItem('dc-user-id', `user-${userEmail.split('@')[0]}`);
  }, email);
}

test.describe('R44 Data Isolation', () => {
  test('basic user only sees own Smart Delegate and Metrics data', async ({ page }) => {
    await page.goto('/');
    await seedSharedData(page);
    await setLoggedInUser(page, 'basicdemo@delegatecart.com');

    await page.goto('/smart-delegate');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toContainText('BASIC ONLY QUERY');
    await expect(page.locator('body')).not.toContainText('AIPLUS ONLY QUERY');
    await page.screenshot({ path: 'r44-proof/01-basic-smart-delegate-isolated.png', fullPage: true });

    await page.goto('/shopping-assistant/metrics/validation');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toContainText('BASIC METRICS QUERY');
    await expect(page.locator('body')).not.toContainText('AIPLUS METRICS QUERY');
    await page.screenshot({ path: 'r44-proof/02-basic-metrics-isolated.png', fullPage: true });
  });

  test('privileged user can see cross-user data', async ({ page }) => {
    await page.goto('/');
    await seedSharedData(page);
    await setLoggedInUser(page, 'admin@delegatecart.com');

    await page.goto('/smart-delegate');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toContainText('BASIC ONLY QUERY');
    await expect(page.locator('body')).toContainText('AIPLUS ONLY QUERY');
    await page.screenshot({ path: 'r44-proof/03-admin-smart-delegate-all-users.png', fullPage: true });

    await page.goto('/shopping-assistant/metrics/validation');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.locator('body')).toContainText('BASIC METRICS QUERY');
    await expect(page.locator('body')).toContainText('AIPLUS METRICS QUERY');
    await page.screenshot({ path: 'r44-proof/04-admin-metrics-all-users.png', fullPage: true });
  });
});

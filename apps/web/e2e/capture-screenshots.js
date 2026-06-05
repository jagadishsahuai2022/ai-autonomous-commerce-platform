const { chromium } = require('@playwright/test');

const BASE = 'http://127.0.0.1:3000';
const DIR = 'd:/PersonalProject/GIT/delegatecart/r52-proof/r52plus/';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // Products page
    await page.goto(`${BASE}/products`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}05-products-page.png`, fullPage: true });
    console.log('products done');

    // Login as admin via localStorage
    await page.goto(`${BASE}/`);
    await page.evaluate(() => {
        localStorage.setItem('userEmail', 'admin@delegatecart.com');
        localStorage.setItem('authToken', 'token-admin-r52plus');
        localStorage.setItem('dc-user-id', 'admin-user-1');
        localStorage.setItem('dc-user-role', 'admin');
        localStorage.setItem('dc-user-subscription', 'ENTERPRISE');
    });
    await page.waitForTimeout(1000);

    // Admin dashboard
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}06-admin-dashboard.png`, fullPage: true });
    console.log('dashboard done');

    // Observability dashboard
    await page.goto(`${BASE}/observability`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}01-observability-dashboard.png`, fullPage: true });
    console.log('observability done');

    // Self-Learning dashboard
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}02-self-learning-dashboard.png`, fullPage: true });
    console.log('learning done');

    // Metrics Validation
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}03-metrics-validation.png`, fullPage: true });
    console.log('validation done');

    // Expand a session card
    const card = page.locator('[class*="cursor-pointer"], [role="button"]').first();
    if (await card.isVisible()) {
        await card.click();
        await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${DIR}04-validation-expanded.png`, fullPage: true });
    console.log('validation expanded done');

    // Wallet page
    await page.goto(`${BASE}/wallet`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}08-wallet-page.png`, fullPage: true });
    console.log('wallet done');

    // Shopping assistant
    await page.goto(`${BASE}/shopping-assistant`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}07-shopping-assistant.png`, fullPage: true });
    console.log('shopping assistant done');

    await browser.close();
    console.log('ALL SCREENSHOTS CAPTURED');
})();

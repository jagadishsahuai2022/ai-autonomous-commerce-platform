import { test, expect } from '@playwright/test';

test('debug positions', async ({ page }) => {
  await page.goto('http://localhost:3000/shopping-assistant', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const header = document.querySelector('header');
    const mainEl = document.querySelector('main');
    const pageDiv = mainEl?.firstElementChild;

    // Find the h2 "Smart Shopping Copilot"
    const allH2s = document.querySelectorAll('h2');
    const h2Data: any[] = [];
    allH2s.forEach((h) => {
      h2Data.push({
        text: h.textContent?.trim().slice(0, 40),
        rect: h.getBoundingClientRect(),
      });
    });

    // Find the blue header div (gradient)
    const blueHeaders = document.querySelectorAll('[class*="from-blue-500"]');
    const blueData: any[] = [];
    blueHeaders.forEach((el) => {
      blueData.push({
        tag: el.tagName,
        rect: el.getBoundingClientRect(),
        position: getComputedStyle(el).position,
        top: getComputedStyle(el).top,
        classes: (el as HTMLElement).className.slice(0, 100),
      });
    });

    return {
      headerRect: header?.getBoundingClientRect(),
      headerHeight: header?.offsetHeight,
      mainOffsetTop: (mainEl as HTMLElement)?.offsetTop,
      mainMarginTop: mainEl ? getComputedStyle(mainEl).marginTop : 'N/A',
      pageDivOffsetTop: (pageDiv as HTMLElement)?.offsetTop,
      pageDivMarginTop: pageDiv ? getComputedStyle(pageDiv).marginTop : 'N/A',
      pageDivClasses: (pageDiv as HTMLElement)?.className?.slice(0, 150),
      h2s: h2Data,
      blueHeaders: blueData,
      scrollY: window.scrollY,
      bodyOverflow: getComputedStyle(document.body).overflow,
      docScrollHeight: document.documentElement.scrollHeight,
      docClientHeight: document.documentElement.clientHeight,
    };
  });

  console.log(JSON.stringify(data, null, 2));
  expect(true).toBe(true);
});

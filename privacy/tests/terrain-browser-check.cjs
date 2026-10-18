// Isolated browser: never touches the player's normal browser storage.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('node:path');
(async () => {
  const { startServer } = await import('./serve.mjs');
  const server = await startServer(0);
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/privacy/?probe=shot-road');
    await page.waitForTimeout(12000);
    await page.evaluate(() => {
      const key = 'ethicity.privacy.progress.v1';
      const p = JSON.parse(localStorage.getItem(key));
      p.pos = Object.assign({}, p.pos, { x: 39, y: 17, dir: 'right' });
      localStorage.setItem(key, JSON.stringify(p));
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/privacy/');
    await page.getByRole('button', { name: '이어 하기', exact: true }).click();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => ['tree','lamp','bench','pond'].every(n => PrivacyOutdoor.ready(n)));
    await page.screenshot({ path: path.join(__dirname, '_shot-terrain.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, '_shot-terrain-mobile.png'), fullPage: true });
    console.log('Resumed position', await page.evaluate(() => PrivacyMap.debug.me()));
    await page.evaluate(() => {
      const key = 'ethicity.privacy.progress.v1', p = JSON.parse(localStorage.getItem(key));
      p.pos = Object.assign({}, p.pos, { x: 32, y: 18 });
      localStorage.setItem(key, JSON.stringify(p));
    });
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.reload();
    await page.getByRole('button', { name: '이어 하기', exact: true }).click();
    await page.waitForFunction(() => ['tree','lamp','bench','pond'].every(n => PrivacyOutdoor.ready(n)));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(__dirname, '_shot-outdoor.png'), fullPage: true });
    console.log(JSON.stringify({ errors, screenshot: '_shot-terrain.png' }));
    if (errors.length) process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

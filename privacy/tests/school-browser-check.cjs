// Uses a separate ephemeral browser context, never the player's browser storage.
const assert = require('node:assert/strict');
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
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.drawImage;
      window.__schoolDraws = new Set();
      CanvasRenderingContext2D.prototype.drawImage = function (im, ...args) {
        if (this.canvas.id === 'm-canvas' && im.src) window.__schoolDraws.add(im.src.split('/').pop());
        return original.call(this, im, ...args);
      };
    });
    const base = 'http://127.0.0.1:' + server.address().port + '/privacy/';
    await page.goto(base + '?probe=shot-map');
    await page.waitForTimeout(3500);
    async function position(x, y) {
      await page.evaluate(({x, y}) => {
        const key = 'ethicity.privacy.progress.v1';
        const p = JSON.parse(localStorage.getItem(key));
        p.pos = Object.assign({}, p.pos, { x, y, dir: 'up' });
        localStorage.setItem(key, JSON.stringify(p));
      }, {x, y});
      await page.goto(base);
      await page.getByRole('button', { name: '이어 하기', exact: true }).click();
      await page.waitForFunction(() => PrivacySchool.ready());
      await page.waitForTimeout(300);
    }
    async function draws() {
      await page.evaluate(() => window.__schoolDraws.clear());
      await page.waitForTimeout(150);
      return page.evaluate(() => Array.from(window.__schoolDraws));
    }
    async function shot(name) { await page.screenshot({ path: path.join(__dirname, '_shot-school-' + name + '.png'), fullPage: true }); }
    await position(10, 11);
    assert((await draws()).includes('exterior.png'), 'Roof drawn outside');
    assert(!(await draws()).includes('desk.png'), 'No classroom furniture outside');
    await shot('outside');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    assert.equal((await page.evaluate(() => PrivacyMap.debug.me())).y, 10, 'Walk through entrance');
    assert(!(await draws()).includes('exterior.png'), 'Roof removed on entry');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    assert((await draws()).includes('exterior.png'), 'Roof restored on exit');
    await position(5, 4); await shot('classroom');
    assert((await draws()).includes('desk.png'), 'New classroom desks drawn inside');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250); await shot('mobile');
    await page.setViewportSize({ width: 1200, height: 900 });
    await position(16, 5); await shot('library');
    assert((await draws()).includes('pc.png'), 'New library PC drawn');
    await position(34, 6);
    await page.waitForFunction(() => PrivacyRoom.ready());
    await shot('bedroom');
    assert((await draws()).includes('plush.png'), 'Large plush drawn in bedroom');
    const roomPaths = await page.evaluate(() => {
      const w = PRIVACY_WORLD, from = { x: 34, y: 7 };
      return { plushBlocked: !w.walkable(37, 6, {}),
        bed: !!w.findPath(from, w.adjacentTo({ contains: (x,y) => x === 31 && y >= 3 && y < 5 }), {}),
        pc: !!w.findPath(from, w.adjacentTo({ contains: (x,y) => x >= 36 && x < 38 && y === 3 }), {}),
        exit: !!w.findPath(from, (x,y) => x === 42 && y === 19, {}) };
    });
    assert(Object.values(roomPaths).every(Boolean), JSON.stringify(roomPaths));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250); await shot('bedroom-mobile');
    assert.deepEqual(errors, []);
    console.log('PASS: outside hides furniture; entrance/exit roof transitions; classroom/library assets; bedroom plush/collision/bed-PC-exit routes; desktop/mobile screenshots; pageerror 0');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

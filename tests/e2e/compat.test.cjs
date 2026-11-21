// SPDX-License-Identifier: GPL-2.0-or-later
// The browser check on the loading screen (js/compat.js), in a real page: nothing shown in a complete browser,
// a note when part of the game will not work, the game's place taken when it cannot run or did not start.
// The init scripts run in the page, where the browser's own classes are defined:
/* global HTMLCanvasElement, Document */
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const playwright = require('playwright');
const { ENGINE, contextOptions, launchOptions, onlyIn } = require('./helpers.cjs');
const { serve } = require('../server.cjs');

let open = [];
afterEach(async () => {
  for (const close of open.reverse()) await close();
  open = [];
});

/**
 * The game in a fresh page. `init` runs in the page before any of its scripts, to take something away;
 * `options.device` emulates a phone; `options.route` changes what the server sends.
 */
async function page(init, options = {}) {
  const server = await serve(0);
  open.push(() => server.close());
  const browser = await playwright[ENGINE].launch(launchOptions());
  open.push(() => browser.close());
  const context = await browser.newContext(contextOptions(options.device));
  const p = await context.newPage();
  if (init) await p.addInitScript(init);
  if (options.route) await p.route(options.route.url, options.route.handler);
  await p.goto(server.url);
  return p;
}
const box = (p) => p.locator('#compat');
const started = (p) => p.waitForFunction(() => window.sleazeburg, null, { timeout: 15000 });

test('a complete browser gets no note, and the game starts', async () => {
  const p = await page();
  await started(p);
  const result = await p.evaluate(() => {
    const r = window.sleazeburgCompat.result;
    return { fatal: r.fatal.length, warn: r.warn.map((i) => i.id) };
  });
  assert.deepEqual(result, { fatal: 0, warn: [] });
  assert.equal(await box(p).count(), 0);
});

test('without WebAssembly: a note about the music, OK puts it away for good, and the game runs', async () => {
  const p = await page(() => delete window.WebAssembly);
  await started(p);
  await box(p).waitFor();
  assert.equal(await box(p).getAttribute('role'), 'status');
  assert.match(await box(p).innerText(), /HEADS UP[\s\S]*NO RADIO MUSIC/);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.sleazeburg.G.screen === 'title', null, { timeout: 8000 });
  await box(p).getByRole('button', { name: 'OK' }).click();
  assert.equal(await box(p).count(), 0);
  await p.reload();
  await started(p);
  await p.waitForTimeout(300);
  assert.equal(await box(p).count(), 0, 'not again once dismissed');
});

test('the note goes away by itself once the game is under way', async () => {
  const p = await page(() => delete window.WebAssembly);
  await started(p);
  await box(p).waitFor();
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.sleazeburg.G.screen === 'title', null, { timeout: 8000 });
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.sleazeburg.G.screen === 'play', null, { timeout: 8000 });
  await box(p).waitFor({ state: 'detached', timeout: 3000 });
});

test('a browser that cannot draw gets an error in place of the game, saying what it needs', async () => {
  const p = await page(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await box(p).waitFor();
  assert.equal(await box(p).getAttribute('role'), 'alert');
  const text = await box(p).innerText();
  assert.match(text, /\?BROWSER ERROR/);
  assert.match(text, /can't run in this browser/);
  assert.match(text, /drawing on a canvas/);
  assert.match(text, /current Firefox, Chrome, Edge or Safari/);
  // It covers the whole window.
  const r = await box(p).boundingBox();
  assert.deepEqual([r.x, r.y, r.width, r.height], [0, 0, 960, 680]);
});

test('a game that does not start says so, with what went wrong, and offers a reload', async () => {
  const p = await page(null, {
    route: {
      url: '**/js/main.js',
      handler: (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const broken = ;' }),
    },
  });
  await box(p).waitFor({ timeout: 10000 });
  const text = await box(p).innerText();
  assert.match(text, /did not start in this browser/);
  assert.match(text, /SyntaxError|Unexpected token/i);
  assert.equal(await box(p).getByRole('button', { name: 'RELOAD' }).count(), 1);
});

test(
  'a phone that cannot go full screen gets a note about it; a complete one gets none',
  {
    skip: onlyIn(
      ['chromium', 'webkit'],
      'it needs a phone emulated, with a touch screen as its only pointer',
    ),
  },
  async () => {
    const phone = 'Pixel 7';
    const p = await page(
      () => {
        Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
      },
      { device: phone },
    );
    await started(p);
    await box(p).waitFor();
    assert.match(await box(p).innerText(), /NO FULL SCREEN/);
    // Above the turn-your-phone sign, so it can be read and put away.
    await box(p).getByRole('button', { name: 'OK' }).click();
    assert.equal(await box(p).count(), 0);
    const q = await page(null, { device: phone });
    await started(q);
    assert.deepEqual(await q.evaluate(() => window.sleazeburgCompat.result.warn.map((i) => i.id)), []);
  },
);

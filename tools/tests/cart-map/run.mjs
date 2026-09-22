import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, webkit } from 'playwright';

const root = process.cwd();
const fixture = path.join(root, 'tools/tests/cart-map');
const server = await createServer({
  configFile: false, root, logLevel: 'error',
  optimizeDeps: { entries: ['tools/tests/cart-map/index.html'] },
  resolve: { alias: [
    { find: '@tanstack/react-router', replacement: path.join(fixture, 'router.tsx') },
    ...['supabase', 'deliveryLocation', 'order'].map(name => ({ find: `@/lib/${name}`, replacement: path.join(fixture, 'backend.ts') })),
    { find: '@', replacement: path.join(root, 'src') },
  ] },
  define: { 'import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY': JSON.stringify('test-key'), 'import.meta.env.VITE_GOOGLE_MAPS_MAP_ID': JSON.stringify('test-map') },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const address = server.httpServer.address();
const base = `http://127.0.0.1:${address.port}/tools/tests/cart-map/`;
const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(process.env.TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.TEST_BROWSER_EXECUTABLE } : {}) });
const sdk = await readFile(path.join(fixture, 'maps.js'), 'utf8');
let passed = 0;
async function scenario(name, query, test, scriptDelay = 0) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(sdk);
  await page.route('https://maps.googleapis.com/**', async route => {
    await new Promise(resolve => setTimeout(resolve, scriptDelay));
    await route.fulfill({ contentType: 'application/javascript', body: 'window.installMaps();' }).catch(() => {});
  });
  // No production reads or writes are permitted in this harness.
  await page.route(/https:\/\/(?!maps\.googleapis\.com)/, route => route.abort());
  const stats = () => page.evaluate(() => ({ maps: mapStats.maps.length, attached: mapStats.markers.filter(m => m.map).length, listeners: mapStats.listeners.size, detached: mapStats.detached, zeroSize: mapStats.zeroSize, lateChecks: mapStats.lateChecks, connected: mapStats.maps.every(m => m.element.isConnected), quotes: testState.quotes, orders: testState.orders.length }));
  try {
    await page.goto(base + query);
    await page.getByText('ตะกร้าของฉัน', { exact: true }).waitFor();
    await test(page, stats);
    await page.locator('#leave').click();
    await page.waitForTimeout(350);
    const final = await stats();
    assert.equal(final.attached, 0, `${name}: retained markers`);
    assert.equal(final.listeners, 0, `${name}: retained app listeners`);
    assert.equal(final.detached, 0, `${name}: SDK callback saw detached DOM`);
    assert.equal(final.zeroSize, 0, `${name}: initialized/fitted a zero-size map`);
    assert.equal(final.connected, true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${name}`);
    passed++;
  } finally { await page.close(); }
}
const mapReady = page => page.waitForFunction(() => mapStats.maps.length === 1 && mapStats.listeners.size >= 2);
try {
  await scenario('pickup-only, delayed shop: no map or delivery quote', '?pickup&shopDelay=350', async (page, stats) => {
    assert.equal((await stats()).maps, 0);
    await page.getByRole('button', { name: 'รับเอง', exact: true }).waitFor();
    await page.waitForTimeout(150);
    assert.equal((await stats()).maps, 0);
    assert.equal((await stats()).quotes, 0);
  });
  await scenario('shop failure and retry, no speculative map', '?fail', async (page, stats) => {
    await page.getByRole('button', { name: 'ลองใหม่', exact: true }).waitFor();
    assert.equal((await stats()).maps, 0);
    await page.evaluate(() => { testState.failed = false; });
    await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
    await mapReady(page);
  });
  await scenario('confirm/change and delivery/pickup preserve one map', '', async (page, stats) => {
    await mapReady(page);
    assert.equal((await stats()).quotes, 0);
    await page.evaluate(() => clickMap());
    await page.getByRole('button', { name: 'ยืนยันจุดส่งนี้', exact: true }).click();
    await page.getByRole('button', { name: 'เปลี่ยนจุดส่ง', exact: true }).click();
    await mapReady(page);
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'รับเอง', exact: true }).click();
      await page.waitForFunction(() => mapStats.listeners.size === 0);
      await page.getByRole('button', { name: 'ส่งถึงบ้าน', exact: true }).click();
      await mapReady(page);
    }
    assert.equal((await stats()).maps, 1);
  });
  await scenario('saved destination hides picker during slow Maps load', '?saved', async (page, stats) => {
    await page.getByRole('button', { name: 'ใช้ที่อยู่นี้', exact: true }).click();
    await page.waitForTimeout(600);
    assert.equal((await stats()).maps, 0);
    await page.getByRole('button', { name: 'เปลี่ยนจุดส่ง', exact: true }).click();
    await mapReady(page);
  }, 450);
  await scenario('leave while Maps script is loading, then return', '', async (page, stats) => {
    await page.waitForFunction(() => document.querySelector('script[data-mytree-google-maps]'));
    await page.locator('#leave').click();
    await page.waitForTimeout(600);
    assert.equal((await stats()).maps, 0);
    await page.locator('#enter').click();
    await mapReady(page);
  }, 450);
  await scenario('route remount, empty cart, pending SDK callbacks', '', async (page, stats) => {
    await mapReady(page);
    await page.evaluate(() => clickMap());
    await page.waitForFunction(() => mapStats.markers.some(m => m.draggable && m.map));
    await page.locator('#leave').click();
    await page.locator('#enter').click();
    await mapReady(page);
    await page.locator('#clear').click();
    await page.getByText('ตะกร้าว่าง', { exact: false }).waitFor();
    await page.waitForFunction(() => mapStats.listeners.size === 0);
    await page.locator('#enter').click();
    await mapReady(page);
    assert.equal((await stats()).maps, 1);
  });
  await scenario('last order completion safely releases map', '?saved', async (page, stats) => {
    await mapReady(page);
    await page.getByRole('button', { name: 'ใช้ที่อยู่นี้', exact: true }).click();
    await page.getByRole('button', { name: 'ชำระเงินร้านนี้', exact: true }).click();
    await page.getByText('ส่งคำสั่งซื้อครบทุกร้านแล้ว', { exact: true }).waitFor();
    assert.equal((await stats()).orders, 1);
  });
  console.log(`${passed} cart map regression scenarios passed (${process.env.TEST_BROWSER || 'chromium'}, 390x844, StrictMode, mocked SDK/backend).`);
} finally { await browser.close(); await server.close(); }

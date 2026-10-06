const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const routes = {};
vm.runInNewContext(compile(fs.readFileSync('src/lib/customerPublicRoutes.ts','utf8')), { exports: routes });

function authHarness(pathname, search = '') {
  const calls = [];
  const exports = {};
  const liff = { init: async () => { calls.push('init'); }, isLoggedIn: () => false, login: () => calls.push('login') };
  const source = fs.readFileSync('src/lib/supabase.ts','utf8').replaceAll('import.meta.env', 'TEST_ENV');
  const location = { pathname, search, origin: 'https://mytree.cc', hostname: 'mytree.cc', href: 'https://mytree.cc'+pathname+search };
  vm.runInNewContext(compile(source), { exports, URL, URLSearchParams, Date, TEST_ENV: {}, window: {location}, require(name) {
    if (name === '@supabase/supabase-js') return {createClient: () => ({storage: {from() { return {}; }}})};
    if (name === '@line/liff') return {default: liff};
    if (name.endsWith('/customerPublicRoutes')) return routes;
    if (name.endsWith('/previewDebugRoute')) return {isPreviewCheckoutMapAuthBypassActive: () => false};
    if (name.endsWith('/customerLiffState')) return {buildCanonicalMyTreeUrl: () => location.href};
    return {};
  }});
  return {exports,calls};
}

test('eager token lookup stays anonymous on all public discovery routes', async () => {
  for (const path of ['/', '/hub', '/hub/', '/map', '/shop/example', '/shop/example/']) {
    const h=authHarness(path);
    assert.equal(await h.exports.getAccessToken(), '', path);
    assert.equal(h.calls.length, 0, path);
  }
});

test('Cart, Orders and Account still request Customer login', async () => {
  for (const path of ['/cart','/orders','/account','/shop/orders']) {
    const h=authHarness(path);
    await h.exports.getAccessToken();
    assert.equal(h.calls.join(','), 'init,login', path);
  }
});

test('Admin deep links retain fail-closed Admin auth without Customer login', async () => {
  for (const [path,search] of [['/head-office/map',''],['/','?liff.state=%2Fhead-office%2Fmap']]) {
    const h=authHarness(path,search);
    await assert.rejects(h.exports.getAccessToken(), /platform_admin_line_session_stale/);
    assert.equal(h.calls.join(','), 'init');
  }
});

test('explicit LIFF bootstrap on Home still runs for customer deep links', async () => {
  const h=authHarness('/', '?liff.state=%2Forders');
  await h.exports.initLiff();
  assert.equal(h.calls.join(','), 'init');
});

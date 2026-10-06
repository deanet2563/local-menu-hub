const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

// Exercise the hook's real async loader with a fake transport; no live customer data.
function catalogHarness(responses) {
  const values = [];
  const queries = [];
  let index = 0;
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in values)) values[slot] = initial;
      return [values[slot], value => { values[slot] = value; }];
    },
    useRef: value => ({ current: value }),
    useEffect() {},
    useMemo: compute => compute(),
  };
  const client = {
    from(table) {
      const query = { table, operations: [] };
      queries.push(query);
      const chain = {};
      for (const method of ['select', 'eq', 'is', 'or', 'order', 'limit']) {
        chain[method] = (...args) => { query.operations.push([method, ...args]); return chain; };
      }
      chain.then = (resolve, reject) => Promise.resolve(typeof responses[table] === 'function' ? responses[table](query) : responses[table] ?? { data: [], error: null }).then(resolve, reject);
      return chain;
    },
    rpc: async () => responses.nearby ?? { data: [], error: null },
  };
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync('src/hooks/useCustomerCatalog.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, console, Date, Map, Set,
    require(name) {
      if (name === 'react') return react;
      if (name === '@/lib/supabase') return { publicSupabase: client };
      if (name === '@/lib/geolocation') return { getCurrentLocation: async () => ({ lat: 13, lng: 100 }) };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { queries, render: (options) => { index = 0; return exports.useCustomerCatalog(options); } };
}
const shops = [
  { shop_id: 'open', name: 'Open shop', is_open: true },
  { shop_id: 'closed', name: 'Closed shop', is_open: false },
];

test('Home keeps closed approved shops discoverable and restricts orderable menu reads', async () => {
  const h = catalogHarness({ shops: { data: shops } });
  await h.render().reloadCatalog();
  const view = h.render();
  assert.equal(view.allOrderedShops.length, 2);
  assert.equal(view.shops.length, 1);
  const q = h.queries.find(q => q.table === 'menu_items');
  for (const pair of [['is_available', true], ['shops.is_open', true], ['shops.is_approved', true], ['shops.is_banned', false]]) {
    assert.ok(q.operations.some(op => op[0] === 'eq' && op[1] === pair[0] && op[2] === pair[1]));
  }
});

test('promotions use merchant-managed active date-bounded source, never demo fallback', async () => {
  const h = catalogHarness({ shop_promotions: { data: [{ promotion_id: 'p', shop_id: 'closed', title: ' Real offer ', created_at: '2026-10-06', shops: shops[1] }] } });
  await h.render().reloadCatalog();
  assert.equal(h.render().promotions[0].special_text, 'Real offer');
  const q = h.queries.find(q => q.table === 'shop_promotions');
  assert.ok(q.operations.some(op => op[0] === 'eq' && op[1] === 'is_active' && op[2] === true));
  assert.ok(q.operations.some(op => op[0] === 'or' && op[1].startsWith('starts_at.is.null,starts_at.lte.')));
  assert.ok(q.operations.some(op => op[0] === 'or' && op[1].startsWith('ends_at.is.null,ends_at.gt.')));
  assert.ok(!h.queries.some(q => q.table === 'daily_specials'));
});

test('missing optional promotions and keywords leave catalog usable; required query failure does not', async () => {
  const h = catalogHarness({ shops: { data: shops }, shop_promotions: { error: { message: 'missing table' } }, listing_keywords: { error: { message: 'unavailable' } } });
  await h.render().reloadCatalog();
  assert.equal(h.render().catalogState, 'ready');
  assert.equal(h.render().promotions.length, 0);
  assert.equal(h.render().shopKeywords('open'), '');
  const failed = catalogHarness({ shops: { error: { message: 'offline' } } });
  await failed.render().reloadCatalog();
  assert.equal(failed.render().catalogState, 'error');
});

test('unknown or negative distance never appears as zero kilometres', async () => {
  const h = catalogHarness({ shops: { data: shops }, nearby: { data: [{ shop_id: 'open', distance_km: null }, { shop_id: 'closed', distance_km: -1 }] } });
  await h.render().reloadCatalog();
  await h.render().refreshNearbyShops();
  assert.ok(h.render().allOrderedShops.every(shop => shop.distance_km === null));
});

test('full Hub catalog is opt-in and preserves closed/unavailable states', async () => {
  const row = { item_id: 'closed-item', shop_id: 'closed', name: 'Unavailable', category: ' Snacks ', is_available: false, shops: { is_open: false } };
  const h = catalogHarness({ shops: { data: shops }, menu_items: { data: [row] } });
  await h.render().reloadCatalog();
  assert.equal(h.queries.filter(q => q.table === 'menu_items').length, 1);
  assert.equal(h.render().hubItems.length, 0);
  await h.render({ includeHubItems: true }).reloadCatalog();
  const view = h.render({ includeHubItems: true });
  assert.equal(view.hubItems.length, 1);
  assert.equal(view.hubItems[0].is_available, false);
  assert.equal(view.hubItems[0].shop_is_open, false);
  const full = h.queries.filter(q => q.table === 'menu_items').at(-1);
  assert.ok(!full.operations.some(op => op[0] === 'eq' && ['is_available', 'shops.is_open'].includes(op[1])));
  assert.ok(full.operations.some(op => op[0] === 'eq' && op[1] === 'shops.is_approved' && op[2] === true));
  assert.ok(full.operations.some(op => op[0] === 'eq' && op[1] === 'shops.is_banned' && op[2] === false));
});

test('Hub enrichment failure falls back to the successful available-menu query', async () => {
  const h = catalogHarness({ shops: { data: shops }, menu_items: q =>
    q.operations.some(op => op[0] === 'select' && op[1].includes('category,is_available'))
      ? { error: { message: 'enrichment unavailable' } }
      : { data: [{ item_id: 'available', shop_id: 'open', name: 'Available' }] }
  });
  await h.render({ includeHubItems: true }).reloadCatalog();
  const view = h.render({ includeHubItems: true });
  assert.equal(view.catalogState, 'ready');
  assert.equal(view.hubItems[0].item_id, 'available');
  assert.equal(view.hubItems[0].shop_is_open, true);
  assert.equal(view.hubItems[0].is_available, true);
});

test('closed Shop page disables add and refuses stale configurator confirmation', () => {
  const React = require('react');
  const exports = {};
  let index = 0;
  const shop = { shop_id: 'closed', name: 'Closed shop', is_open: false, is_approved: true, is_banned: false };
  const item = { item_id: 'item', shop_id: 'closed', name: 'Item', category: 'Food', price: 25 };
  const state = [shop, [item], false, item, 1, 1];
  let additions = 0;
  const configurator = () => null;
  const compiled = ts.transpileModule(fs.readFileSync('src/components/customer/ShopPage.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return { ...React, useEffect() {}, useState: () => [state[index++], () => {}] };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '@tanstack/react-router') return { Link: () => null };
      if (name === '@/lib/supabase') return {};
      if (name === '@/lib/cart') return { cart: { add: () => { additions++; return 'ok'; } }, useCart: () => ({ shopId: null, items: [] }), cartCount: () => 0 };
      if (name.endsWith('/ProductConfigurator')) return { ProductConfigurator: configurator };
      throw new Error(name);
    },
  });
  const nodes = [];
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== 'object') return;
    nodes.push(node);
    walk(node.props?.children);
  }
  walk(exports.ShopPage({ shopId: 'closed' }));
  const add = nodes.find(node => node.type === 'button' && node.props.children === 'ร้านปิด');
  assert.equal(add.props.disabled, true);
  nodes.find(node => node.type === configurator).props.onConfirm({ product: { itemId: 'item', shopId: 'closed' }, qty: 1 });
  assert.equal(additions, 0);
});

 test('Hub excludes archived rows while retaining temporarily unavailable items', async () => {
  const rows = [
    { item_id: 'paused', archived_at: null, is_available: false, shops: { is_open: true } },
    { item_id: 'removed', archived_at: '2026-10-01', is_available: false, shops: { is_open: true } },
  ];
  const h = catalogHarness({ menu_items: q => ({ data: rows.filter(row =>
    !q.operations.some(op => op[0] === 'is' && op[1] === 'archived_at' && op[2] === null) || row.archived_at === null
  ) }) });
  await h.render({ includeHubItems: true }).reloadCatalog();
  const items = h.render({ includeHubItems: true }).hubItems;
  assert.equal(items.length, 1);
  assert.equal(items[0].item_id, 'paused');
  assert.equal(items[0].is_available, false);
});

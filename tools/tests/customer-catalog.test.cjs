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
      for (const method of ['select', 'eq', 'or', 'order', 'limit']) {
        chain[method] = (...args) => { query.operations.push([method, ...args]); return chain; };
      }
      chain.then = (resolve, reject) => Promise.resolve(responses[table] ?? { data: [], error: null }).then(resolve, reject);
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

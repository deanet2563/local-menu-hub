const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DASHBOARD_ORDER_SELECT,
  DETAIL_ORDER_SELECT,
  LEGACY_DETAIL_ORDER_SELECT,
} = require('./shopOrderSelects');

test('dashboard order select avoids detail-only delivery pricing fields', () => {
  assert.match(DASHBOARD_ORDER_SELECT, /sub_id/);
  assert.match(DASHBOARD_ORDER_SELECT, /hub_orders\(customers\(name\)\)/);
  assert.doesNotMatch(DASHBOARD_ORDER_SELECT, /customer_delivery_charge/);
  assert.doesNotMatch(DASHBOARD_ORDER_SELECT, /order_items\(/);
});

test('detail order select keeps full order data including customer delivery charge', () => {
  assert.match(DETAIL_ORDER_SELECT, /customer_delivery_charge/);
  assert.match(DETAIL_ORDER_SELECT, /order_items\(item_name_snapshot,qty,line_total\)/);
  assert.match(DETAIL_ORDER_SELECT, /hub_orders\(customers\(name,phone\)\)/);
});

test('legacy detail fallback removes only the currently missing live column', () => {
  assert.doesNotMatch(LEGACY_DETAIL_ORDER_SELECT, /customer_delivery_charge/);
  assert.match(LEGACY_DETAIL_ORDER_SELECT, /delivery_fee_payer/);
  assert.match(LEGACY_DETAIL_ORDER_SELECT, /order_items\(item_name_snapshot,qty,line_total\)/);
});

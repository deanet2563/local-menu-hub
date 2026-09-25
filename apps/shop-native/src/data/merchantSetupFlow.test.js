import assert from 'node:assert/strict';
import test from 'node:test';

import { isCustomerDeliveryPricingSchemaMissing, migrationRequiredShopDeliverySettings } from './shopDeliverySettingsCompat.js';
import { activeCustomizeGroupsForCategory, parseCustomizeOptionLabels } from './shopMenuConfigHelpers.js';
import { formatSupabaseError, isMissingTableError } from './supabaseError.js';

test('formats exact Supabase/PostgREST error fields for development diagnostics', () => {
  const message = formatSupabaseError({
    code: 'PGRST205',
    message: "Could not find the table 'public.shop_menu_categories' in the schema cache",
    details: null,
    hint: "Perhaps you meant the table 'public.shop_push_devices'",
  }, 'โหลดหมวดหมู่ไม่สำเร็จ');

  assert.match(message, /code=PGRST205/);
  assert.match(message, /public\.shop_menu_categories/);
  assert.match(message, /shop_push_devices/);
});

test('detects missing setup tables without treating them as empty data', () => {
  assert.equal(isMissingTableError({
    code: 'PGRST205',
    message: "Could not find the table 'public.shop_customize_groups' in the schema cache",
  }, 'shop_customize_groups'), true);
});

test('comma customize option input trims blanks and rejects duplicates', () => {
  assert.deepEqual(parseCustomizeOptionLabels('หวานมาก, หวานกลาง, หวานน้อย'), ['หวานมาก', 'หวานกลาง', 'หวานน้อย']);
  assert.throws(() => parseCustomizeOptionLabels('หวานมาก, , หวานมาก'), /ซ้ำ/);
  assert.throws(() => parseCustomizeOptionLabels(' , '), /อย่างน้อย 1/);
});

test('menu customize selection only exposes active groups for the selected category id', () => {
  const groups = [
    { group_id: 'sweet', category_id: 'drink', is_active: true },
    { group_id: 'ice', category_id: 'drink', is_active: true },
    { group_id: 'spicy', category_id: 'food', is_active: true },
    { group_id: 'hidden', category_id: 'drink', is_active: false },
  ];

  assert.deepEqual(activeCustomizeGroupsForCategory(groups, 'drink').map((group) => group.group_id), ['sweet', 'ice']);
  assert.deepEqual(activeCustomizeGroupsForCategory(groups, null), []);
});

test('delivery settings marks missing customer-pricing columns as migration-required', () => {
  assert.equal(isCustomerDeliveryPricingSchemaMissing({
    code: '42703',
    message: 'column shops.customer_delivery_pricing_mode does not exist',
  }), true);

  assert.deepEqual(migrationRequiredShopDeliverySettings('shop-1', {
    pickup_enabled: true,
    delivery_enabled: true,
    service_area_note: 'ในหมู่บ้าน',
  }), {
    shop_id: 'shop-1',
    pickup_enabled: true,
    delivery_enabled: true,
    service_area_note: 'ในหมู่บ้าน',
    delivery_pricing_mode: 'distance',
    delivery_flat_fee: 0,
    free_delivery_min_order: null,
    rider_request_enabled: false,
    migration_required: true,
  });
});

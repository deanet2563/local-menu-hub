const test = require('node:test');
const assert = require('node:assert/strict');
const {
  THAI_TEXT,
  getDashboardContentBottomPadding,
  getNonCriticalDashboardMessage,
  getShopStatusCopy,
} = require('./dashboardState');

test('orders failure is a non-critical dashboard message, not a shop profile error', () => {
  assert.equal(getNonCriticalDashboardMessage('orders'), THAI_TEXT.ordersLoadFailed);
});

test('open shop state shows current state and close action', () => {
  assert.deepEqual(getShopStatusCopy(true), {
    state: 'ขณะนี้ร้านกำลังเปิดอยู่',
    stateIcon: '🟢',
    action: 'ปิดร้านชั่วคราว',
    success: 'ปิดร้านเรียบร้อยแล้ว',
  });
});

test('closed shop state shows current state and open action', () => {
  assert.deepEqual(getShopStatusCopy(false), {
    state: 'ขณะนี้ร้านปิดอยู่',
    stateIcon: '🔴',
    action: 'เปิดร้าน',
    success: 'เปิดร้านเรียบร้อยแล้ว',
  });
});

test('dashboard bottom padding includes Android safe-area inset without hard-coded device margin', () => {
  assert.equal(getDashboardContentBottomPadding(0), 40);
  assert.equal(getDashboardContentBottomPadding(24), 64);
});

const THAI_TEXT = {
  ordersLoadFailed: 'ยังโหลดข้อมูลออเดอร์ไม่ได้ ลองใหม่อีกครั้ง',
  shopOpening: 'ขณะนี้ร้านกำลังเปิดอยู่',
  shopClosed: 'ขณะนี้ร้านปิดอยู่',
  openShopAction: 'เปิดร้าน',
  closeShopAction: 'ปิดร้านชั่วคราว',
  shopOpened: 'เปิดร้านเรียบร้อยแล้ว',
  shopClosedDone: 'ปิดร้านเรียบร้อยแล้ว',
};

function getShopStatusCopy(isOpen) {
  return isOpen
    ? {
      state: THAI_TEXT.shopOpening,
      stateIcon: '🟢',
      action: THAI_TEXT.closeShopAction,
      success: THAI_TEXT.shopClosedDone,
    }
    : {
      state: THAI_TEXT.shopClosed,
      stateIcon: '🔴',
      action: THAI_TEXT.openShopAction,
      success: THAI_TEXT.shopOpened,
    };
}

function getNonCriticalDashboardMessage(source) {
  if (source === 'orders') return THAI_TEXT.ordersLoadFailed;
  return null;
}

function getDashboardContentBottomPadding(bottomInset) {
  return Math.max(40, bottomInset + 40);
}

module.exports = {
  THAI_TEXT,
  getDashboardContentBottomPadding,
  getNonCriticalDashboardMessage,
  getShopStatusCopy,
};

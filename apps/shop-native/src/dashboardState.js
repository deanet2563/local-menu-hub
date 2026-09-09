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

function getSalesTreeStage(todaySales) {
  const sales = Math.max(0, Number(todaySales) || 0);
  if (sales >= 100000) {
    return { key: 'full', label: 'ต้นไม้สมบูรณ์เต็มต้น', icon: '🌳', progress: 1 };
  }
  if (sales >= 10000) {
    return { key: 'flowering', label: 'ต้นไม้มีดอกเยอะ', icon: '🌸', progress: 0.82 };
  }
  if (sales >= 1000) {
    return { key: 'branching', label: 'ต้นไม้เริ่มมีกิ่ง', icon: '🌿', progress: 0.62 };
  }
  if (sales >= 100) {
    return { key: 'young', label: 'ต้นอ่อน', icon: '♧', progress: 0.4 };
  }
  if (sales >= 1) {
    return { key: 'sprout', label: 'ต้นกล้า', icon: '♧', progress: 0.2 };
  }
  return { key: 'seed', label: 'เมล็ดกำลังรอโต', icon: '●', progress: 0 };
}

module.exports = {
  THAI_TEXT,
  getDashboardContentBottomPadding,
  getNonCriticalDashboardMessage,
  getSalesTreeStage,
  getShopStatusCopy,
};

// ============================================================
// MyTree — Shared GPS capture helper
//
// ใช้ browser geolocation ตรงๆ (ไม่ใช่ LIFF API พิเศษ) — LIFF webview
// เป็นแค่ embedded browser ปกติ navigator.geolocation ใช้ได้เลย
// ============================================================

export type GpsResult = { lat: number; lng: number };

export function getCurrentLocation(): Promise<GpsResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("เบราว์เซอร์นี้ไม่รองรับการขอตำแหน่ง"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        const message =
          err.code === 1
            ? "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — กรุณาเปิดสิทธิ์ตำแหน่งในมือถือ/เบราว์เซอร์"
            : "ไม่สามารถระบุตำแหน่งได้ ลองอีกครั้งในที่โล่งหรือใกล้หน้าต่าง";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

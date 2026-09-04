import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { exchangeLineIdToken } from '../src/auth/broker';
import { loginWithLineNative } from '../src/native/lineLogin';
import { getAccessToken, logoutShopSession } from '../src/lib/tokenStore';
import { loadShopOrders } from '../src/data/shopOrders';
import { getOwnedShopProfile, setShopOpen, type OwnedShopProfile } from '../src/data/shopProfile';
import { registerShopPushDevice } from '../src/data/pushDeviceRepository';
import { ensureShopPushReadiness, installShopNotificationResponseHandler } from '../src/services/notifications';
import { toOrderSummary, type ShopOrderSummary } from '../src/domain/orders';
import {
  getDashboardContentBottomPadding,
  getNonCriticalDashboardMessage,
  getShopStatusCopy,
} from '../src/dashboardState';

const POLL_MS = 15_000;

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function money(value: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value || 0);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'ออเดอร์ใหม่',
    confirmed: 'รับออเดอร์แล้ว',
    preparing: 'กำลังทำ',
    completed: 'เสร็จแล้ว',
    cancelled: 'ยกเลิก',
  };
  return map[status] ?? status;
}

export default function ShopHomeScreen() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<ShopOrderSummary[]>([]);
  const [shop, setShop] = useState<OwnedShopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [changingOpen, setChangingOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboardDataError, setDashboardDataError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setDashboardDataError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setSignedIn(false);
        setShop(null);
        setOrders([]);
        return;
      }
      setSignedIn(true);
      const owned = await getOwnedShopProfile();
      setShop(owned);
      if (!owned) {
        setOrders([]);
        return;
      }
      try {
        const rows = await loadShopOrders(owned.shop_id);
        setOrders(rows.map(toOrderSummary));
      } catch (cause) {
        if (__DEV__) console.warn('Shop dashboard orders load failed', cause);
        setDashboardDataError(getNonCriticalDashboardMessage('orders'));
      }
    } catch (cause) {
      if (__DEV__) console.warn('Shop dashboard profile load failed', cause);
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลร้านไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const signIn = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    setLoginError(null);
    try {
      const { idToken } = await loginWithLineNative();
      await exchangeLineIdToken(idToken);
      setLoading(true);
      await load();
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : 'เข้าสู่ระบบ LINE ไม่สำเร็จ');
    } finally {
      setSigningIn(false);
    }
  }, [load, signingIn]);

  const signOut = useCallback(() => {
    if (signingOut) return;
    Alert.alert('ออกจากระบบ', 'ต้องการออกจาก MyTree Shop บนอุปกรณ์นี้หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: () => void (async () => {
          setSigningOut(true);
          try {
            await logoutShopSession();
            setShop(null);
            setOrders([]);
            setSignedIn(false);
          } finally {
            setSigningOut(false);
          }
        })(),
      },
    ]);
  }, [signingOut]);

  const toggleShopOpen = useCallback(async () => {
    if (!shop || changingOpen) return;
    setChangingOpen(true);
    setError(null);
    setStatusMessage(null);
    try {
      const nextOpen = !shop.is_open;
      await setShopOpen(shop, nextOpen);
      setShop((current) => current?.shop_id === shop.shop_id ? { ...current, is_open: nextOpen } : current);
      setStatusMessage(getShopStatusCopy(shop.is_open).success);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เปลี่ยนสถานะร้านไม่สำเร็จ');
    } finally {
      setChangingOpen(false);
    }
  }, [shop, changingOpen, load]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    const subscription = installShopNotificationResponseHandler((subId) => router.push(`/orders/${subId}`));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!shop?.is_approved || shop.is_banned) return;
    let cancelled = false;
    void (async () => {
      try {
        const readiness = await ensureShopPushReadiness();
        if (cancelled) return;
        if (!readiness.ready || !readiness.token) {
          setPushMessage(readiness.reason);
          return;
        }
        await registerShopPushDevice(shop.shop_id, readiness.token);
        if (!cancelled) setPushMessage(null);
      } catch (cause) {
        if (!cancelled) setPushMessage(cause instanceof Error ? cause.message : 'ตั้งค่าแจ้งเตือนไม่สำเร็จ');
      }
    })();
    return () => { cancelled = true; };
  }, [shop?.shop_id, shop?.is_approved, shop?.is_banned]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const syncNow = () => { if (AppState.currentState === 'active') void load(); };
    const arm = () => {
      if (interval) clearInterval(interval);
      interval = AppState.currentState === 'active' ? setInterval(syncNow, POLL_MS) : null;
    };
    arm();
    const subscription = AppState.addEventListener('change', () => { syncNow(); arm(); });
    return () => { subscription.remove(); if (interval) clearInterval(interval); };
  }, [load]);

  const todayOrders = useMemo(() => orders.filter((o) => isToday(o.createdAt)), [orders]);
  const todaySales = useMemo(() => todayOrders.reduce((sum, o) => sum + o.amount, 0), [todayOrders]);
  const waitingToMake = useMemo(() => orders.filter((o) => ['pending', 'confirmed', 'preparing'].includes(o.status)).length, [orders]);

  const refresh = () => { setRefreshing(true); void load(); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F8A5F" /><Text style={styles.muted}>กำลังเปิด MyTree Shop…</Text></View>;

  if (signedIn === false) {
    return <View style={styles.centerPad}>
      <Text style={styles.brand}>MYTREE SHOP</Text>
      <Text style={styles.loginTitle}>จัดการร้านของคุณได้ในที่เดียว</Text>
      <Text style={styles.muted}>ออเดอร์ เมนู การส่ง ลูกค้า และการแจ้งเตือน</Text>
      <Pressable disabled={signingIn} onPress={() => void signIn()} style={({ pressed }) => [styles.lineButton, pressed && styles.pressed]}>
        {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.lineButtonText}>เข้าสู่ระบบด้วย LINE</Text>}
      </Pressable>
      {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
    </View>;
  }

  if (!shop) {
    return <View style={styles.centerPad}>
      <Text style={styles.brand}>MYTREE SHOP</Text>
      <Text style={styles.loginTitle}>เริ่มต้นร้านของคุณ</Text>
      <Text style={styles.muted}>{error || 'บัญชีนี้ยังไม่มีร้านที่เป็นเจ้าของใน MyTree'}</Text>
      <Pressable onPress={() => router.push('/signup')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>ตั้งค่าร้าน / Onboarding</Text></Pressable>
      <Pressable onPress={refresh} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>ตรวจสอบอีกครั้ง</Text></Pressable>
      <Pressable disabled={signingOut} onPress={signOut} style={styles.signOutButton}><Text style={styles.signOutText}>ออกจากระบบ</Text></Pressable>
    </View>;
  }

  const shopStatus = getShopStatusCopy(shop.is_open);
  const contentBottomPadding = getDashboardContentBottomPadding(insets.bottom);
  const header = (
    <View>
      <View style={styles.header}>
        <View style={styles.shopIdentity}>
          {shop.logo_url ? <Image source={{ uri: shop.logo_url }} style={styles.logo} /> : <View style={styles.logoFallback}><Text style={styles.logoFallbackText}>🌳</Text></View>}
          <View style={styles.shopText}><Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text><Text style={[styles.shopState, !shop.is_open && styles.shopStateClosed]}>{shopStatus.stateIcon} {shopStatus.state}</Text></View>
        </View>
        <Pressable disabled={!shop.is_approved || shop.is_banned || changingOpen} onPress={() => void toggleShopOpen()} style={[styles.openToggle, shop.is_open && styles.openToggleOn]}>
          <Text style={[styles.openToggleText, shop.is_open && styles.openToggleTextOn]}>{changingOpen ? '...' : shopStatus.action}</Text>
        </Pressable>
      </View>

      {shop.is_banned ? <View style={styles.dangerBanner}><Text style={styles.dangerTitle}>ร้านถูกระงับ</Text><Text style={styles.bannerBody}>{shop.banned_reason || 'กรุณาติดต่อ MyTree Admin'}</Text></View> : null}
      {!shop.is_approved && !shop.is_banned ? <View style={styles.pendingBanner}><Text style={styles.pendingTitle}>กำลังรอ MyTree อนุมัติร้าน</Text><Text style={styles.bannerBody}>คุณสามารถเตรียมข้อมูลร้านและเมนูไว้ก่อนได้</Text></View> : null}
      {pushMessage ? <View style={styles.infoBanner}><Text style={styles.infoText}>🔔 {pushMessage}</Text></View> : null}
      {statusMessage ? <View style={styles.successBanner}><Text style={styles.successText}>✓ {statusMessage}</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {dashboardDataError ? <View style={styles.warningBanner}><Text style={styles.warningText}>{dashboardDataError}</Text><Pressable onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>ลองใหม่</Text></Pressable></View> : null}

      <View style={styles.sectionHeader}><Text style={styles.sectionEyebrow}>DASHBOARD</Text><Text style={styles.sectionTitle}>ภาพรวมวันนี้</Text></View>
      <View style={styles.metricGrid}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>ออเดอร์วันนี้</Text><Text style={styles.metricValue}>{todayOrders.length}</Text><Text style={styles.metricFoot}>รายการ</Text></View>
        <View style={[styles.metricCard, styles.metricDark]}><Text style={styles.metricLabelDark}>ยอดขายวันนี้</Text><Text style={styles.metricValueDark}>฿{money(todaySales)}</Text><Text style={styles.metricFootDark}>ยอดจากออเดอร์วันนี้</Text></View>
        <View style={[styles.metricCard, styles.metricWarm]}><Text style={styles.metricLabelWarm}>รอทำ</Text><Text style={styles.metricValueWarm}>{waitingToMake}</Text><Text style={styles.metricFootWarm}>ต้องดำเนินการ</Text></View>
        <View style={[styles.metricCard, styles.metricBlue]}><Text style={styles.metricLabelBlue}>รอ Rider</Text><Text style={styles.metricValueBlue}>—</Text><Text style={styles.metricFootBlue}>เชื่อมสถานะในขั้นถัดไป</Text></View>
      </View>

      <Text style={styles.sectionTitleSmall}>จัดการร้าน</Text>
      <View style={styles.actionGrid}>
        <Pressable onPress={() => router.push('/orders')} style={styles.actionCard}><Text style={styles.actionIcon}>📦</Text><Text style={styles.actionText}>ออเดอร์</Text></Pressable>
        <Pressable onPress={() => Alert.alert('กำลังสร้าง', 'หน้าจัดการเมนูจะเป็นหน้าถัดไปที่เชื่อมจาก Dashboard นี้')} style={styles.actionCard}><Text style={styles.actionIcon}>🍜</Text><Text style={styles.actionText}>เมนู</Text></Pressable>
        <Pressable onPress={() => Alert.alert('กำลังสร้าง', 'หน้าตั้งค่าร้าน / Onboarding จะรวม Logo, Cover, QR, Social, Location และเวลาเปิด-ปิด')} style={styles.actionCard}><Text style={styles.actionIcon}>🏪</Text><Text style={styles.actionText}>ร้านของฉัน</Text></Pressable>
        <Pressable onPress={() => Alert.alert('กำลังสร้าง', 'หน้าตั้งค่าการส่งจะมี รับที่ร้าน / ร้านส่งเอง / Rider')} style={styles.actionCard}><Text style={styles.actionIcon}>🛵</Text><Text style={styles.actionText}>การส่ง</Text></Pressable>
      </View>

      <View style={styles.notificationCard}><View style={styles.notificationIcon}><Text style={{ fontSize: 18 }}>🔔</Text></View><View style={{ flex: 1 }}><Text style={styles.notificationTitle}>Notification Center</Text><Text style={styles.notificationBody}>ออเดอร์ใหม่ · สลิป · Rider · แชท · รีวิว · MyTree Admin</Text></View></View>
      <View style={styles.latestHeader}><Text style={styles.sectionTitleSmall}>ออเดอร์ล่าสุด</Text><Text style={styles.latestCount}>{orders.length} ออเดอร์</Text></View>
    </View>
  );

  return <View style={styles.page}>
    <FlatList
      data={orders.slice(0, 8)}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={header}
      contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
      ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>ยังไม่มีออเดอร์</Text><Text style={styles.muted}>ออเดอร์ใหม่จะปรากฏที่นี่อัตโนมัติ</Text></View>}
      renderItem={({ item }) => <Pressable onPress={() => router.push(`/orders/${item.id}`)} style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}>
        <View style={styles.orderTop}><Text style={styles.orderId}>#{item.shortId}</Text><Text style={styles.statusPill}>{statusLabel(item.status)}</Text></View>
        <Text style={styles.customer}>{item.customerName}</Text>
        <View style={styles.orderBottom}><Text style={styles.fulfillment}>{item.fulfillmentLabel}</Text><Text style={styles.amount}>฿{money(item.amount)}</Text></View>
      </Pressable>}
      ListFooterComponent={<Pressable disabled={signingOut} onPress={signOut} style={styles.signOutButton}><Text style={styles.signOutText}>{signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}</Text></Pressable>}
    />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F5F7F6' },
  centerPad: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F7F6' },
  brand: { color: '#0F8A5F', fontWeight: '900', fontSize: 12, letterSpacing: 1.8 },
  loginTitle: { marginTop: 8, color: '#12261E', fontSize: 30, lineHeight: 38, fontWeight: '900' },
  muted: { marginTop: 8, color: '#718078', fontSize: 14, lineHeight: 20 },
  lineButton: { marginTop: 24, minHeight: 54, borderRadius: 18, backgroundColor: '#06C755', alignItems: 'center', justifyContent: 'center' },
  lineButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  primaryButton: { marginTop: 24, minHeight: 54, borderRadius: 18, backgroundColor: '#12261E', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondaryButton: { marginTop: 10, minHeight: 50, borderRadius: 18, backgroundColor: '#E9EFEC', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#244438', fontWeight: '800' },
  list: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  shopIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E9EFEC' },
  logoFallback: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E9EFEC', alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { fontSize: 22 },
  shopText: { flex: 1, marginLeft: 12 },
  shopName: { color: '#12261E', fontWeight: '900', fontSize: 18 },
  shopState: { marginTop: 3, color: '#0F8A5F', fontSize: 12, fontWeight: '800' },
  shopStateClosed: { color: '#A13A36' },
  openToggle: { minWidth: 104, paddingHorizontal: 14, minHeight: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EFEC' },
  openToggleOn: { backgroundColor: '#0F8A5F' },
  openToggleText: { color: '#52645C', fontWeight: '900', fontSize: 13 },
  openToggleTextOn: { color: '#fff' },
  pendingBanner: { marginBottom: 12, borderRadius: 18, padding: 14, backgroundColor: '#FFF6DF', borderWidth: 1, borderColor: '#F1D58A' },
  pendingTitle: { color: '#785A10', fontWeight: '900', fontSize: 14 },
  dangerBanner: { marginBottom: 12, borderRadius: 18, padding: 14, backgroundColor: '#FFF0EE', borderWidth: 1, borderColor: '#F0B8B1' },
  dangerTitle: { color: '#9A3931', fontWeight: '900', fontSize: 14 },
  bannerBody: { marginTop: 4, color: '#6F706B', fontSize: 12, lineHeight: 18 },
  infoBanner: { marginBottom: 12, borderRadius: 16, padding: 12, backgroundColor: '#EEF4F1' },
  infoText: { color: '#496158', fontSize: 12, lineHeight: 18 },
  successBanner: { marginBottom: 12, borderRadius: 16, padding: 12, backgroundColor: '#E6F6EE', borderWidth: 1, borderColor: '#BEE8D1' },
  successText: { color: '#0F7653', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  warningBanner: { marginBottom: 12, borderRadius: 16, padding: 12, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#EFD7A7', flexDirection: 'row', alignItems: 'center', gap: 10 },
  warningText: { flex: 1, color: '#7A5A19', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  retryButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5C985' },
  retryText: { color: '#70500F', fontSize: 12, fontWeight: '900' },
  error: { marginTop: 12, color: '#A13A36', lineHeight: 20 },
  sectionHeader: { marginTop: 8, marginBottom: 12 },
  sectionEyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  sectionTitle: { marginTop: 4, color: '#12261E', fontSize: 24, fontWeight: '900' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricCard: { width: '48.5%', minHeight: 126, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E7ECE9' },
  metricDark: { backgroundColor: '#12261E', borderColor: '#12261E' },
  metricWarm: { backgroundColor: '#FFF6DF', borderColor: '#F4E3B5' },
  metricBlue: { backgroundColor: '#EAF5FA', borderColor: '#CDE7F2' },
  metricLabel: { color: '#718078', fontSize: 12, fontWeight: '700' },
  metricValue: { marginTop: 8, color: '#12261E', fontSize: 30, fontWeight: '900' },
  metricFoot: { marginTop: 3, color: '#93A099', fontSize: 11 },
  metricLabelDark: { color: '#C9D6D0', fontSize: 12, fontWeight: '700' },
  metricValueDark: { marginTop: 8, color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  metricFootDark: { marginTop: 3, color: '#9FB2AA', fontSize: 11 },
  metricLabelWarm: { color: '#8A681E', fontSize: 12, fontWeight: '800' },
  metricValueWarm: { marginTop: 8, color: '#6E500A', fontSize: 30, fontWeight: '900' },
  metricFootWarm: { marginTop: 3, color: '#9A7B39', fontSize: 11 },
  metricLabelBlue: { color: '#276B87', fontSize: 12, fontWeight: '800' },
  metricValueBlue: { marginTop: 8, color: '#184E65', fontSize: 30, fontWeight: '900' },
  metricFootBlue: { marginTop: 3, color: '#568096', fontSize: 11 },
  sectionTitleSmall: { marginTop: 12, marginBottom: 10, color: '#12261E', fontWeight: '900', fontSize: 17 },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  actionCard: { width: '23.5%', minHeight: 86, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7ECE9' },
  actionIcon: { fontSize: 24 },
  actionText: { marginTop: 5, color: '#31483F', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  notificationCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#E7ECE9' },
  notificationIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EAF7F2', alignItems: 'center', justifyContent: 'center' },
  notificationTitle: { color: '#12261E', fontWeight: '900', fontSize: 14 },
  notificationBody: { marginTop: 3, color: '#718078', fontSize: 11, lineHeight: 16 },
  latestHeader: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  latestCount: { color: '#819088', fontSize: 11 },
  orderCard: { marginBottom: 10, borderRadius: 20, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#E7ECE9' },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { color: '#0F8A5F', fontSize: 12, fontWeight: '900' },
  statusPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#EEF4F1', paddingHorizontal: 10, paddingVertical: 5, color: '#36584B', fontSize: 11, fontWeight: '800' },
  customer: { marginTop: 12, color: '#12261E', fontSize: 17, fontWeight: '900' },
  orderBottom: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fulfillment: { color: '#718078', fontSize: 12 },
  amount: { color: '#12261E', fontSize: 18, fontWeight: '900' },
  emptyCard: { borderRadius: 20, backgroundColor: '#fff', padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E7ECE9' },
  emptyTitle: { color: '#12261E', fontWeight: '900', fontSize: 16 },
  signOutButton: { marginTop: 18, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4F2', borderWidth: 1, borderColor: '#F0C2BC' },
  signOutText: { color: '#A13A36', fontWeight: '800' },
  pressed: { opacity: 0.72 },
});

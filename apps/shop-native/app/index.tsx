import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { exchangeLineIdToken } from '../src/auth/broker';
import { loginWithLineNative } from '../src/native/lineLogin';
import { getAccessToken } from '../src/lib/tokenStore';
import { loadShopOrders } from '../src/data/shopOrders';
import { getOwnedShopProfile, type OwnedShopProfile } from '../src/data/shopProfile';
import { toOrderSummary, type ShopOrderSummary } from '../src/domain/orders';

export default function ShopHomeScreen() {
  const [orders, setOrders] = useState<ShopOrderSummary[]>([]);
  const [shop, setShop] = useState<OwnedShopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
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
      const rows = await loadShopOrders(owned.shop_id);
      setOrders(rows.map(toOrderSummary));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดออเดอร์ไม่สำเร็จ');
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

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>กำลังเปิด MyTree Shop…</Text></View>;
  }

  if (signedIn === false) {
    return (
      <View style={styles.centerPad}>
        <Text style={styles.eyebrow}>MYTREE MERCHANT</Text>
        <Text style={styles.title}>MyTree Shop</Text>
        <Text style={styles.subtitle}>เข้าสู่ระบบด้วยบัญชี LINE เดิมที่ใช้กับ MyTree</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>บัญชีเดียวกับ LINE / LIFF</Text>
          <Text style={styles.body}>LINE SDK จะส่ง ID token ไปตรวจที่ MyTree Worker แล้วผูกกลับมายัง customer_id เดิมของร้าน ข้อมูลยังถูกควบคุมด้วย RLS ชุดเดิม</Text>
        </View>
        <Pressable
          disabled={signingIn}
          onPress={() => void signIn()}
          style={({ pressed }) => [styles.loginButton, signingIn && styles.disabled, pressed && styles.pressed]}
        >
          {signingIn ? <ActivityIndicator /> : <Text style={styles.loginText}>เข้าสู่ระบบด้วย LINE</Text>}
        </Pressable>
        {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={styles.centerPad}>
        <Text style={styles.eyebrow}>SHOP WORKSPACE</Text>
        <Text style={styles.title}>เริ่มต้นร้านของคุณ</Text>
        <Text style={styles.subtitle}>LINE บัญชีนี้เข้าสู่ระบบสำเร็จแล้ว แต่ยังไม่มีร้านที่เป็นเจ้าของใน MyTree</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>สมัครร้านผ่านแอปได้เลย</Text>
          <Text style={styles.body}>กรอกข้อมูลร้าน ส่งใบสมัคร แล้วรอแอดมินอนุมัติ เมื่ออนุมัติแล้ว Order Inbox จะใช้ร้านเดิมจาก customer_id นี้อัตโนมัติ</Text>
        </View>
        <Pressable onPress={() => router.push('/signup')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>สมัครร้านค้า</Text>
        </Pressable>
        <Pressable onPress={refresh} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>ฉันสมัครแล้ว · ตรวจสอบอีกครั้ง</Text>
        </Pressable>
        {error ? <Text style={styles.loginError}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SHOP WORKSPACE</Text>
        <Text style={styles.title}>{shop.name}</Text>
        <Text style={styles.subtitle}>รับออเดอร์และจัดการงานส่งจากมือถือ</Text>
      </View>

      {shop.is_banned ? (
        <View style={styles.dangerBanner}>
          <Text style={styles.dangerTitle}>ร้านนี้ถูกระงับ</Text>
          <Text style={styles.dangerText}>{shop.banned_reason || 'กรุณาติดต่อแอดมิน MyTree'}</Text>
        </View>
      ) : !shop.is_approved ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingTitle}>⏳ รอแอดมินอนุมัติร้าน</Text>
          <Text style={styles.pendingText}>ระบบพบร้านของคุณแล้ว เมื่ออนุมัติสถานะใน Admin Dashboard แอปจะอัปเดตเมื่อดึงลงเพื่อรีเฟรช</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{shop.is_approved ? 'ยังไม่มีออเดอร์' : 'ร้านยังไม่เปิดรับออเดอร์'}</Text>
            <Text style={styles.body}>{shop.is_approved ? 'ออเดอร์ใหม่จะปรากฏที่หน้านี้' : 'รอการอนุมัติจากแอดมินก่อนเริ่มขาย'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/orders/${item.id}`)} style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}>
            <View style={styles.row}><Text style={styles.orderId}>#{item.shortId}</Text><Text style={styles.status}>{item.status}</Text></View>
            <Text style={styles.customer}>{item.customerName}</Text>
            <View style={styles.row}><Text>{item.fulfillmentLabel}</Text><Text style={styles.amount}>฿{item.amount.toFixed(0)}</Text></View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7FAF7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerPad: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F7FAF7' },
  hero: { padding: 20, paddingBottom: 10 },
  eyebrow: { fontSize: 12, letterSpacing: 1.5, fontWeight: '800', color: '#52705B' },
  title: { marginTop: 6, fontSize: 28, fontWeight: '800', color: '#173C2C' },
  subtitle: { marginTop: 6, fontSize: 15, color: '#647168' },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { marginTop: 16, borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18, borderWidth: 1, borderColor: '#E4ECE6' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#173C2C' },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22, color: '#647168' },
  loginButton: { marginTop: 18, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#06C755', paddingHorizontal: 18 },
  loginText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  primaryButton: { marginTop: 18, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#173C2C' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { marginTop: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#EEF3EF' },
  secondaryText: { color: '#173C2C', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  loginError: { marginTop: 12, color: '#A13A36', lineHeight: 20 },
  orderCard: { borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18, borderWidth: 1, borderColor: '#E4ECE6' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontSize: 13, fontWeight: '800', color: '#52705B' },
  status: { fontSize: 12, fontWeight: '700', color: '#173C2C' },
  customer: { marginVertical: 12, fontSize: 18, fontWeight: '800', color: '#173C2C' },
  amount: { fontSize: 18, fontWeight: '800', color: '#173C2C' },
  error: { marginHorizontal: 20, color: '#A13A36' },
  pendingBanner: { marginHorizontal: 16, borderRadius: 16, padding: 14, backgroundColor: '#FFF7E1', borderWidth: 1, borderColor: '#F2D790' },
  pendingTitle: { fontSize: 15, fontWeight: '800', color: '#7A5810' },
  pendingText: { marginTop: 4, fontSize: 13, lineHeight: 19, color: '#8A6A27' },
  dangerBanner: { marginHorizontal: 16, borderRadius: 16, padding: 14, backgroundColor: '#FFF0EF', borderWidth: 1, borderColor: '#E8B3AF' },
  dangerTitle: { fontSize: 15, fontWeight: '800', color: '#8B302B' },
  dangerText: { marginTop: 4, fontSize: 13, lineHeight: 19, color: '#A13A36' },
});

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getAccessToken } from '../src/lib/tokenStore';
import { getOwnedShopId, loadShopOrders } from '../src/data/shopOrders';
import { toOrderSummary, type ShopOrderSummary } from '../src/domain/orders';

export default function ShopHomeScreen() {
  const [orders, setOrders] = useState<ShopOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setSignedIn(false);
        setOrders([]);
        return;
      }
      setSignedIn(true);
      const shopId = await getOwnedShopId();
      if (!shopId) {
        setError('บัญชีนี้ยังไม่มีร้านที่เป็นเจ้าของ');
        return;
      }
      const rows = await loadShopOrders(shopId);
      setOrders(rows.map(toOrderSummary));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดออเดอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>กำลังเปิด MyTree Shop…</Text></View>;
  }

  if (signedIn === false) {
    return (
      <View style={styles.centerPad}>
        <Text style={styles.title}>MyTree Shop</Text>
        <Text style={styles.subtitle}>Native merchant workspace</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Native foundation พร้อมแล้ว</Text>
          <Text style={styles.body}>ขั้นต่อไปคือเชื่อม LINE native sign-in กับ MyTree Worker เพื่อรับ JWT เดิมและใช้ RLS ชุดเดียวกับ Web/LIFF</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SHOP WORKSPACE</Text>
        <Text style={styles.title}>ออเดอร์ร้านของฉัน</Text>
        <Text style={styles.subtitle}>รับออเดอร์และจัดการงานส่งจากมือถือ</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<View style={styles.card}><Text style={styles.cardTitle}>ยังไม่มีออเดอร์</Text></View>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/orders/${item.id}`)} style={styles.orderCard}>
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
  hero: { padding: 20 },
  eyebrow: { fontSize: 12, letterSpacing: 1.5, fontWeight: '800', color: '#52705B' },
  title: { marginTop: 6, fontSize: 28, fontWeight: '800', color: '#173C2C' },
  subtitle: { marginTop: 6, fontSize: 15, color: '#647168' },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#173C2C' },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22, color: '#647168' },
  orderCard: { borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18, borderWidth: 1, borderColor: '#E4ECE6' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontSize: 13, fontWeight: '800', color: '#52705B' },
  status: { fontSize: 12, fontWeight: '700', color: '#173C2C' },
  customer: { marginVertical: 12, fontSize: 18, fontWeight: '800', color: '#173C2C' },
  amount: { fontSize: 18, fontWeight: '800', color: '#173C2C' },
  error: { marginHorizontal: 20, color: '#A13A36' },
});

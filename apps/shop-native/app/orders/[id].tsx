import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { loadShopOrderById } from '../../src/data/shopOrders';
import { acceptShopOrder, setShopOrderStatus } from '../../src/data/shopOrderActions';
import type { ShopOrder } from '../../src/domain/orders';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setOrder(await loadShopOrderById(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายละเอียดออเดอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    if (acting) return;
    setActing(true);
    setError(null);
    setActionMessage(null);
    try {
      await action();
      setActionMessage(successMessage);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setActing(false);
    }
  }, [acting, load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (error && !order) return <View style={styles.centerPad}><Text style={styles.error}>{error}</Text></View>;
  if (!order) return <View style={styles.centerPad}><Text>ไม่พบออเดอร์นี้</Text></View>;

  const canAccept = order.order_status === 'pending';
  const canPrepare = order.order_status === 'confirmed';
  const canComplete = order.order_status === 'preparing';

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ORDER #{order.sub_id.slice(0, 6).toUpperCase()}</Text>
        <Text style={styles.title}>{order.hub_orders?.customers?.name || 'ลูกค้า MyTree'}</Text>
        <Text style={styles.body}>{order.hub_orders?.customers?.phone || 'ไม่มีเบอร์โทร'}</Text>
        <Text style={styles.body}>{order.fulfillment_type === 'delivery' ? 'จัดส่ง' : 'รับเอง'} · {order.payment_method === 'cash' ? 'เงินสด' : 'QR / โอนตรง'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>รายการอาหาร</Text>
        {order.order_items.map((item, index) => (
          <View key={`${item.item_name_snapshot}-${index}`} style={styles.row}>
            <Text style={styles.body}>{item.item_name_snapshot} × {item.qty}</Text>
            <Text style={styles.body}>฿{Number(item.line_total).toFixed(0)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>รวม</Text>
          <Text style={styles.total}>฿{Number(order.amount).toFixed(0)}</Text>
        </View>
      </View>

      {order.delivery_address ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ที่อยู่จัดส่ง</Text>
          <Text style={styles.body}>{order.delivery_address}</Text>
        </View>
      ) : null}

      {order.customer_note ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>หมายเหตุ</Text>
          <Text style={styles.body}>{order.customer_note}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>สถานะ</Text>
        <Text style={styles.body}>ออเดอร์: {order.order_status}</Text>
        <Text style={styles.body}>ชำระเงิน: {order.payment_status}</Text>
        <Text style={styles.body}>จัดส่ง: {order.delivery_status}</Text>
      </View>

      {(canAccept || canPrepare || canComplete) ? (
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>จัดการออเดอร์</Text>
          <Text style={styles.actionHint}>สถานะจะเดินหน้าได้ทีละขั้น เพื่อป้องกันการกดข้ามขั้น</Text>
          {canAccept ? (
            <Pressable
              disabled={acting}
              onPress={() => void runAction(() => acceptShopOrder(order.sub_id), 'รับออเดอร์แล้ว')}
              style={({ pressed }) => [styles.primaryButton, acting && styles.disabled, pressed && styles.pressed]}
            >
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>✓ รับออเดอร์</Text>}
            </Pressable>
          ) : null}
          {canPrepare ? (
            <Pressable
              disabled={acting}
              onPress={() => void runAction(() => setShopOrderStatus(order.sub_id, 'preparing'), 'เริ่มเตรียมออเดอร์แล้ว')}
              style={({ pressed }) => [styles.primaryButton, acting && styles.disabled, pressed && styles.pressed]}
            >
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>เริ่มเตรียมออเดอร์</Text>}
            </Pressable>
          ) : null}
          {canComplete ? (
            <Pressable
              disabled={acting}
              onPress={() => void runAction(() => setShopOrderStatus(order.sub_id, 'completed'), 'ออเดอร์เสร็จแล้ว')}
              style={({ pressed }) => [styles.primaryButton, acting && styles.disabled, pressed && styles.pressed]}
            >
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>ทำออเดอร์เสร็จแล้ว</Text>}
            </Pressable>
          ) : null}
          {actionMessage ? <Text style={styles.success}>{actionMessage}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, backgroundColor: '#F7FAF7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18, borderWidth: 1, borderColor: '#E4ECE6' },
  actionCard: { borderRadius: 20, backgroundColor: '#F0F7F2', padding: 18, borderWidth: 1, borderColor: '#D8E8DC' },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: '800', color: '#52705B' },
  title: { marginTop: 8, fontSize: 24, fontWeight: '800', color: '#173C2C' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#173C2C' },
  body: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#647168' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  divider: { height: 1, backgroundColor: '#E4ECE6', marginVertical: 14 },
  total: { fontSize: 20, fontWeight: '800', color: '#173C2C' },
  actionHint: { marginTop: 6, color: '#647168', fontSize: 13, lineHeight: 18 },
  primaryButton: { marginTop: 14, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F6B45', paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  success: { marginTop: 10, color: '#1F6B45', fontWeight: '700' },
  error: { marginTop: 10, color: '#A13A36' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});

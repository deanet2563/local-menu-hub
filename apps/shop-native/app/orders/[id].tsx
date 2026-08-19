import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { loadShopOrderById } from '../../src/data/shopOrders';
import { acceptShopOrder, setShopOrderStatus } from '../../src/data/shopOrderActions';
import { loadInterestedRiders, requestNearbyRiders, selectInterestedRider, type RiderCandidate } from '../../src/data/riderDispatch';
import type { ShopOrder } from '../../src/domain/orders';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [riderCandidates, setRiderCandidates] = useState<RiderCandidate[]>([]);
  const [riderBusy, setRiderBusy] = useState(false);
  const [riderMessage, setRiderMessage] = useState<string | null>(null);

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

  const findRiders = useCallback(async () => {
    if (!order || riderBusy) return;
    setRiderBusy(true);
    setError(null);
    setRiderMessage(null);
    try {
      const result = await requestNearbyRiders(order.sub_id);
      setRiderMessage(
        result.candidates > 0
          ? `ส่งงานให้ Rider ใกล้ร้าน ${result.candidates} คนแล้ว · รัศมี ${result.usedRadiusKm} กม.`
          : `ยังไม่พบ Rider ที่พร้อมรับงานภายใน ${result.usedRadiusKm} กม.`,
      );
      setRiderCandidates(await loadInterestedRiders(order.sub_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ค้นหา Rider ไม่สำเร็จ');
    } finally {
      setRiderBusy(false);
    }
  }, [order, riderBusy]);

  const refreshCandidates = useCallback(async () => {
    if (!order || riderBusy) return;
    setRiderBusy(true);
    setError(null);
    try {
      setRiderCandidates(await loadInterestedRiders(order.sub_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลด Rider ที่สนใจไม่สำเร็จ');
    } finally {
      setRiderBusy(false);
    }
  }, [order, riderBusy]);

  const chooseRider = useCallback(async (candidate: RiderCandidate) => {
    if (!order || riderBusy) return;
    setRiderBusy(true);
    setError(null);
    try {
      await selectInterestedRider(order.sub_id, candidate.riderId);
      setRiderMessage(`เลือก ${candidate.name} เป็น Rider สำหรับงานนี้แล้ว`);
      setRiderCandidates([]);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เลือก Rider ไม่สำเร็จ');
    } finally {
      setRiderBusy(false);
    }
  }, [load, order, riderBusy]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (error && !order) return <View style={styles.centerPad}><Text style={styles.error}>{error}</Text></View>;
  if (!order) return <View style={styles.centerPad}><Text>ไม่พบออเดอร์นี้</Text></View>;

  const canAccept = order.order_status === 'pending';
  const canPrepare = order.order_status === 'confirmed';
  const canComplete = order.order_status === 'preparing';
  const needsRider = order.fulfillment_type === 'delivery' && order.delivery_status === 'needs_rider' && !order.assigned_rider_id;

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
        {order.assigned_rider_id ? <Text style={styles.success}>✓ เลือก Rider แล้ว</Text> : null}
      </View>

      {needsRider ? (
        <View style={styles.riderCard}>
          <Text style={styles.sectionTitle}>🛵 หา Rider ส่งอาหาร</Text>
          <Text style={styles.actionHint}>ระบบส่งงานให้ Rider ใกล้ร้านก่อน Rider กดสนใจ แล้วร้านเป็นผู้เลือกคนสุดท้ายเอง</Text>
          <Pressable
            disabled={riderBusy}
            onPress={() => void findRiders()}
            style={({ pressed }) => [styles.primaryButton, riderBusy && styles.disabled, pressed && styles.pressed]}
          >
            {riderBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>ค้นหา Rider ใกล้ร้าน</Text>}
          </Pressable>
          <Pressable
            disabled={riderBusy}
            onPress={() => void refreshCandidates()}
            style={({ pressed }) => [styles.secondaryButton, riderBusy && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>รีเฟรชรายชื่อ Rider ที่สนใจ</Text>
          </Pressable>
          {riderMessage ? <Text style={styles.success}>{riderMessage}</Text> : null}

          {riderCandidates.map((candidate) => (
            <View key={candidate.riderId} style={styles.candidateCard}>
              <View style={styles.row}>
                <View style={styles.candidateInfo}>
                  <Text style={styles.candidateName}>{candidate.name}</Text>
                  <Text style={styles.candidateMeta}>
                    {candidate.distanceKm == null ? 'ไม่ทราบระยะทาง' : `${candidate.distanceKm.toFixed(1)} กม.`}
                    {candidate.vehicleType ? ` · ${candidate.vehicleType}` : ''}
                  </Text>
                </View>
                <Pressable
                  disabled={riderBusy}
                  onPress={() => void chooseRider(candidate)}
                  style={({ pressed }) => [styles.chooseButton, riderBusy && styles.disabled, pressed && styles.pressed]}
                >
                  <Text style={styles.chooseText}>เลือก</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!riderBusy && riderCandidates.length === 0 ? <Text style={styles.actionHint}>ยังไม่มี Rider กดสนใจงานนี้</Text> : null}
        </View>
      ) : null}

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
  riderCard: { borderRadius: 20, backgroundColor: '#F5F7FF', padding: 18, borderWidth: 1, borderColor: '#DDE4F7' },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: '800', color: '#52705B' },
  title: { marginTop: 8, fontSize: 24, fontWeight: '800', color: '#173C2C' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#173C2C' },
  body: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#647168' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  divider: { height: 1, backgroundColor: '#E4ECE6', marginVertical: 14 },
  total: { fontSize: 20, fontWeight: '800', color: '#173C2C' },
  actionHint: { marginTop: 8, color: '#647168', fontSize: 13, lineHeight: 18 },
  primaryButton: { marginTop: 14, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F6B45', paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryButton: { marginTop: 9, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C7D5CB', paddingHorizontal: 16 },
  secondaryText: { color: '#315443', fontWeight: '700', fontSize: 14 },
  candidateCard: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E6F2' },
  candidateInfo: { flex: 1 },
  candidateName: { fontWeight: '800', fontSize: 15, color: '#173C2C' },
  candidateMeta: { marginTop: 4, color: '#647168', fontSize: 12 },
  chooseButton: { borderRadius: 12, backgroundColor: '#3157B8', paddingHorizontal: 16, paddingVertical: 10 },
  chooseText: { color: '#FFFFFF', fontWeight: '800' },
  success: { marginTop: 10, color: '#1F6B45', fontWeight: '700' },
  error: { marginTop: 10, color: '#A13A36' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});

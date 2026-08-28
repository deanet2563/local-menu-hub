import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { loadShopOrderById } from '../../src/data/shopOrders';
import { acceptShopOrder, cancelShopDeliveryV3, setShopOrderStatus } from '../../src/data/shopOrderActions';
import type { ShopOrder } from '../../src/domain/orders';

const DELIVERY_V3_ENABLED = process.env.EXPO_PUBLIC_ENABLE_RIDER_DELIVERY_V3 === 'true';

function formatRequestedFor(value: string): string {
  return new Date(value).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function cancellationErrorMessage(value: string): string {
  if (value === 'unauthorized_shop_session' || value === 'shop_actor_not_authenticated') {
    return 'Shop session หมดอายุหรือถูกออกจากระบบ กรุณาเข้าสู่ระบบใหม่';
  }
  if (value === 'shop_actor_not_authorized') return 'บัญชีนี้ไม่มีสิทธิ์ยกเลิกออเดอร์ของร้านนี้';
  if (value === 'cancellation_reason_required') return 'กรุณาระบุเหตุผลการยกเลิก';
  if (value === 'cancellation_reason_too_long') return 'เหตุผลการยกเลิกยาวเกินไป';
  if (value === 'cancellation_not_allowed_after_pickup') return 'ยกเลิกไม่ได้หลัง Rider รับสินค้าแล้ว';
  if (value === 'completed_order_cannot_be_cancelled') return 'ออเดอร์ที่เสร็จแล้วไม่สามารถยกเลิกได้';
  if (value === 'cancellation_transition_conflict') return 'สถานะออเดอร์เปลี่ยนไปแล้ว กรุณาโหลดใหม่';
  if (value === 'delivery_not_found') return 'ไม่พบงานจัดส่งนี้';
  return value;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

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

  const cancelDelivery = useCallback(async () => {
    if (!order || acting) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setError('กรุณาระบุเหตุผลการยกเลิก');
      return;
    }

    setActing(true);
    setError(null);
    setActionMessage(null);
    try {
      const result = await cancelShopDeliveryV3(order.sub_id, reason);
      setCancelReason('');
      setActionMessage(result === 'already_cancelled' ? 'ออเดอร์นี้ถูกยกเลิกแล้ว' : 'ยกเลิกออเดอร์และปิดงาน Rider แล้ว');
      await load();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setError(cancellationErrorMessage(text));
    } finally {
      setActing(false);
    }
  }, [acting, cancelReason, load, order]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (error && !order) return <View style={styles.centerPad}><Text style={styles.error}>{error}</Text></View>;
  if (!order) return <View style={styles.centerPad}><Text>ไม่พบออเดอร์นี้</Text></View>;

  const canAccept = order.order_status === 'pending';
  const canPrepare = order.order_status === 'confirmed';
  const canComplete = order.order_status === 'preparing';
  const isDelivery = order.fulfillment_type === 'delivery';
  const waitingForRider = isDelivery && order.delivery_status === 'needs_rider' && !order.assigned_rider_id;
  const riderAssigned = isDelivery && order.delivery_status === 'rider_called' && !!order.assigned_rider_id;
  const canCancelDelivery = DELIVERY_V3_ENABLED
    && isDelivery
    && order.order_status !== 'cancelled'
    && order.order_status !== 'completed'
    && order.picked_up_at == null
    && order.delivered_at == null
    && ['needs_rider', 'rider_called', 'failed'].includes(order.delivery_status);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ORDER #{order.sub_id.slice(0, 6).toUpperCase()}</Text>
        <Text style={styles.title}>{order.hub_orders?.customers?.name || 'ลูกค้า MyTree'}</Text>
        <Text style={styles.body}>{order.hub_orders?.customers?.phone || 'ไม่มีเบอร์โทร'}</Text>
        <Text style={styles.body}>{isDelivery ? 'จัดส่ง' : 'รับเอง'} · {order.payment_method === 'cash' ? 'เงินสด' : 'QR / โอนตรง'}</Text>
      </View>

      {order.requested_for ? (
        <View style={styles.preorderCard}>
          <Text style={styles.preorderLabel}>🗓️ สั่งล่วงหน้า</Text>
          <Text style={styles.preorderTime}>
            {isDelivery ? 'ส่งวันที่' : 'รับวันที่'} {formatRequestedFor(order.requested_for)}
          </Text>
          <Text style={styles.preorderHint}>กรุณาเตรียมออเดอร์ให้พร้อมตามวันและเวลานี้</Text>
        </View>
      ) : null}

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
        {riderAssigned ? <Text style={styles.success}>✓ Rider ชนะ First Accept และระบบล็อกงานแล้ว</Text> : null}
        {order.order_status === 'cancelled' && order.cancelled_reason ? (
          <Text style={styles.cancelledText}>เหตุผลยกเลิก: {order.cancelled_reason}</Text>
        ) : null}
      </View>

      {isDelivery ? (
        <View style={styles.riderCard}>
          <Text style={styles.sectionTitle}>🛵 Rider Delivery V3</Text>
          {DELIVERY_V3_ENABLED ? (
            <Text style={styles.actionHint}>
              {waitingForRider
                ? 'งานเปิดให้ Rider ที่พร้อมและอยู่ในระยะกดรับ คนแรกที่ backend ยืนยันสำเร็จจะได้งานทันที ร้านไม่ต้องเลือกรายชื่อ Rider'
                : riderAssigned
                  ? 'ระบบล็อก Rider ผู้ชนะแล้ว ร้านจะเห็นสถานะเปลี่ยนตาม Pickup และ Delivery'
                  : 'สถานะงาน Rider แสดงจาก backend โดยตรง'}
            </Text>
          ) : (
            <Text style={styles.gateText}>Delivery V3 ยังไม่เปิดใน production build นี้</Text>
          )}
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

      {canCancelDelivery ? (
        <View style={styles.cancelCard}>
          <Text style={styles.cancelTitle}>ยกเลิกงานก่อน Rider รับสินค้า</Text>
          <Text style={styles.actionHint}>
            ต้องระบุเหตุผล ระบบจะยกเลิกออเดอร์ ปิดงาน Rider และแจ้ง Rider ที่ถูก assign หากมี โดยไม่เปลี่ยนสถานะการชำระเงินอัตโนมัติ
          </Text>
          <TextInput
            accessibilityLabel="เหตุผลการยกเลิก"
            editable={!acting}
            maxLength={500}
            multiline
            onChangeText={setCancelReason}
            placeholder="ระบุเหตุผล เช่น สินค้าหมด / ร้านไม่สามารถจัดส่งได้"
            style={styles.cancelInput}
            value={cancelReason}
          />
          <Pressable
            disabled={acting || !cancelReason.trim()}
            onPress={() => void cancelDelivery()}
            style={({ pressed }) => [styles.cancelButton, (acting || !cancelReason.trim()) && styles.disabled, pressed && styles.pressed]}
          >
            {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.cancelButtonText}>ยืนยันยกเลิกออเดอร์</Text>}
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, backgroundColor: '#F7FAF7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18, borderWidth: 1, borderColor: '#E4ECE6' },
  preorderCard: { borderRadius: 20, backgroundColor: '#FFF7E8', padding: 18, borderWidth: 2, borderColor: '#F4A62A' },
  preorderLabel: { fontSize: 15, fontWeight: '900', color: '#B85C00' },
  preorderTime: { marginTop: 6, fontSize: 18, lineHeight: 26, fontWeight: '900', color: '#6F3500' },
  preorderHint: { marginTop: 6, fontSize: 12, lineHeight: 18, color: '#91643A' },
  actionCard: { borderRadius: 20, backgroundColor: '#F0F7F2', padding: 18, borderWidth: 1, borderColor: '#D8E8DC' },
  riderCard: { borderRadius: 20, backgroundColor: '#F5F7FF', padding: 18, borderWidth: 1, borderColor: '#DDE4F7' },
  cancelCard: { borderRadius: 20, backgroundColor: '#FFF4F2', padding: 18, borderWidth: 1, borderColor: '#F5C2BC' },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: '800', color: '#52705B' },
  title: { marginTop: 8, fontSize: 24, fontWeight: '800', color: '#173C2C' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#173C2C' },
  body: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#647168' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  divider: { height: 1, backgroundColor: '#E4ECE6', marginVertical: 14 },
  total: { fontSize: 20, fontWeight: '800', color: '#173C2C' },
  actionHint: { marginTop: 8, color: '#647168', fontSize: 13, lineHeight: 18 },
  gateText: { marginTop: 8, color: '#8A5A00', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  primaryButton: { marginTop: 14, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F6B45', paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  success: { marginTop: 10, color: '#1F6B45', fontWeight: '700' },
  cancelledText: { marginTop: 10, color: '#A13A36', fontWeight: '700' },
  error: { marginTop: 10, color: '#A13A36' },
  cancelTitle: { fontSize: 17, fontWeight: '800', color: '#8F2D28' },
  cancelInput: { marginTop: 12, minHeight: 88, borderRadius: 14, borderWidth: 1, borderColor: '#E1A7A1', backgroundColor: '#FFFFFF', padding: 12, textAlignVertical: 'top', color: '#352321' },
  cancelButton: { marginTop: 12, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B42318', paddingHorizontal: 16 },
  cancelButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});

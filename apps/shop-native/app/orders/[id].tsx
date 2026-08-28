import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { loadShopOrderById } from '../../src/data/shopOrders';
import {
  acceptShopOrder,
  cancelShopDeliveryV3,
  reofferShopDeliveryV3,
  requestShopDeliveryV3,
  setShopOrderStatus,
  type RiderReofferReasonCode,
  type ShopCancelReasonCode,
} from '../../src/data/shopOrderActions';
import type { ShopOrder } from '../../src/domain/orders';

const DELIVERY_V3_ENABLED = process.env.EXPO_PUBLIC_ENABLE_RIDER_DELIVERY_V3 === 'true';
const POLL_MS = 10_000;

const REOFFER_REASONS: Array<{ code: RiderReofferReasonCode; label: string }> = [
  { code: 'rider_not_arriving', label: 'Rider ยังไม่มารับ' },
  { code: 'rider_too_slow', label: 'Rider ช้าเกินไป' },
  { code: 'cannot_contact_rider', label: 'ติดต่อ Rider ไม่ได้' },
  { code: 'shop_operational_issue', label: 'ปัญหาการจัดส่งของร้าน' },
  { code: 'other', label: 'อื่น ๆ' },
];

const CANCEL_REASONS: Array<{ code: ShopCancelReasonCode; label: string }> = [
  { code: 'customer_requested', label: 'ลูกค้าขอยกเลิก' },
  { code: 'order_cancelled', label: 'ต้องยกเลิกออเดอร์' },
  { code: 'shop_operational_issue', label: 'ร้านไม่สามารถดำเนินออเดอร์ได้' },
  { code: 'other', label: 'อื่น ๆ' },
];

function formatRequestedFor(value: string): string {
  return new Date(value).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function friendlyError(value: string): string {
  if (value === 'unauthorized_shop_session' || value === 'shop_actor_not_authenticated') return 'Shop session หมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (value === 'shop_actor_not_authorized') return 'บัญชีนี้ไม่มีสิทธิ์จัดการงานของร้านนี้';
  if (value === 'delivery_not_open_for_riders') return 'งานนี้ไม่อยู่ในสถานะเปิดหา Rider แล้ว กรุณาโหลดใหม่';
  if (value === 'reoffer_not_allowed_after_pickup' || value === 'cancellation_not_allowed_after_pickup') return 'ดำเนินการไม่ได้หลัง Rider รับสินค้าแล้ว';
  if (value === 'delivery_has_no_releasable_rider') return 'ไม่มี Rider ที่สามารถปล่อยจากงานนี้ได้';
  if (value === 'reoffer_transition_conflict' || value === 'cancellation_transition_conflict') return 'สถานะงานเปลี่ยนไปแล้ว กรุณาโหลดใหม่';
  if (value === 'reoffer_note_required_for_other' || value === 'cancellation_note_required_for_other') return 'กรุณาระบุรายละเอียดเมื่อเลือก “อื่น ๆ”';
  if (value === 'reoffer_note_too_long' || value === 'cancellation_note_too_long') return 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร';
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
  const [reofferReason, setReofferReason] = useState<RiderReofferReasonCode>('rider_not_arriving');
  const [reofferNote, setReofferNote] = useState('');
  const [cancelReason, setCancelReason] = useState<ShopCancelReasonCode>('customer_requested');
  const [cancelNote, setCancelNote] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const next = await loadShopOrderById(id);
      setOrder(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายละเอียดออเดอร์ไม่สำเร็จ');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(true); }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    if (acting) return;
    setActing(true);
    setError(null);
    setActionMessage(null);
    try {
      await action();
      setActionMessage(successMessage);
      await load(true);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setError(friendlyError(text));
      await load(true);
    } finally {
      setActing(false);
    }
  }, [acting, load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (error && !order) return <View style={styles.centerPad}><Text style={styles.error}>{error}</Text></View>;
  if (!order) return <View style={styles.centerPad}><Text>ไม่พบออเดอร์นี้</Text></View>;

  const isDelivery = order.fulfillment_type === 'delivery';
  const waitingForRider = isDelivery && order.delivery_status === 'needs_rider' && !order.assigned_rider_id;
  const riderAssigned = isDelivery && order.delivery_status === 'rider_called' && !!order.assigned_rider_id;
  const beforePickup = order.picked_up_at == null && order.delivered_at == null;
  const deliveryOrderActive = order.order_status !== 'cancelled';
  const canRequestRider = DELIVERY_V3_ENABLED && waitingForRider && beforePickup && deliveryOrderActive;
  const canReoffer = DELIVERY_V3_ENABLED && riderAssigned && beforePickup && deliveryOrderActive;
  const canCancelDelivery = DELIVERY_V3_ENABLED
    && isDelivery
    && beforePickup
    && order.order_status !== 'cancelled'
    && order.order_status !== 'completed'
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
          <Text style={styles.preorderTime}>{isDelivery ? 'ส่งวันที่' : 'รับวันที่'} {formatRequestedFor(order.requested_for)}</Text>
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
        <View style={styles.row}><Text style={styles.sectionTitle}>รวม</Text><Text style={styles.total}>฿{Number(order.amount).toFixed(0)}</Text></View>
      </View>

      {order.delivery_address ? <View style={styles.card}><Text style={styles.sectionTitle}>ที่อยู่จัดส่ง</Text><Text style={styles.body}>{order.delivery_address}</Text></View> : null}
      {order.customer_note ? <View style={styles.card}><Text style={styles.sectionTitle}>หมายเหตุ</Text><Text style={styles.body}>{order.customer_note}</Text></View> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>สถานะ</Text>
        <Text style={styles.body}>ออเดอร์: {order.order_status}</Text>
        <Text style={styles.body}>ชำระเงิน: {order.payment_status}</Text>
        <Text style={styles.body}>จัดส่ง: {order.delivery_status}</Text>
        {riderAssigned ? <Text style={styles.success}>✓ Rider ชนะ First Accept และ backend ล็อกงานแล้ว</Text> : null}
        {order.order_status === 'cancelled' && order.cancelled_reason ? <Text style={styles.cancelledText}>เหตุผลยกเลิก: {order.cancelled_reason}</Text> : null}
      </View>

      {isDelivery ? (
        <View style={styles.riderCard}>
          <Text style={styles.sectionTitle}>🛵 Rider Delivery V3</Text>
          {!DELIVERY_V3_ENABLED ? (
            <Text style={styles.gateText}>Delivery V3 ยังไม่เปิดใน production build นี้</Text>
          ) : canRequestRider ? (
            <>
              <Text style={styles.actionHint}>กดส่งคำขอเพื่อแจ้ง Rider ใกล้ร้าน Rider คนแรกที่ backend ยืนยัน First Accept สำเร็จจะได้งาน ร้านไม่ต้องเลือกรายชื่อ Rider</Text>
              <Pressable
                disabled={acting}
                onPress={() => void runAction(async () => {
                  const result = await requestShopDeliveryV3(order.sub_id);
                  setActionMessage(result.result === 'recently_requested'
                    ? 'เพิ่งส่งคำขอไปแล้ว ระบบป้องกันการแจ้งซ้ำชั่วคราว'
                    : `ส่งคำขอแล้ว · พบ Rider พร้อมรับ ${result.candidates ?? 0} คน${result.usedRadiusKm ? ` · รัศมี ${result.usedRadiusKm} กม.` : ''}`);
                }, 'ส่งคำขอหา Rider แล้ว')}
                style={({ pressed }) => [styles.primaryButton, acting && styles.disabled, pressed && styles.pressed]}
              >
                {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>ส่งคำขอหา Rider ใกล้ร้าน</Text>}
              </Pressable>
            </>
          ) : riderAssigned ? (
            <Text style={styles.actionHint}>ระบบล็อก Rider ผู้ชนะแล้ว ร้านจะเห็น Pickup/Delivery จาก backend อัตโนมัติ หากต้องเปลี่ยน Rider ก่อนรับสินค้าให้ใช้ “ปล่อย Rider และหาใหม่” ด้านล่าง</Text>
          ) : (
            <Text style={styles.actionHint}>สถานะ Rider แสดงจาก backend โดยตรง</Text>
          )}
        </View>
      ) : null}

      {(order.order_status === 'pending' || order.order_status === 'confirmed' || order.order_status === 'preparing') ? (
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>จัดการออเดอร์</Text>
          <Text style={styles.actionHint}>Ordering Flow V2 เดินหน้าได้ทีละขั้น</Text>
          {order.order_status === 'pending' ? (
            <Pressable disabled={acting} onPress={() => void runAction(() => acceptShopOrder(order.sub_id), 'รับออเดอร์แล้ว')} style={({ pressed }) => [styles.primaryButton, acting && styles.disabled, pressed && styles.pressed]}>
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>✓ รับออเดอร์</Text>}
            </Pressable>
          ) : null}
          {order.order_status === 'confirmed' ? (
            <Pressable disabled={acting} onPress={() => void runAction(() => setShopOrderStatus(order.sub_id, 'preparing'), 'เริ่มเตรียมออเดอร์แล้ว')} style={({ pressed }) => [styles.primaryButton, acting && styles.disabled, pressed && styles.pressed]}>
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>เริ่มเตรียมออเดอร์</Text>}
            </Pressable>
          ) : null}
          {order.order_status === 'preparing' ? (
            <Pressable disabled={acting} onPress={() => void runAction(() => setShopOrderStatus(order.sub_id, 'completed'), 'ออเดอร์เสร็จแล้ว')} style={({ pressed }) => [styles.primaryButton, acting && styles.disabled, pressed && styles.pressed]}>
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>ทำออเดอร์เสร็จแล้ว</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {canReoffer ? (
        <View style={styles.reofferCard}>
          <Text style={styles.reofferTitle}>เปลี่ยน Rider โดยไม่ยกเลิกออเดอร์</Text>
          <Text style={styles.actionHint}>ใช้เมื่อ Rider ยังไม่มารับ ช้า หรือติดต่อไม่ได้ ระบบจะปล่อย Rider เดิมแล้วเปิดหา Rider ใหม่ทันที</Text>
          <ReasonButtons options={REOFFER_REASONS} value={reofferReason} onChange={setReofferReason} disabled={acting} />
          <TextInput
            editable={!acting}
            maxLength={500}
            multiline
            onChangeText={setReofferNote}
            placeholder={reofferReason === 'other' ? 'กรุณาระบุรายละเอียด' : 'รายละเอียดเพิ่มเติม (ถ้ามี)'}
            style={styles.textInput}
            value={reofferNote}
          />
          <Pressable
            disabled={acting || (reofferReason === 'other' && !reofferNote.trim())}
            onPress={() => void runAction(async () => {
              const result = await reofferShopDeliveryV3(order.sub_id, reofferReason, reofferNote);
              setReofferNote('');
              setActionMessage(result.offerResult === 'recently_requested' ? 'ปล่อย Rider เดิมแล้ว · คำขอหา Rider ใหม่ถูกเปิดไว้แล้ว' : 'ปล่อย Rider เดิมและส่งคำขอหา Rider ใหม่แล้ว');
            }, 'ปล่อย Rider เดิมและเปิดหา Rider ใหม่แล้ว')}
            style={({ pressed }) => [styles.reofferButton, (acting || (reofferReason === 'other' && !reofferNote.trim())) && styles.disabled, pressed && styles.pressed]}
          >
            {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>ปล่อย Rider และหาใหม่</Text>}
          </Pressable>
        </View>
      ) : null}

      {canCancelDelivery ? (
        <View style={styles.cancelCard}>
          <Text style={styles.cancelTitle}>ยกเลิกออเดอร์ทั้งหมด</Text>
          <Text style={styles.actionHint}>ใช้เฉพาะเมื่อต้องยกเลิกออเดอร์จริง ไม่ใช่กรณีต้องการเปลี่ยน Rider การยกเลิกนี้ไม่เปลี่ยน payment/refund อัตโนมัติ</Text>
          <ReasonButtons options={CANCEL_REASONS} value={cancelReason} onChange={setCancelReason} disabled={acting} />
          <TextInput
            editable={!acting}
            maxLength={500}
            multiline
            onChangeText={setCancelNote}
            placeholder={cancelReason === 'other' ? 'กรุณาระบุรายละเอียด' : 'รายละเอียดเพิ่มเติม (ถ้ามี)'}
            style={styles.textInput}
            value={cancelNote}
          />
          <Pressable
            disabled={acting || (cancelReason === 'other' && !cancelNote.trim())}
            onPress={() => void runAction(async () => {
              const result = await cancelShopDeliveryV3(order.sub_id, cancelReason, cancelNote);
              setCancelNote('');
              setActionMessage(result === 'already_cancelled' ? 'ออเดอร์นี้ถูกยกเลิกแล้ว' : 'ยกเลิกออเดอร์และปิดงาน Rider แล้ว');
            }, 'ยกเลิกออเดอร์แล้ว')}
            style={({ pressed }) => [styles.cancelButton, (acting || (cancelReason === 'other' && !cancelNote.trim())) && styles.disabled, pressed && styles.pressed]}
          >
            {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.cancelButtonText}>ยืนยันยกเลิกออเดอร์</Text>}
          </Pressable>
        </View>
      ) : null}

      {actionMessage ? <Text style={styles.successBanner}>{actionMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function ReasonButtons<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ code: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.reasonWrap}>
      {options.map((option) => (
        <Pressable
          key={option.code}
          disabled={disabled}
          onPress={() => onChange(option.code)}
          style={[styles.reasonChip, value === option.code && styles.reasonChipSelected, disabled && styles.disabled]}
        >
          <Text style={[styles.reasonText, value === option.code && styles.reasonTextSelected]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
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
  reofferCard: { borderRadius: 20, backgroundColor: '#FFF9EC', padding: 18, borderWidth: 1, borderColor: '#F4D48A' },
  cancelCard: { borderRadius: 20, backgroundColor: '#FFF4F3', padding: 18, borderWidth: 1, borderColor: '#F2B8B5' },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: '800', color: '#52705B' },
  title: { marginTop: 8, fontSize: 24, fontWeight: '800', color: '#173C2C' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#173C2C' },
  reofferTitle: { fontSize: 17, fontWeight: '800', color: '#7A4C00' },
  cancelTitle: { fontSize: 17, fontWeight: '800', color: '#8D2E2A' },
  body: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#647168' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  divider: { height: 1, backgroundColor: '#E4ECE6', marginVertical: 14 },
  total: { fontSize: 20, fontWeight: '800', color: '#173C2C' },
  actionHint: { marginTop: 8, color: '#647168', fontSize: 13, lineHeight: 19 },
  gateText: { marginTop: 8, color: '#8A5B16', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  primaryButton: { marginTop: 14, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F6B45', paddingHorizontal: 16 },
  reofferButton: { marginTop: 12, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B56A00', paddingHorizontal: 16 },
  cancelButton: { marginTop: 12, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B42318', paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  success: { marginTop: 10, color: '#1F6B45', fontWeight: '700' },
  successBanner: { borderRadius: 12, padding: 12, backgroundColor: '#ECFDF3', color: '#16794C', fontWeight: '700' },
  cancelledText: { marginTop: 8, color: '#A13A36', fontSize: 13, lineHeight: 19 },
  error: { marginTop: 10, color: '#A13A36' },
  reasonWrap: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { borderRadius: 999, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 8 },
  reasonChipSelected: { borderColor: '#3157B8', backgroundColor: '#EEF2FF' },
  reasonText: { fontSize: 12, color: '#475467', fontWeight: '700' },
  reasonTextSelected: { color: '#2949A4' },
  textInput: { marginTop: 10, minHeight: 72, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 12, textAlignVertical: 'top', color: '#344054' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
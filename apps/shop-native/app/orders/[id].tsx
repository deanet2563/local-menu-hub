import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadShopOrderById } from '../../src/data/shopOrders';
import {
  acceptShopOrder,
  confirmCompleteAndRequestRider,
  confirmShopPayment,
  requestShopDeliveryV3,
  setShopOrderStatus,
} from '../../src/data/shopOrderActions';
import type { ShopOrder } from '../../src/domain/orders';

const DELIVERY_V3_ENABLED = process.env.EXPO_PUBLIC_ENABLE_RIDER_DELIVERY_V3 === 'true';
const POLL_MS = 8_000;

const ORDER_LABEL: Record<string, string> = {
  pending: 'ออเดอร์ใหม่',
  confirmed: 'รับออเดอร์แล้ว',
  preparing: 'กำลังทำ',
  completed: 'อาหารเสร็จแล้ว',
  cancelled: 'ยกเลิก',
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: 'ยังไม่ชำระ',
  pending: 'รอตรวจยอด',
  paid: 'ยืนยันยอดแล้ว',
  refunded: 'คืนเงินแล้ว',
  void: 'ยกเลิกยอด',
};

function deliveryLabel(order: ShopOrder): string | null {
  if (order.delivery_status === 'delivered') return 'ส่งสำเร็จ';
  if (order.delivery_status === 'picked_up') return 'ไรเดอร์รับสินค้าแล้ว';
  if (order.delivery_status === 'rider_called' && order.assigned_rider_id) return 'ไรเดอร์รับงานแล้ว';
  if (order.delivery_status === 'rider_called') return 'เรียกไรเดอร์แล้ว';
  if (order.delivery_status === 'failed') return 'การจัดส่งมีปัญหา';
  return null;
}

function formatRequestedFor(value: string) {
  return new Date(value).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      setOrder(await loadShopOrderById(id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายละเอียดออเดอร์ไม่สำเร็จ');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const run = useCallback(async (action: () => Promise<unknown>, success: string) => {
    if (acting) return;
    setActing(true); setError(null); setMessage(null);
    try {
      await action();
      setMessage(success);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await load(true);
    } finally { setActing(false); }
  }, [acting, load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดออเดอร์…</Text></View>;
  if (!order) return <View style={styles.center}><Text style={styles.error}>{error || 'ไม่พบออเดอร์'}</Text></View>;

  const currentOrder = order;
  const isDelivery = currentOrder.fulfillment_type === 'delivery';
  const customerName = currentOrder.hub_orders?.customers?.name?.trim() || 'ลูกค้า MyTree';
  const customerPhone = currentOrder.hub_orders?.customers?.phone?.trim() || '';
  const deliveryText = isDelivery ? deliveryLabel(currentOrder) : null;
  const riderFlowStarted = Boolean(deliveryText) && currentOrder.delivery_status !== 'failed';
  const canRequestRider = DELIVERY_V3_ENABLED && isDelivery && !riderFlowStarted && currentOrder.order_status !== 'cancelled';

  function callCustomer() {
    if (!customerPhone) return Alert.alert('ไม่มีเบอร์โทร', 'ลูกค้ารายนี้ยังไม่มีเบอร์โทรในออเดอร์');
    void Linking.openURL(`tel:${customerPhone.replace(/\s/g, '')}`);
  }

  function openChat() {
    router.push({ pathname: '/chat/[subId]', params: { subId: currentOrder.sub_id } });
  }

  async function requestRiderReadyFlow() {
    if (!canRequestRider || acting) return;
    const ready = currentOrder.payment_status === 'paid' && currentOrder.order_status === 'completed';

    const execute = async () => {
      if (ready) {
        await run(async () => {
          await requestShopDeliveryV3(currentOrder.sub_id);
        }, 'ส่งคำขอแล้ว · เรียกไรเดอร์แล้ว');
      } else {
        await run(async () => {
          await confirmCompleteAndRequestRider(currentOrder.sub_id, currentOrder.order_status, currentOrder.payment_status);
        }, 'ยืนยันยอด + ออเดอร์เสร็จแล้ว และส่งคำขอเรียกไรเดอร์แล้ว');
      }
    };

    if (ready) return execute();
    Alert.alert(
      'ยืนยันก่อนเรียกไรเดอร์',
      'ยืนยันยอด และออเดอร์เสร็จเรียบร้อยแล้วใช่ไหม?',
      [
        { text: 'ยังไม่ใช่', style: 'cancel' },
        { text: 'ใช่ · ยืนยันและเรียกไรเดอร์', onPress: () => void execute() },
      ],
    );
  }

  return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}>
    <View style={styles.headerCard}>
      <Text style={styles.eyebrow}>ORDER #{currentOrder.sub_id.slice(0, 6).toUpperCase()}</Text>
      <Text style={styles.customerName}>{customerName}</Text>
      <Text style={styles.orderMeta}>{isDelivery ? 'จัดส่ง' : 'ลูกค้ามารับที่ร้าน'} · {currentOrder.payment_method === 'cash' ? 'เงินสด' : 'QR / โอนตรง'}</Text>
      <View style={styles.contactRow}>
        <Pressable onPress={callCustomer} style={styles.contactButton}><Text style={styles.contactButtonText}>📞 โทรหาลูกค้า</Text></Pressable>
        <Pressable onPress={openChat} style={styles.contactButton}><Text style={styles.contactButtonText}>💬 แชทลูกค้า</Text></Pressable>
      </View>
    </View>

    {currentOrder.requested_for ? <View style={styles.preorderCard}><Text style={styles.preorderTitle}>🗓️ สั่งล่วงหน้า</Text><Text style={styles.preorderText}>{isDelivery ? 'ส่ง' : 'รับ'} {formatRequestedFor(currentOrder.requested_for)}</Text></View> : null}
    {message ? <View style={styles.successBox}><Text style={styles.successText}>✓ {message}</Text></View> : null}
    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>สถานะออเดอร์</Text>
      <View style={styles.statusGrid}>
        <StatusButton label={ORDER_LABEL[currentOrder.order_status] ?? currentOrder.order_status} tone={currentOrder.order_status === 'completed' ? 'green' : currentOrder.order_status === 'cancelled' ? 'red' : 'amber'} />
        <StatusButton label={PAYMENT_LABEL[currentOrder.payment_status] ?? currentOrder.payment_status} tone={currentOrder.payment_status === 'paid' ? 'green' : 'blue'} />
        {deliveryText ? <StatusButton label={deliveryText} tone={currentOrder.delivery_status === 'delivered' ? 'green' : currentOrder.delivery_status === 'failed' ? 'red' : 'purple'} wide /> : null}
      </View>
      {isDelivery && riderFlowStarted ? <Text style={styles.syncNote}>สถานะการจัดส่งหลังจากนี้เปลี่ยนจาก Rider โดยอัตโนมัติ ร้านไม่ต้องกด “รับสินค้า” หรือ “ส่งสำเร็จ”</Text> : null}
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>รายการอาหาร</Text>
      {currentOrder.order_items.map((item, index) => <View key={`${item.item_name_snapshot}-${index}`} style={styles.itemRow}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.item_name_snapshot}</Text><Text style={styles.qty}>จำนวน {item.qty}</Text></View><Text style={styles.lineTotal}>฿{Number(item.line_total).toFixed(0)}</Text></View>)}
      <View style={styles.totalRow}><Text style={styles.totalLabel}>รวม</Text><Text style={styles.total}>฿{Number(currentOrder.amount).toFixed(0)}</Text></View>
    </View>

    {currentOrder.payment_slip_url ? <View style={styles.card}>
      <Text style={styles.sectionTitle}>สลิปจากลูกค้า</Text>
      <Image source={{ uri: currentOrder.payment_slip_url }} style={styles.slip} resizeMode="cover" />
      <Pressable onPress={() => void Linking.openURL(currentOrder.payment_slip_url!)} style={styles.secondaryButton}><Text style={styles.secondaryText}>ดูรูปเต็ม</Text></Pressable>
      {currentOrder.payment_status !== 'paid' ? <Pressable disabled={acting} onPress={() => void run(() => confirmShopPayment(currentOrder.sub_id), 'ยืนยันยอดแล้ว')} style={styles.paymentButton}><Text style={styles.paymentButtonText}>✓ ยืนยันยอด</Text></Pressable> : <Text style={styles.confirmedText}>✓ ยืนยันยอดแล้ว</Text>}
    </View> : currentOrder.payment_method === 'qr_transfer' ? <View style={styles.card}><Text style={styles.sectionTitle}>สลิปจากลูกค้า</Text><Text style={styles.muted}>ลูกค้ายังไม่ได้แนบสลิป</Text></View> : null}

    {currentOrder.delivery_address ? <View style={styles.card}><Text style={styles.sectionTitle}>ที่อยู่จัดส่ง</Text><Text style={styles.body}>{currentOrder.delivery_address}</Text></View> : null}
    {currentOrder.customer_note ? <View style={styles.card}><Text style={styles.sectionTitle}>หมายเหตุจากลูกค้า</Text><Text style={styles.body}>{currentOrder.customer_note}</Text></View> : null}

    {currentOrder.order_status !== 'cancelled' && currentOrder.order_status !== 'completed' ? <View style={styles.card}>
      <Text style={styles.sectionTitle}>จัดการออเดอร์</Text>
      <Text style={styles.helper}>เปลี่ยนสถานะด้วยปุ่มสี ไม่ใช้ Dropdown</Text>
      {currentOrder.order_status === 'pending' ? <ActionButton label="รับออเดอร์" disabled={acting} onPress={() => void run(() => acceptShopOrder(currentOrder.sub_id), 'รับออเดอร์แล้ว')} /> : null}
      {currentOrder.order_status === 'confirmed' ? <ActionButton label="เริ่มทำ" disabled={acting} onPress={() => void run(() => setShopOrderStatus(currentOrder.sub_id, 'preparing'), 'เปลี่ยนเป็นกำลังทำแล้ว')} /> : null}
      {currentOrder.order_status === 'preparing' ? <ActionButton label="อาหารเสร็จแล้ว" disabled={acting} onPress={() => void run(() => setShopOrderStatus(currentOrder.sub_id, 'completed'), 'ออเดอร์เสร็จแล้ว')} /> : null}
    </View> : null}

    {isDelivery ? <View style={styles.riderCard}>
      <Text style={styles.sectionTitle}>🛵 การจัดส่ง</Text>
      {!DELIVERY_V3_ENABLED ? <Text style={styles.helper}>Rider Delivery V3 ยังไม่เปิดใน build นี้</Text> : riderFlowStarted ? <>
        <StatusButton label={deliveryText || 'กำลังจัดส่ง'} tone={currentOrder.delivery_status === 'delivered' ? 'green' : 'purple'} wide />
        <Text style={styles.helper}>Shop Request → Rider First Accept → Auto Lock → Shop Notified → Pickup → Delivered</Text>
      </> : <>
        <Text style={styles.helper}>เมื่อกดเรียกไรเดอร์ ระบบตรวจ “ยืนยันยอด” และ “อาหารเสร็จแล้ว” ก่อน หากยังไม่ครบจะถามยืนยันครั้งเดียว แล้วส่งคำขอ Rider ต่ออัตโนมัติ</Text>
        <Pressable disabled={!canRequestRider || acting} onPress={() => void requestRiderReadyFlow()} style={({ pressed }) => [styles.riderButton, (!canRequestRider || acting) && styles.disabled, pressed && styles.pressed]}>{acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.riderButtonText}>เรียกไรเดอร์</Text>}</Pressable>
      </>}
    </View> : null}
  </ScrollView>;
}

function StatusButton({ label, tone, wide = false }: { label: string; tone: 'green' | 'amber' | 'blue' | 'purple' | 'red'; wide?: boolean }) {
  return <View style={[styles.statusButton, wide && styles.statusWide, styles[`status_${tone}`]]}><Text style={[styles.statusText, styles[`statusText_${tone}`]]}>{label}</Text></View>;
}

function ActionButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.actionButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 16, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' }, muted: { color: '#718078', marginTop: 5 }, error: { color: '#A13A36' },
  headerCard: { padding: 18, borderRadius: 24, backgroundColor: '#12261E' }, eyebrow: { color: '#65D3A9', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, customerName: { marginTop: 6, color: '#fff', fontSize: 25, fontWeight: '900' }, orderMeta: { marginTop: 5, color: '#B9CAC2', fontSize: 12 }, contactRow: { flexDirection: 'row', gap: 8, marginTop: 14 }, contactButton: { flex: 1, minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24483A' }, contactButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  preorderCard: { padding: 14, borderRadius: 18, backgroundColor: '#F3ECFF', borderWidth: 1, borderColor: '#DECDF8' }, preorderTitle: { color: '#68459A', fontWeight: '900' }, preorderText: { marginTop: 4, color: '#7654A4', fontSize: 12 }, successBox: { padding: 12, borderRadius: 14, backgroundColor: '#E8F7F0' }, successText: { color: '#0F7653', fontWeight: '800' }, errorBox: { padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' },
  card: { padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, sectionTitle: { color: '#12261E', fontSize: 16, fontWeight: '900' }, body: { marginTop: 8, color: '#52645C', fontSize: 13, lineHeight: 20 }, helper: { marginTop: 7, color: '#7C8B83', fontSize: 11, lineHeight: 17 }, syncNote: { marginTop: 10, color: '#567065', fontSize: 11, lineHeight: 17 },
  statusGrid: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, statusButton: { minWidth: '47%', minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, statusWide: { width: '100%' }, statusText: { fontWeight: '900', fontSize: 12 }, status_green: { backgroundColor: '#E5F7EF' }, statusText_green: { color: '#0F7653' }, status_amber: { backgroundColor: '#FFF3D7' }, statusText_amber: { color: '#806018' }, status_blue: { backgroundColor: '#E8F3FA' }, statusText_blue: { color: '#25657E' }, status_purple: { backgroundColor: '#F0E9FA' }, statusText_purple: { color: '#68459A' }, status_red: { backgroundColor: '#FFEDEC' }, statusText_red: { color: '#A13A36' },
  itemRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF1EF' }, itemName: { color: '#344A41', fontWeight: '800' }, qty: { marginTop: 3, color: '#8A9891', fontSize: 11 }, lineTotal: { color: '#12261E', fontWeight: '900' }, totalRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#DDE5E1', flexDirection: 'row', justifyContent: 'space-between' }, totalLabel: { color: '#12261E', fontWeight: '900', fontSize: 16 }, total: { color: '#12261E', fontWeight: '900', fontSize: 20 },
  slip: { width: '100%', height: 260, marginTop: 12, borderRadius: 16, backgroundColor: '#EDF1EF' }, secondaryButton: { marginTop: 10, minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF3F1' }, secondaryText: { color: '#50635A', fontWeight: '800' }, paymentButton: { marginTop: 9, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, paymentButtonText: { color: '#fff', fontWeight: '900' }, confirmedText: { marginTop: 11, color: '#0F7653', fontWeight: '900', textAlign: 'center' },
  actionButton: { marginTop: 10, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0A33A' }, actionButtonText: { color: '#fff', fontWeight: '900' }, riderCard: { padding: 16, borderRadius: 22, backgroundColor: '#EAF5FA', borderWidth: 1, borderColor: '#CCE6F1' }, riderButton: { marginTop: 13, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176985' }, riderButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
});
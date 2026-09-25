import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { loadShopOrders } from '../src/data/shopOrders';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import type { ShopOrder } from '../src/domain/orders';

type RangeKey = 'today' | '7d' | '30d' | '1y' | 'lifetime';
const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d', label: '7 วัน' },
  { key: '30d', label: '30 วัน' },
  { key: '1y', label: '1 ปี' },
  { key: 'lifetime', label: 'ตลอดอายุร้าน' },
];

function inRange(value: string, range: RangeKey) {
  if (range === 'lifetime') return true;
  const created = new Date(value).getTime();
  const now = new Date();
  if (range === 'today') {
    const d = new Date(value);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 365;
  return created >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

function money(value: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value || 0);
}

export default function AnalyticsScreen() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [range, setRange] = useState<RangeKey>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      setOrders(await loadShopOrders(shop.shop_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดสถิติร้านไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const scoped = useMemo(() => orders.filter((order) => inRange(order.created_at, range)), [orders, range]);
  const completed = useMemo(() => scoped.filter((order) => order.order_status === 'completed'), [scoped]);
  const cancelled = useMemo(() => scoped.filter((order) => order.order_status === 'cancelled'), [scoped]);
  const revenue = useMemo(() => completed.reduce((sum, order) => sum + Number(order.amount || 0), 0), [completed]);
  const avgOrder = completed.length ? revenue / completed.length : 0;
  const deliveryCount = scoped.filter((order) => order.fulfillment_type === 'delivery').length;
  const pickupCount = scoped.filter((order) => order.fulfillment_type === 'pickup').length;

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดสถิติ…</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>ANALYTICS</Text>
    <Text style={styles.title}>สถิติร้าน</Text>
    <Text style={styles.subtitle}>ดูภาพรวมยอดขายและออเดอร์ตามช่วงเวลาที่ต้องการ</Text>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeRow}>
      {RANGES.map((item) => <Pressable key={item.key} onPress={() => setRange(item.key)} style={[styles.rangeButton, range === item.key && styles.rangeActive]}><Text style={[styles.rangeText, range === item.key && styles.rangeTextActive]}>{item.label}</Text></Pressable>)}
    </ScrollView>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.grid}>
      <Metric label="ยอดขาย" value={`฿${money(revenue)}`} note="เฉพาะออเดอร์สำเร็จ" dark />
      <Metric label="ออเดอร์ทั้งหมด" value={String(scoped.length)} note={`${completed.length} สำเร็จ`} />
      <Metric label="ยอดเฉลี่ย/ออเดอร์" value={`฿${money(avgOrder)}`} note="จากออเดอร์สำเร็จ" />
      <Metric label="ยกเลิก" value={String(cancelled.length)} note={scoped.length ? `${Math.round((cancelled.length / scoped.length) * 100)}% ของออเดอร์` : '0%'} warm />
      <Metric label="Delivery" value={String(deliveryCount)} note="ออเดอร์จัดส่ง" blue />
      <Metric label="รับที่ร้าน" value={String(pickupCount)} note="Pickup" />
    </View>

    <View style={styles.infoCard}><Text style={styles.infoTitle}>ข้อมูลชุดนี้</Text><Text style={styles.infoText}>อ่านจาก sub_orders จริงของร้านตามสิทธิ์ RLS ไม่มี mock data และใช้สถานะออเดอร์กลางเดียวกับ Customer / Shop / Rider</Text></View>
  </ScrollView>;
}

function Metric({ label, value, note, dark = false, warm = false, blue = false }: { label: string; value: string; note: string; dark?: boolean; warm?: boolean; blue?: boolean }) {
  return <View style={[styles.metric, dark && styles.metricDark, warm && styles.metricWarm, blue && styles.metricBlue]}><Text style={[styles.metricLabel, dark && styles.textLight]}>{label}</Text><Text style={[styles.metricValue, dark && styles.valueLight]}>{value}</Text><Text style={[styles.metricNote, dark && styles.noteLight]}>{note}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' }, muted: { color: '#718078' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 20 },
  rangeRow: { gap: 8, paddingVertical: 17 }, rangeButton: { paddingHorizontal: 14, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EFEC' }, rangeActive: { backgroundColor: '#0F8A5F' }, rangeText: { color: '#5E7067', fontSize: 12, fontWeight: '800' }, rangeTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, metric: { width: '48.5%', minHeight: 125, marginBottom: 10, borderRadius: 21, padding: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, metricDark: { backgroundColor: '#12261E', borderColor: '#12261E' }, metricWarm: { backgroundColor: '#FFF3D7', borderColor: '#F0D99B' }, metricBlue: { backgroundColor: '#E8F3FA', borderColor: '#CFE5F0' },
  metricLabel: { color: '#75847C', fontSize: 11, fontWeight: '800' }, metricValue: { marginTop: 8, color: '#12261E', fontSize: 27, fontWeight: '900' }, metricNote: { marginTop: 4, color: '#95A099', fontSize: 10 }, textLight: { color: '#C6D4CE' }, valueLight: { color: '#fff' }, noteLight: { color: '#9FB1A9' },
  infoCard: { marginTop: 8, padding: 16, borderRadius: 20, backgroundColor: '#EEF4F1' }, infoTitle: { color: '#29483C', fontWeight: '900' }, infoText: { marginTop: 5, color: '#6B7D74', fontSize: 11, lineHeight: 17 }, errorBox: { marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' },
});

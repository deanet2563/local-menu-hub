import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import {
  getActiveAssignedDelivery,
  markDeliveryPickedUp,
  type AssignedDelivery,
} from '@/data/assignedDeliveryRepository';

function mapsUrl(input: { lat?: number | null; lng?: number | null; address?: string | null }) {
  if (input.lat != null && input.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${input.lat},${input.lng}`;
  }
  if (input.address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.address.trim())}`;
  }
  return null;
}

function jobDateTime(createdAt: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(createdAt));
}

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [job, setJob] = useState<AssignedDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (saved: RiderSession, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const active = await getActiveAssignedDelivery(saved);
      setJob(active);
      setMessage(active ? null : 'ยังไม่มีงานที่ร้านเลือกให้คุณ');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const saved = await loadRiderSession();
      if (!saved || !isSessionFresh(saved)) {
        setLoading(false);
        setMessage('ต้องเข้าสู่ระบบ Rider ก่อนดูงานปัจจุบัน');
        return;
      }
      setSession(saved);
      await load(saved);
    })();
  }, [load]);

  async function refresh() {
    if (!session) return;
    await load(session, true);
  }

  async function pickedUp() {
    if (!session || !job || updating || job.delivery_status !== 'rider_called') return;
    setUpdating(true);
    setMessage(null);
    try {
      await markDeliveryPickedUp(session, job.sub_id);
      await load(session);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUpdating(false);
    }
  }

  async function openNavigation(url: string | null) {
    if (!url) {
      setMessage('ยังไม่มีพิกัด/ที่อยู่สำหรับนำทาง');
      return;
    }
    await Linking.openURL(url);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.loading}>กำลังโหลดงานปัจจุบัน...</Text>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <Text style={styles.emptyTitle}>ไม่มีงานปัจจุบัน</Text>
          <Text style={styles.message}>{message ?? 'เมื่อร้านเลือกคุณ งานจะปรากฏที่นี่'}</Text>
          <Text style={styles.refreshHint}>ลากหน้าจอลงเพื่ออัปเดต</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const shopMap = mapsUrl({ lat: job.shops?.lat, lng: job.shops?.lng, address: job.shops?.address });
  const customerMap = mapsUrl({ address: job.delivery_address });
  const customer = job.hub_orders?.customers;
  const pickedUpState = job.delivery_status === 'picked_up';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ASSIGNED DELIVERY</Text>
          <Text style={styles.title}>{pickedUpState ? 'กำลังนำส่ง' : 'ไปรับอาหารที่ร้าน'}</Text>
          <Text style={styles.time}>{jobDateTime(job.created_at)} · #{job.sub_id.slice(0, 6).toUpperCase()}</Text>
          <Text style={styles.status}>{job.delivery_status}</Text>
        </View>

        {(job.delivery_fee != null || job.delivery_distance_km != null) && (
          <View style={styles.feeCard}>
            {job.delivery_distance_km != null && (
              <Text style={styles.routeText}>ร้าน → ลูกค้า {Number(job.delivery_distance_km).toFixed(1)} กม.</Text>
            )}
            {job.delivery_fee != null && <Text style={styles.feeText}>ค่าส่ง ฿{Number(job.delivery_fee).toFixed(0)}</Text>}
            {job.delivery_fee_payer && (
              <Text style={styles.payerText}>
                {job.delivery_fee_payer === 'shop' ? 'เก็บค่าส่งจากร้าน' : 'เก็บค่าส่งจากลูกค้า'}
              </Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>จุดรับสินค้า</Text>
          <Text style={styles.primaryText}>{job.shops?.name ?? job.shop_id}</Text>
          {job.shops?.address && <Text style={styles.secondaryText}>{job.shops.address}</Text>}
          <View style={styles.row}>
            {job.shops?.phone && (
              <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(`tel:${job.shops?.phone}`)}>
                <Text style={styles.secondaryButtonText}>โทรหาร้าน</Text>
              </Pressable>
            )}
            <Pressable style={styles.navButton} onPress={() => openNavigation(shopMap)}>
              <Text style={styles.navButtonText}>นำทางไปร้าน</Text>
            </Pressable>
          </View>
        </View>

        {pickedUpState ? (
          <View style={styles.deliveryCard}>
            <Text style={styles.sectionLabel}>จุดส่งลูกค้า</Text>
            <Text style={styles.primaryText}>{customer?.name ?? 'ลูกค้า'}</Text>
            {job.delivery_address && <Text style={styles.secondaryText}>{job.delivery_address}</Text>}
            <View style={styles.row}>
              {customer?.phone && (
                <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
                  <Text style={styles.secondaryButtonText}>โทรหาลูกค้า</Text>
                </Pressable>
              )}
              <Pressable style={styles.navButton} onPress={() => openNavigation(customerMap)}>
                <Text style={styles.navButtonText}>นำทางไปจุดส่ง</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.privacyCard}>
            <Text style={styles.privacyTitle}>จุดส่งถูกผูกกับงานนี้แล้ว</Text>
            <Text style={styles.privacyText}>
              ก่อนรับสินค้า ระบบยังซ่อนชื่อและเบอร์ลูกค้า แต่ข้อมูลระยะทางและค่าส่งใช้ตัดสินใจรับงานตั้งแต่หน้า Nearby Jobs แล้ว
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>รายการสินค้า</Text>
          {job.order_items.map((item) => (
            <Text key={`${item.item_name_snapshot}-${item.qty}`} style={styles.secondaryText}>
              {item.item_name_snapshot} × {item.qty}
            </Text>
          ))}
          <Text style={styles.amount}>ยอดสินค้า ฿{job.amount}</Text>
        </View>

        {job.delivery_status === 'rider_called' && (
          <Pressable
            accessibilityRole="button"
            disabled={updating}
            style={[styles.primaryButton, updating && styles.disabled]}
            onPress={pickedUp}
          >
            <Text style={styles.primaryButtonText}>{updating ? 'กำลังอัปเดต...' : 'รับสินค้าแล้ว — เริ่มนำส่ง'}</Text>
          </Pressable>
        )}

        {pickedUpState && (
          <View style={styles.proofCard}>
            <Text style={styles.proofTitle}>Proof of Delivery</Text>
            <Text style={styles.proofText}>
              กล้อง Native พร้อมทดสอบแบบ local preview แล้ว ส่วน upload/ปิดงานยังล็อกไว้จนกว่า private Storage policy จะผ่าน gate
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.proofButton}
              onPress={() => router.push({ pathname: '/proof-delivery', params: { subId: job.sub_id } })}
            >
              <Text style={styles.proofButtonText}>ถ่ายรูปยืนยันการส่ง</Text>
            </Pressable>
          </View>
        )}

        {message && <Text style={styles.message}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, gap: 14, paddingBottom: 32 },
  loading: { margin: 24, fontSize: 14, color: '#667085' },
  empty: { flexGrow: 1, padding: 24, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1D2939' },
  refreshHint: { marginTop: 8, fontSize: 12, color: '#98A2B3' },
  header: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 28, fontWeight: '800', color: '#112235' },
  time: { fontSize: 12, fontWeight: '700', color: '#667085' },
  status: { fontSize: 13, fontWeight: '700', color: '#F79009' },
  feeCard: { gap: 3, padding: 14, borderRadius: 14, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  routeText: { fontSize: 16, fontWeight: '800', color: '#067647' },
  feeText: { fontSize: 22, fontWeight: '900', color: '#B54708' },
  payerText: { fontSize: 13, fontWeight: '800', color: '#344054' },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  deliveryCard: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#EFF8FF', borderWidth: 1, borderColor: '#B2DDFF' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#667085' },
  primaryText: { fontSize: 18, fontWeight: '800', color: '#1D2939' },
  secondaryText: { fontSize: 14, lineHeight: 20, color: '#475467' },
  amount: { marginTop: 6, fontSize: 14, fontWeight: '800', color: '#344054' },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  secondaryButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: '#F2F4F7' },
  secondaryButtonText: { fontWeight: '700', color: '#344054' },
  navButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: '#163E72' },
  navButtonText: { fontWeight: '800', color: '#FFFFFF' },
  primaryButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#F79009' },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
  privacyCard: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  privacyTitle: { fontSize: 14, fontWeight: '800', color: '#93370D' },
  privacyText: { fontSize: 13, lineHeight: 19, color: '#854A0E' },
  proofCard: { gap: 8, padding: 14, borderRadius: 14, backgroundColor: '#F9F5FF', borderWidth: 1, borderColor: '#D6BBFB' },
  proofTitle: { fontSize: 14, fontWeight: '800', color: '#53389E' },
  proofText: { fontSize: 13, lineHeight: 19, color: '#6941C6' },
  proofButton: { alignItems: 'center', marginTop: 4, paddingVertical: 11, borderRadius: 12, backgroundColor: '#6941C6' },
  proofButtonText: { fontWeight: '800', color: '#FFFFFF' },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
});

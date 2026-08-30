import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
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

function statusMeta(status: string) {
  switch (status) {
    case 'rider_called':
      return { label: 'กำลังไปรับสินค้า', caption: 'ร้านกำลังรอคุณไปรับออเดอร์', tone: 'pickup' as const, step: 1 };
    case 'picked_up':
      return { label: 'กำลังนำส่ง', caption: 'รับสินค้าแล้ว กรุณานำส่งให้ลูกค้า', tone: 'delivery' as const, step: 2 };
    case 'delivered':
      return { label: 'ส่งสำเร็จ', caption: 'งานนี้ส่งถึงลูกค้าเรียบร้อยแล้ว', tone: 'done' as const, step: 3 };
    default:
      return { label: 'กำลังดำเนินงาน', caption: 'สถานะงานกำลังอัปเดตจากระบบ', tone: 'pickup' as const, step: 1 };
  }
}

const STEPS = ['รับงานแล้ว', 'ไปรับสินค้า', 'นำส่ง', 'ส่งสำเร็จ'];

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [job, setJob] = useState<AssignedDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (saved: RiderSession) => {
    setLoading(true);
    try {
      const active = await getActiveAssignedDelivery(saved);
      setJob(active);
      setMessage(active ? null : 'ยังไม่มีงาน Delivery V3 ที่ backend assign ให้คุณ');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const saved = await loadRiderSession();
        if (cancelled) return;
        if (!saved || !isSessionFresh(saved)) {
          setSession(null);
          setJob(null);
          setLoading(false);
          setMessage('ต้องเข้าสู่ระบบ Rider ก่อนดูงานปัจจุบัน');
          return;
        }
        setSession(saved);
        await load(saved);
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function pickedUp() {
    if (!session || !job || updating || job.delivery_status !== 'rider_called' || !riderFeatures.deliveryV3Accept) return;
    setUpdating(true);
    setMessage(null);
    try {
      await markDeliveryPickedUp(session, job.sub_id);
      await load(session);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      if (text === 'unauthorized_rider_session') {
        setMessage('Rider session หมดอายุหรือถูกออกจากระบบ กรุณาเข้าสู่ระบบใหม่');
      } else if (text === 'delivery_not_assigned_to_rider') {
        setMessage('งานนี้ไม่ได้ assign ให้ Rider session ปัจจุบัน กรุณาโหลดงานใหม่');
      } else if (text === 'pickup_transition_not_allowed') {
        setMessage('สถานะงานเปลี่ยนไปแล้ว กรุณาโหลดงานใหม่ก่อนดำเนินการต่อ');
      } else {
        setMessage(text);
      }
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
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>ไม่มีงานปัจจุบัน</Text>
          <Text style={styles.message}>{message ?? 'เมื่อคุณชนะ First Accept งานจะปรากฏที่นี่'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const shopMap = mapsUrl({ lat: job.shops?.lat, lng: job.shops?.lng, address: job.shops?.address });
  const customerMap = mapsUrl({ address: job.delivery_address });
  const customer = job.hub_orders?.customers;
  const pickedUpState = job.delivery_status === 'picked_up';
  const pickupEnabled = riderFeatures.deliveryV3Accept && !updating;
  const status = statusMeta(job.delivery_status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 28, 44) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.eyebrow}>งานปัจจุบัน</Text>
            <View style={[styles.statusChip, styles[`statusChip_${status.tone}`]]}>
              <Text style={[styles.statusChipText, styles[`statusChipText_${status.tone}`]]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.title}>{status.label}</Text>
          <Text style={styles.subtitle}>{status.caption}</Text>

          <View style={styles.progressRow}>
            {STEPS.map((label, index) => {
              const active = index <= status.step;
              return (
                <View key={label} style={styles.progressItem}>
                  <View style={[styles.progressDot, active && styles.progressDotActive]}>
                    <Text style={[styles.progressDotText, active && styles.progressDotTextActive]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.progressLabel, active && styles.progressLabelActive]} numberOfLines={2}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

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
            <Text style={styles.privacyTitle}>ข้อมูลลูกค้าจะแสดงหลังรับสินค้า</Text>
            <Text style={styles.privacyText}>
              เพื่อความเป็นส่วนตัว ระบบจะแสดงจุดส่งและข้อมูลติดต่อของลูกค้าเมื่อคุณยืนยันรับสินค้าแล้ว
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
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>ยอดสินค้า</Text>
            <Text style={styles.amount}>฿{job.amount}</Text>
          </View>
        </View>

        {job.delivery_status === 'rider_called' && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>พร้อมรับสินค้าแล้วใช่ไหม?</Text>
            <Text style={styles.actionHint}>กดยืนยันเมื่อรับสินค้าจากร้านเรียบร้อยแล้ว</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!pickupEnabled}
              style={[styles.primaryButton, !pickupEnabled && styles.disabled]}
              onPress={pickedUp}
            >
              <Text style={styles.primaryButtonText}>
                {updating
                  ? 'กำลังยืนยันกับระบบ...'
                  : riderFeatures.deliveryV3Accept
                    ? 'รับสินค้าแล้ว · เริ่มนำส่ง'
                    : 'Pickup รอ Delivery V3 production gate'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={!riderFeatures.deliveryV3Accept || updating}
              style={[styles.cancelJobButton, (!riderFeatures.deliveryV3Accept || updating) && styles.disabled]}
              onPress={() => router.push({ pathname: '/cancel-delivery', params: { subId: job.sub_id } })}
            >
              <Text style={styles.cancelJobButtonText}>ปล่อยงานนี้</Text>
            </Pressable>
          </View>
        )}

        {pickedUpState && (
          <View style={styles.proofCard}>
            <Text style={styles.proofTitle}>ยืนยันการส่งสินค้า</Text>
            <Text style={styles.proofText}>
              {riderFeatures.deliveryV3Accept
                ? 'เมื่อส่งถึงลูกค้าแล้ว ให้ถ่ายรูปหลักฐานเพื่อปิดงานอย่างปลอดภัย'
                : 'Proof upload และปิดงานยังถูกล็อกไว้จนกว่า Delivery V3 production gate จะเปิด'}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!riderFeatures.deliveryV3Accept}
              style={[styles.proofButton, !riderFeatures.deliveryV3Accept && styles.disabled]}
              onPress={() => router.push({ pathname: '/proof-delivery', params: { subId: job.sub_id } })}
            >
              <Text style={styles.proofButtonText}>
                {riderFeatures.deliveryV3Accept ? 'ถ่ายรูปยืนยันการส่ง' : 'Proof รอ Delivery V3 production gate'}
              </Text>
            </Pressable>
          </View>
        )}

        {message && <Text style={styles.message}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { paddingHorizontal: 18, paddingTop: 16, gap: 14 },
  loading: { margin: 24, fontSize: 14, color: '#667085' },
  empty: { padding: 24, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1D2939' },
  heroCard: { gap: 8, padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: '#246B50' },
  title: { fontSize: 29, fontWeight: '900', color: '#112235' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  statusChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  statusChip_pickup: { backgroundColor: '#FFF4E5' },
  statusChip_delivery: { backgroundColor: '#EAF2FF' },
  statusChip_done: { backgroundColor: '#EAF7EF' },
  statusChipText: { fontSize: 12, fontWeight: '800' },
  statusChipText_pickup: { color: '#B54708' },
  statusChipText_delivery: { color: '#1849A9' },
  statusChipText_done: { color: '#027A48' },
  progressRow: { flexDirection: 'row', marginTop: 12, gap: 5 },
  progressItem: { flex: 1, alignItems: 'center', gap: 6 },
  progressDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  progressDotActive: { backgroundColor: '#246B50' },
  progressDotText: { fontSize: 12, fontWeight: '800', color: '#98A2B3' },
  progressDotTextActive: { color: '#FFFFFF' },
  progressLabel: { fontSize: 10, lineHeight: 13, textAlign: 'center', color: '#98A2B3' },
  progressLabelActive: { color: '#344054', fontWeight: '700' },
  card: { gap: 8, padding: 17, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  deliveryCard: { gap: 8, padding: 17, borderRadius: 18, backgroundColor: '#EFF8FF', borderWidth: 1, borderColor: '#B2DDFF' },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, color: '#667085' },
  primaryText: { fontSize: 19, fontWeight: '850', color: '#1D2939' },
  secondaryText: { fontSize: 14, lineHeight: 20, color: '#475467' },
  amountRow: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EAECF0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 14, fontWeight: '700', color: '#667085' },
  amount: { fontSize: 18, fontWeight: '900', color: '#1D2939' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  secondaryButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 13, backgroundColor: '#F2F4F7' },
  secondaryButtonText: { fontWeight: '700', color: '#344054' },
  navButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 13, backgroundColor: '#163E72' },
  navButtonText: { fontWeight: '800', color: '#FFFFFF' },
  actionCard: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  actionTitle: { fontSize: 16, fontWeight: '800', color: '#1D2939' },
  actionHint: { fontSize: 13, lineHeight: 18, color: '#667085' },
  primaryButton: { alignItems: 'center', paddingVertical: 15, borderRadius: 14, backgroundColor: '#F79009' },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  cancelJobButton: { alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD' },
  cancelJobButtonText: { fontSize: 14, fontWeight: '800', color: '#B42318' },
  disabled: { opacity: 0.5 },
  privacyCard: { gap: 6, padding: 15, borderRadius: 16, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  privacyTitle: { fontSize: 14, fontWeight: '800', color: '#93370D' },
  privacyText: { fontSize: 13, lineHeight: 19, color: '#854A0E' },
  proofCard: { gap: 8, padding: 16, borderRadius: 18, backgroundColor: '#F9F5FF', borderWidth: 1, borderColor: '#D6BBFB' },
  proofTitle: { fontSize: 15, fontWeight: '800', color: '#53389E' },
  proofText: { fontSize: 13, lineHeight: 19, color: '#6941C6' },
  proofButton: { alignItems: 'center', marginTop: 4, paddingVertical: 12, borderRadius: 13, backgroundColor: '#6941C6' },
  proofButtonText: { fontWeight: '800', color: '#FFFFFF' },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
});

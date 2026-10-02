import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { acceptDeliveryV3, listNearbyDeliveryJobs, type NearbyDeliveryJob } from '@/data/nearbyJobsRepository';

function mapUrl(lat: number | null, lng: number | null, fallback?: string | null) {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (fallback?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallback.trim())}`;
  }
  return null;
}

export default function NearbyJobDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subId } = useLocalSearchParams<{ subId: string }>();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [job, setJob] = useState<NearbyDeliveryJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!riderFeatures.deliveryV3Accept) {
        setMessage('Delivery V3 ยังไม่เปิดใน build นี้');
        setLoading(false);
        return;
      }

      if (!subId) {
        setMessage('ไม่พบรหัสงาน');
        setLoading(false);
        return;
      }

      const saved = await loadRiderSession();
      if (!saved || !isSessionFresh(saved)) {
        setMessage('ต้องเข้าสู่ระบบ Rider ก่อนดูงาน');
        setLoading(false);
        return;
      }

      setSession(saved);
      try {
        const jobs = await listNearbyDeliveryJobs(saved, 5);
        const found = jobs.find((item) => item.sub_id === subId) ?? null;
        setJob(found);
        if (!found) {
          setMessage('งานนี้ไม่อยู่ในรายการที่พร้อมรับแล้ว หรืออยู่นอกระยะของคุณ');
        }
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    })();
  }, [subId]);

  async function openUrl(url: string | null, fallbackMessage: string) {
    if (!url) {
      setMessage(fallbackMessage);
      return;
    }
    await Linking.openURL(url);
  }

  async function acceptJob() {
    if (!session || !job || accepting) return;
    setAccepting(true);
    setMessage(null);
    try {
      const result = await acceptDeliveryV3(session, job.sub_id);
      if (result.result === 'job_already_taken') {
        setJob(null);
        setMessage('งานนี้มี Rider คนอื่นรับไปแล้ว กรุณาเลือกงานอื่น');
        return;
      }
      router.replace('/active-delivery');
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      if (text === 'fresh_rider_location_required') {
        setMessage('ตำแหน่ง Rider เก่าเกินไป กรุณากลับหน้าหลักเพื่ออัปเดตตำแหน่งแล้วลองใหม่');
      } else if (text === 'rider_already_has_active_delivery') {
        setMessage('คุณมีงานที่กำลังจัดส่งอยู่แล้ว กรุณาจบงานปัจจุบันก่อนรับงานใหม่');
      } else if (text === 'unauthorized_rider_session') {
        setMessage('Rider session หมดอายุหรือถูกออกจากระบบ กรุณาเข้าสู่ระบบใหม่');
      } else {
        setMessage(text);
      }
    } finally {
      setAccepting(false);
    }
  }

  const shopMap = job ? mapUrl(job.shop_lat, job.shop_lng, job.shop_address) : null;
  const destinationMap = job
    ? mapUrl(job.delivery_destination_lat, job.delivery_destination_lng, job.delivery_address)
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 28, 44) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>งานส่งแบบรับก่อนล็อกก่อน</Text>
          <Text style={styles.title}>{job?.shop_name ?? 'รายละเอียดงาน'}</Text>
          <Text style={styles.subtitle}>ตรวจต้นทาง ปลายทาง ระยะทาง และค่าขนส่งก่อนตัดสินใจรับงาน</Text>
        </View>

        {loading && <Text style={styles.message}>กำลังโหลดรายละเอียด...</Text>}

        {job && (
          <>
            <View style={styles.priceCard}>
              <View>
                <Text style={styles.priceLabel}>ค่าขนส่งโดยประมาณ</Text>
                <Text style={styles.priceHint}>อัตราปัจจุบัน 10 บาท/กม. · ร้าน → ลูกค้า</Text>
              </View>
              <Text style={styles.priceValue}>
                {job.delivery_fee == null ? '—' : `฿${Number(job.delivery_fee).toFixed(2)}`}
              </Text>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>คุณ → ร้าน</Text>
                <Text style={styles.metricValue}>{Number(job.distance_to_shop_km).toFixed(2)} กม.</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>ร้าน → ลูกค้า</Text>
                <Text style={styles.metricValue}>
                  {job.shop_to_customer_km == null ? '—' : `${Number(job.shop_to_customer_km).toFixed(2)} กม.`}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>จุดรับสินค้า</Text>
              <Text style={styles.value}>{job.shop_name}</Text>
              <Text style={styles.address}>{job.shop_address ?? 'ยังไม่ได้ระบุที่อยู่ร้าน'}</Text>
              <Pressable accessibilityRole="button" style={styles.mapButton} onPress={() => openUrl(shopMap, 'ยังไม่มีพิกัดร้าน')}>
                <Text style={styles.mapButtonText}>ดูตำแหน่งร้าน</Text>
              </Pressable>
            </View>

            <View style={styles.destinationCard}>
              <Text style={styles.label}>ปลายทางลูกค้า</Text>
              <Text style={styles.value}>จุดส่งสินค้า</Text>
              <Text style={styles.address}>{job.delivery_address ?? 'ยังไม่ได้ระบุที่อยู่ปลายทาง'}</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.destinationButton}
                onPress={() => openUrl(destinationMap, 'ยังไม่มีพิกัด/ที่อยู่ปลายทาง')}
              >
                <Text style={styles.destinationButtonText}>ดูปลายทางบนแผนที่</Text>
              </Pressable>
              <Text style={styles.privacyNote}>แสดงเฉพาะข้อมูลปลายทางที่จำเป็นต่อการตัดสินใจรับงาน ชื่อและเบอร์โทรลูกค้ายังซ่อนจนกว่าจะรับงานสำเร็จ</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!session || accepting}
              onPress={acceptJob}
              style={[styles.acceptButton, accepting && styles.disabledButton]}
            >
              <Text style={styles.acceptButtonText}>{accepting ? 'กำลังล็อกงาน...' : 'รับงานนี้'}</Text>
            </Pressable>
          </>
        )}

        {message && <Text style={styles.message}>{message}</Text>}

        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>กลับ</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, gap: 14 },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 28, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  priceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  priceLabel: { fontSize: 13, fontWeight: '800', color: '#027A48' },
  priceHint: { marginTop: 3, fontSize: 11, color: '#039855' },
  priceValue: { fontSize: 26, fontWeight: '900', color: '#027A48' },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, padding: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  metricLabel: { fontSize: 11, color: '#667085' },
  metricValue: { marginTop: 4, fontSize: 16, fontWeight: '800', color: '#344054' },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  destinationCard: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#D0D5DD' },
  label: { fontSize: 12, fontWeight: '800', color: '#667085' },
  value: { fontSize: 19, fontWeight: '800', color: '#1D2939' },
  address: { fontSize: 14, lineHeight: 20, color: '#475467' },
  mapButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EEF4FF' },
  mapButtonText: { fontWeight: '700', color: '#163E72' },
  destinationButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EAF7EF' },
  destinationButtonText: { fontWeight: '700', color: '#067647' },
  privacyNote: { fontSize: 11, lineHeight: 16, color: '#667085' },
  acceptButton: { alignItems: 'center', paddingVertical: 15, borderRadius: 14, backgroundColor: '#067647' },
  acceptButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  disabledButton: { opacity: 0.6 },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  backButton: { alignItems: 'center', paddingVertical: 10 },
  backButtonText: { fontWeight: '700', color: '#475467' },
});

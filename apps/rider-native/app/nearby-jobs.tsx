import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { listNearbyDeliveryJobs, type NearbyDeliveryJob } from '@/data/nearbyJobsRepository';
import { getRiderProfile } from '@/data/riderRepository';

const RADII = [1, 2, 3, 5] as const;

function requestTime(job: NearbyDeliveryJob) {
  const raw = job.offer_requested_at ?? job.confirmed_at;
  return raw ? new Date(raw).getTime() : 0;
}

function feeText(job: NearbyDeliveryJob) {
  if (job.delivery_fee == null) return 'รอพิกัดปลายทาง';
  return `฿${Number(job.delivery_fee).toFixed(2)}`;
}

export default function NearbyJobsScreen() {
  const router = useRouter();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [jobs, setJobs] = useState<NearbyDeliveryJob[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const radius = RADII[radiusIndex];

  async function loadJobs(activeSession: RiderSession, requestedRadius = radius) {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await listNearbyDeliveryJobs(activeSession, requestedRadius);
      setJobs([...rows].sort((a, b) => requestTime(b) - requestTime(a)));
      if (!rows.length) setMessage(`ยังไม่มีงานในระยะ ${requestedRadius} กม.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      if (!riderFeatures.deliveryV3Accept) {
        setLoading(false);
        setMessage('Delivery V3 ยังไม่เปิดใน build นี้');
        return;
      }

      const saved = await loadRiderSession();
      if (!saved || !isSessionFresh(saved)) {
        setLoading(false);
        setMessage('ต้องเข้าสู่ระบบ Rider ก่อนดูงานใกล้คุณ');
        return;
      }

      const rider = await getRiderProfile(saved);
      if (!rider?.is_online) {
        setLoading(false);
        setMessage('เปิด Online ที่หน้าหลักก่อนดูงานใกล้คุณ');
        return;
      }

      setSession(saved);
      await loadJobs(saved, RADII[0]);
    })();
  }, []);

  async function expandRadius() {
    if (!session || radiusIndex >= RADII.length - 1) return;
    const nextIndex = radiusIndex + 1;
    setRadiusIndex(nextIndex);
    await loadJobs(session, RADII[nextIndex]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DELIVERY V3 · FIRST ACCEPT</Text>
          <Text style={styles.title}>งานใกล้ฉัน</Text>
          <Text style={styles.subtitle}>
            งานที่ร้านเรียกล่าสุดจะแสดงก่อน ดูระยะทางถึงร้าน ปลายทาง และค่าขนส่งก่อนตัดสินใจรับงาน
          </Text>
        </View>

        <View style={styles.radiusCard}>
          <Text style={styles.radiusText}>ค้นหาในระยะ {radius} กม. จากตำแหน่งล่าสุด</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!session || radiusIndex >= RADII.length - 1 || loading}
            onPress={expandRadius}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {radiusIndex >= RADII.length - 1 ? 'ระยะสูงสุด 5 กม.' : 'ขยายระยะค้นหา'}
            </Text>
          </Pressable>
        </View>

        {loading && <Text style={styles.message}>กำลังค้นหางาน...</Text>}
        {message && <Text style={styles.message}>{message}</Text>}

        {jobs.map((job) => (
          <View key={job.sub_id} style={styles.jobCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.shopName}>{job.shop_name}</Text>
                <Text style={styles.shopAddress}>{job.shop_address ?? 'ร้านยังไม่ได้ระบุที่อยู่'}</Text>
              </View>
              <View style={styles.feeBadge}>
                <Text style={styles.feeLabel}>ค่าขนส่ง</Text>
                <Text style={styles.feeValue}>{feeText(job)}</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>คุณ → ร้าน</Text>
                <Text style={styles.metricValue}>{Number(job.distance_to_shop_km).toFixed(2)} กม.</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>ร้าน → ลูกค้า</Text>
                <Text style={styles.metricValue}>
                  {job.shop_to_customer_km == null ? 'ยังไม่มีพิกัด' : `${Number(job.shop_to_customer_km).toFixed(2)} กม.`}
                </Text>
              </View>
            </View>

            {job.delivery_address && (
              <Text style={styles.destination} numberOfLines={2}>ปลายทาง: {job.delivery_address}</Text>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/job-detail/[subId]', params: { subId: job.sub_id } })}
              style={styles.detailButton}
            >
              <Text style={styles.detailButtonText}>ดูรายละเอียดและรับงาน</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, paddingBottom: 42, gap: 14 },
  header: { gap: 6, marginBottom: 4 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 28, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  radiusCard: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF' },
  radiusText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  secondaryButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EEF4FF' },
  secondaryButtonText: { color: '#163E72', fontWeight: '700' },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  jobCard: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitleWrap: { flex: 1, gap: 5 },
  shopName: { fontSize: 18, fontWeight: '800', color: '#1D2939' },
  shopAddress: { fontSize: 13, lineHeight: 19, color: '#667085' },
  feeBadge: { minWidth: 92, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#ECFDF3', alignItems: 'flex-end' },
  feeLabel: { fontSize: 10, fontWeight: '700', color: '#027A48' },
  feeValue: { marginTop: 2, fontSize: 17, fontWeight: '900', color: '#027A48' },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricBox: { flex: 1, padding: 11, borderRadius: 12, backgroundColor: '#F8FAFC' },
  metricLabel: { fontSize: 11, color: '#667085' },
  metricValue: { marginTop: 3, fontSize: 14, fontWeight: '800', color: '#344054' },
  destination: { fontSize: 13, lineHeight: 19, color: '#475467' },
  detailButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F2F4F7' },
  detailButtonText: { fontWeight: '800', color: '#344054' },
});

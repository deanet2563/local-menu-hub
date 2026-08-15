import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import {
  expressDeliveryInterest,
  listNearbyDeliveryJobs,
  type NearbyDeliveryJob,
} from '@/data/nearbyJobsRepository';
import { getRiderProfile } from '@/data/riderRepository';

const RADII = [1, 2, 3, 5] as const;

function jobTime(job: NearbyDeliveryJob) {
  const raw = job.confirmed_at ?? job.created_at;
  if (!raw) return 'ไม่ระบุเวลา';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(raw));
}

function shortJobId(subId: string) {
  return subId.slice(0, 6).toUpperCase();
}

function payerText(payer: NearbyDeliveryJob['delivery_fee_payer']) {
  if (payer === 'shop') return 'เก็บค่าส่งจากร้าน';
  if (payer === 'customer') return 'เก็บค่าส่งจากลูกค้า';
  return null;
}

export default function NearbyJobsScreen() {
  const router = useRouter();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [jobs, setJobs] = useState<NearbyDeliveryJob[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [interestedSubId, setInterestedSubId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const radius = RADII[radiusIndex];

  const loadJobs = useCallback(async (activeSession: RiderSession, requestedRadius: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const rows = await listNearbyDeliveryJobs(activeSession, requestedRadius);
      const sorted = [...rows].sort((a, b) => {
        const at = new Date(a.confirmed_at ?? a.created_at ?? 0).getTime();
        const bt = new Date(b.confirmed_at ?? b.created_at ?? 0).getTime();
        return bt - at;
      });
      setJobs(sorted);
      if (!sorted.length) setMessage(`ยังไม่มีงานในระยะ ${requestedRadius} กม.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      if (!riderFeatures.candidateFlow) {
        setLoading(false);
        setMessage('Nearby Rider Offer ยังปิดอยู่จนกว่า backend candidate flow จะผ่าน production gate');
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
  }, [loadJobs]);

  async function refresh() {
    if (!session) return;
    await loadJobs(session, radius, true);
  }

  async function expandRadius() {
    if (!session || radiusIndex >= RADII.length - 1) return;
    const nextIndex = radiusIndex + 1;
    setRadiusIndex(nextIndex);
    await loadJobs(session, RADII[nextIndex]);
  }

  async function expressInterest(job: NearbyDeliveryJob) {
    if (!session || interestedSubId) return;
    setInterestedSubId(job.sub_id);
    setMessage(null);
    try {
      await expressDeliveryInterest(session, job.sub_id);
      setMessage(`แจ้งร้านแล้วว่าคุณสนใจงาน #${shortJobId(job.sub_id)} — รอร้านเลือก Rider`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setInterestedSubId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NEARBY RIDER OFFER</Text>
          <Text style={styles.title}>งานใกล้ฉัน</Text>
          <Text style={styles.subtitle}>ลากหน้าจอลงเพื่ออัปเดตงานล่าสุด</Text>
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

        {jobs.map((job) => {
          const payer = payerText(job.delivery_fee_payer);
          return (
            <View key={job.sub_id} style={styles.jobCard}>
              <View style={styles.topRow}>
                <Text style={styles.shopName}>{job.shop_name}</Text>
                <Text style={styles.jobId}>#{shortJobId(job.sub_id)}</Text>
              </View>
              <Text style={styles.time}>{jobTime(job)}</Text>

              {job.delivery_distance_km != null && (
                <View style={styles.decisionBox}>
                  <Text style={styles.routeText}>ร้าน → ลูกค้า {Number(job.delivery_distance_km).toFixed(1)} กม.</Text>
                  {job.delivery_fee != null && <Text style={styles.feeText}>ค่าส่ง ฿{Number(job.delivery_fee).toFixed(0)}</Text>}
                  {payer && <Text style={styles.payerText}>{payer}</Text>}
                </View>
              )}

              {job.delivery_distance_km == null && (
                <Text style={styles.distance}>ห่างจากคุณถึงร้านประมาณ {Number(job.distance_to_shop_km).toFixed(2)} กม.</Text>
              )}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/job-detail/[subId]', params: { subId: job.sub_id } })}
                  style={styles.detailButton}
                >
                  <Text style={styles.detailButtonText}>ดูรายละเอียด</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!interestedSubId}
                  onPress={() => expressInterest(job)}
                  style={styles.interestButton}
                >
                  <Text style={styles.interestButtonText}>
                    {interestedSubId === job.sub_id ? 'กำลังแจ้ง...' : 'สนใจรับงาน'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, gap: 14, paddingBottom: 32 },
  header: { gap: 6, marginBottom: 4 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 28, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  radiusCard: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF' },
  radiusText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  secondaryButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EEF4FF' },
  secondaryButtonText: { color: '#163E72', fontWeight: '700' },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  jobCard: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  shopName: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1D2939' },
  jobId: { fontSize: 12, fontWeight: '800', color: '#667085' },
  time: { fontSize: 12, fontWeight: '700', color: '#98A2B3' },
  decisionBox: { gap: 3, marginTop: 2, padding: 12, borderRadius: 12, backgroundColor: '#ECFDF3' },
  routeText: { fontSize: 16, fontWeight: '800', color: '#067647' },
  feeText: { fontSize: 22, fontWeight: '900', color: '#B54708' },
  payerText: { fontSize: 13, fontWeight: '800', color: '#344054' },
  distance: { fontSize: 14, fontWeight: '700', color: '#067647' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  detailButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F2F4F7' },
  detailButtonText: { fontWeight: '700', color: '#344054' },
  interestButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#163E72' },
  interestButtonText: { fontWeight: '800', color: '#FFFFFF' },
});

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import {
  expressDeliveryInterest,
  listNearbyDeliveryJobs,
  type NearbyDeliveryJob,
} from '@/data/nearbyJobsRepository';
import { getRiderProfile } from '@/data/riderRepository';

const RADII = [1, 2, 3, 5] as const;

export default function NearbyJobsScreen() {
  const router = useRouter();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [jobs, setJobs] = useState<NearbyDeliveryJob[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [interestedSubId, setInterestedSubId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const radius = RADII[radiusIndex];

  async function loadJobs(activeSession: RiderSession, requestedRadius = radius) {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await listNearbyDeliveryJobs(activeSession, requestedRadius);
      setJobs(rows);
      if (!rows.length) setMessage(`ยังไม่มีงานในระยะ ${requestedRadius} กม.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

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
  }, []);

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
      setMessage(`แจ้งร้านแล้วว่าคุณสนใจงานจาก ${job.shop_name} — รอร้านเลือก Rider`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setInterestedSubId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NEARBY RIDER OFFER</Text>
          <Text style={styles.title}>งานใกล้ฉัน</Text>
          <Text style={styles.subtitle}>
            แสดงเฉพาะข้อมูลร้านก่อนถูกเลือก เพื่อไม่เปิดเผยที่อยู่ลูกค้าก่อน assignment
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
            <Text style={styles.shopName}>{job.shop_name}</Text>
            <Text style={styles.shopAddress}>{job.shop_address ?? 'ร้านยังไม่ได้ระบุที่อยู่'}</Text>
            <Text style={styles.distance}>ห่างจากคุณประมาณ {Number(job.distance_to_shop_km).toFixed(2)} กม.</Text>

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
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, gap: 14 },
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
  shopName: { fontSize: 18, fontWeight: '800', color: '#1D2939' },
  shopAddress: { fontSize: 13, lineHeight: 19, color: '#667085' },
  distance: { fontSize: 14, fontWeight: '700', color: '#067647' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  detailButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F2F4F7' },
  detailButtonText: { fontWeight: '700', color: '#344054' },
  interestButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#163E72' },
  interestButtonText: { fontWeight: '800', color: '#FFFFFF' },
});

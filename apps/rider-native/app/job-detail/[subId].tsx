import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { acceptDeliveryV3, listNearbyDeliveryJobs, type NearbyDeliveryJob } from '@/data/nearbyJobsRepository';

export default function NearbyJobDetailScreen() {
  const router = useRouter();
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

  function openShopMap() {
    if (!job) return;
    const query = `${job.shop_lat},${job.shop_lng}`;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DELIVERY V3 · FIRST ACCEPT</Text>
          <Text style={styles.title}>{job?.shop_name ?? 'รายละเอียดงาน'}</Text>
          <Text style={styles.subtitle}>
            Rider คนแรกที่ backend ยืนยันสำเร็จจะได้งานทันที ระบบล็อก assignment แบบ atomic และร้านจะได้รับแจ้งหลังการล็อกสำเร็จ
          </Text>
        </View>

        {loading && <Text style={styles.message}>กำลังโหลดรายละเอียด...</Text>}

        {job && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>ร้าน</Text>
              <Text style={styles.value}>{job.shop_name}</Text>
              <Text style={styles.address}>{job.shop_address ?? 'ยังไม่ได้ระบุที่อยู่ร้าน'}</Text>
              <Text style={styles.distance}>ระยะถึงร้านประมาณ {Number(job.distance_to_shop_km).toFixed(2)} กม.</Text>
              <Pressable accessibilityRole="button" style={styles.mapButton} onPress={openShopMap}>
                <Text style={styles.mapButtonText}>ดูตำแหน่งร้าน</Text>
              </Pressable>
            </View>

            <View style={styles.privacyCard}>
              <Text style={styles.privacyTitle}>ข้อมูลลูกค้ายังถูกซ่อน</Text>
              <Text style={styles.privacyText}>
                ที่อยู่ เบอร์โทร และข้อมูลจุดส่งของลูกค้าจะเปิดให้เฉพาะ Rider ที่ชนะ Atomic First Accept และถูก assignment จาก backend แล้วเท่านั้น
              </Text>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { flex: 1, padding: 20, gap: 16 },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 28, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  label: { fontSize: 12, fontWeight: '800', color: '#667085' },
  value: { fontSize: 19, fontWeight: '800', color: '#1D2939' },
  address: { fontSize: 14, lineHeight: 20, color: '#475467' },
  distance: { fontSize: 14, fontWeight: '800', color: '#067647' },
  mapButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EEF4FF' },
  mapButtonText: { fontWeight: '700', color: '#163E72' },
  privacyCard: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  privacyTitle: { fontSize: 14, fontWeight: '800', color: '#93370D' },
  privacyText: { fontSize: 13, lineHeight: 19, color: '#854A0E' },
  acceptButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#067647' },
  acceptButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  disabledButton: { opacity: 0.6 },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  backButton: { alignItems: 'center', paddingVertical: 10 },
  backButtonText: { fontWeight: '700', color: '#475467' },
});

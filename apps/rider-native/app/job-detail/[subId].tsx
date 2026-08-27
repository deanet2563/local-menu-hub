import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { listNearbyDeliveryJobs, type NearbyDeliveryJob } from '@/data/nearbyJobsRepository';

export default function NearbyJobDetailScreen() {
  const router = useRouter();
  const { subId } = useLocalSearchParams<{ subId: string }>();
  const [job, setJob] = useState<NearbyDeliveryJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!riderFeatures.candidateFlow) {
        setMessage('Nearby Rider Offer ยังปิดอยู่จนกว่า Delivery V3 backend gate จะผ่าน');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DELIVERY V3 JOB PREVIEW</Text>
          <Text style={styles.title}>{job?.shop_name ?? 'รายละเอียดงาน'}</Text>
          <Text style={styles.subtitle}>
            หน้านี้เป็นข้อมูลก่อนรับงาน การรับงานจริงจะเปิดเมื่อ Atomic First Accept backend ผ่าน production gate แล้ว
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

            <View style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>รับงานยังไม่เปิดใน build นี้</Text>
              <Text style={styles.pendingText}>
                ระบบจะไม่ใช้ขั้นตอน “สนใจรับงาน → รอร้านเลือก Rider” อีกต่อไป ปุ่มรับงานจะเปิดพร้อม backend ที่ล็อกงานแบบ first-accept ได้อย่าง atomic เท่านั้น
              </Text>
            </View>
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
  pendingCard: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#B2CCFF' },
  pendingTitle: { fontSize: 14, fontWeight: '800', color: '#1849A9' },
  pendingText: { fontSize: 13, lineHeight: 19, color: '#175CD3' },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  backButton: { alignItems: 'center', paddingVertical: 10 },
  backButtonText: { fontWeight: '700', color: '#475467' },
});

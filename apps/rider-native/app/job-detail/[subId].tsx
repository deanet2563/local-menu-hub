import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import {
  expressDeliveryInterest,
  listNearbyDeliveryJobs,
  type NearbyDeliveryJob,
} from '@/data/nearbyJobsRepository';

function jobDateTime(job: NearbyDeliveryJob) {
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

export default function NearbyJobDetailScreen() {
  const router = useRouter();
  const { subId } = useLocalSearchParams<{ subId: string }>();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [job, setJob] = useState<NearbyDeliveryJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!riderFeatures.candidateFlow) {
        setMessage('Nearby Rider Offer ยังปิดอยู่จนกว่า backend gate จะผ่าน');
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

  async function interested() {
    if (!session || !job || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await expressDeliveryInterest(session, job.sub_id);
      setMessage('แจ้งร้านแล้วว่าคุณสนใจงานนี้ — ร้านจะเป็นผู้เลือก Rider ขั้นสุดท้าย');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }

  function openShopMap() {
    if (!job) return;
    const query = `${job.shop_lat},${job.shop_lng}`;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  }

  function openCustomerMap() {
    if (!job?.delivery_address_preview?.trim()) {
      setMessage('งานนี้ยังไม่มีที่อยู่จุดส่งสำหรับเปิดแผนที่');
      return;
    }
    void Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.delivery_address_preview.trim())}`,
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>JOB PREVIEW</Text>
          <Text style={styles.title}>{job?.shop_name ?? 'รายละเอียดงาน'}</Text>
          {job && <Text style={styles.time}>{jobDateTime(job)} · #{job.sub_id.slice(0, 6).toUpperCase()}</Text>}
          <Text style={styles.subtitle}>
            แสดงจุดส่งและค่าส่งก่อนรับงาน แต่ยังซ่อนชื่อและเบอร์ลูกค้าจนกว่าร้านจะเลือก Rider
          </Text>
        </View>

        {loading && <Text style={styles.message}>กำลังโหลดรายละเอียด...</Text>}

        {job && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>ร้าน</Text>
              <Text style={styles.value}>{job.shop_name}</Text>
              <Text style={styles.address}>{job.shop_address ?? 'ยังไม่ได้ระบุที่อยู่ร้าน'}</Text>
              <Text style={styles.distance}>จากตำแหน่งคุณถึงร้านประมาณ {Number(job.distance_to_shop_km).toFixed(2)} กม.</Text>
              <Pressable accessibilityRole="button" style={styles.mapButton} onPress={openShopMap}>
                <Text style={styles.mapButtonText}>ดูตำแหน่งร้าน</Text>
              </Pressable>
            </View>

            <View style={styles.deliveryCard}>
              <Text style={styles.label}>จุดส่งลูกค้า</Text>
              <Text style={styles.address}>{job.delivery_address_preview ?? 'ยังไม่มีข้อมูลจุดส่ง'}</Text>
              {job.delivery_distance_km != null && (
                <Text style={styles.routeText}>ร้าน → ลูกค้า {Number(job.delivery_distance_km).toFixed(1)} กม.</Text>
              )}
              {job.delivery_fee != null && (
                <Text style={styles.feeText}>ค่าส่ง ฿{Number(job.delivery_fee).toFixed(0)}</Text>
              )}
              {job.delivery_fee_payer && (
                <Text style={styles.payerText}>
                  {job.delivery_fee_payer === 'shop' ? 'เก็บค่าส่งจากร้าน' : 'เก็บค่าส่งจากลูกค้า'}
                </Text>
              )}
              {job.delivery_address_preview && (
                <Pressable accessibilityRole="button" style={styles.mapButton} onPress={openCustomerMap}>
                  <Text style={styles.mapButtonText}>ดูจุดส่งบนแผนที่</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.privacyCard}>
              <Text style={styles.privacyTitle}>ข้อมูลส่วนตัวลูกค้ายังถูกซ่อน</Text>
              <Text style={styles.privacyText}>
                Rider เห็นเฉพาะข้อมูลที่จำเป็นต่อการประเมินงานก่อนถูกเลือก ชื่อและเบอร์โทรลูกค้าจะเปิดหลัง assignment เท่านั้น
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              style={[styles.primaryButton, submitting && styles.disabled]}
              onPress={interested}
            >
              <Text style={styles.primaryButtonText}>{submitting ? 'กำลังแจ้งร้าน...' : 'สนใจรับงานนี้'}</Text>
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
  container: { padding: 20, gap: 16, paddingBottom: 32 },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 28, fontWeight: '800', color: '#112235' },
  time: { fontSize: 12, fontWeight: '700', color: '#667085' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  deliveryCard: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  label: { fontSize: 12, fontWeight: '800', color: '#667085' },
  value: { fontSize: 19, fontWeight: '800', color: '#1D2939' },
  address: { fontSize: 14, lineHeight: 20, color: '#475467' },
  distance: { fontSize: 14, fontWeight: '800', color: '#067647' },
  routeText: { fontSize: 16, fontWeight: '800', color: '#067647' },
  feeText: { fontSize: 24, fontWeight: '900', color: '#B54708' },
  payerText: { fontSize: 14, fontWeight: '800', color: '#344054' },
  mapButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EEF4FF' },
  mapButtonText: { fontWeight: '700', color: '#163E72' },
  privacyCard: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  privacyTitle: { fontSize: 14, fontWeight: '800', color: '#93370D' },
  privacyText: { fontSize: 13, lineHeight: 19, color: '#854A0E' },
  primaryButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#163E72' },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  backButton: { alignItems: 'center', paddingVertical: 10 },
  backButtonText: { fontWeight: '700', color: '#475467' },
});

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { dismissActiveIncomingJob, reconcileIncomingJobQueue, sortIncomingJobs, type IncomingJobQueueState } from '@/domain/incomingJobQueue';
import { acceptDeliveryV3, listNearbyDeliveryJobs, type NearbyDeliveryJob } from '@/data/nearbyJobsRepository';
import { getRiderProfile } from '@/data/riderRepository';
import { startActiveJobAlert, stopActiveJobAlert } from '@/services/jobAlertSound';

const RADII = [1, 2, 3, 5] as const;

function feeText(job: NearbyDeliveryJob) {
  if (job.delivery_fee == null) return 'รอพิกัดปลายทาง';
  return `฿${Number(job.delivery_fee).toFixed(2)}`;
}

const emptyQueue: IncomingJobQueueState<NearbyDeliveryJob> = { active: null, queued: [], dismissedIds: [] };

export default function NearbyJobsScreen() {
  const router = useRouter();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [jobs, setJobs] = useState<NearbyDeliveryJob[]>([]);
  const [queue, setQueue] = useState<IncomingJobQueueState<NearbyDeliveryJob>>(emptyQueue);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [previewQueuedOffer, setPreviewQueuedOffer] = useState<NearbyDeliveryJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const radius = RADII[radiusIndex];
  const activeOffer = queue.active;

  async function loadJobs(activeSession: RiderSession, requestedRadius = radius) {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await listNearbyDeliveryJobs(activeSession, requestedRadius);
      const sortedRows = sortIncomingJobs(rows);
      setJobs(sortedRows);
      setQueue((current) => reconcileIncomingJobQueue(current, sortedRows));
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

    return () => stopActiveJobAlert();
  }, []);

  useEffect(() => {
    setPreviewQueuedOffer(null);
  }, [activeOffer?.sub_id]);

  useEffect(() => {
    if (activeOffer && !accepting) {
      startActiveJobAlert(activeOffer.sub_id);
      return;
    }
    stopActiveJobAlert();
  }, [activeOffer?.sub_id, accepting]);

  async function expandRadius() {
    if (!session || radiusIndex >= RADII.length - 1) return;
    const nextIndex = radiusIndex + 1;
    setRadiusIndex(nextIndex);
    await loadJobs(session, RADII[nextIndex]);
  }

  function rejectActiveOffer() {
    if (!activeOffer || accepting) return;
    stopActiveJobAlert(activeOffer.sub_id);
    setQueue((current) => dismissActiveIncomingJob(current));
    setMessage('ปฏิเสธงานนี้แล้ว งานถัดไปในคิวจะแสดงต่อ');
  }

  async function acceptActiveOffer() {
    if (!session || !activeOffer || accepting) return;
    setAccepting(true);
    setMessage(null);
    stopActiveJobAlert(activeOffer.sub_id);
    try {
      const result = await acceptDeliveryV3(session, activeOffer.sub_id);
      if (result.result === 'job_already_taken') {
        setQueue((current) => dismissActiveIncomingJob(current));
        setMessage('งานนี้มี Rider คนอื่นรับไปแล้ว ระบบเลื่อนไปงานถัดไป');
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

  function renderJobCard(job: NearbyDeliveryJob, index: number) {
    const queuedPosition = queue.queued.findIndex((item) => item.sub_id === job.sub_id) + 1;
    return (
      <View key={job.sub_id} style={[styles.jobCard, activeOffer?.sub_id === job.sub_id && styles.activeJobCard]}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.shopName}>{job.shop_name}</Text>
            <Text style={styles.shopAddress}>{job.shop_address ?? 'ร้านยังไม่ได้ระบุที่อยู่'}</Text>
            <Text style={styles.queueMeta}>{activeOffer?.sub_id === job.sub_id ? 'กำลังแจ้งเตือนอยู่' : queuedPosition ? `คิวที่ ${queuedPosition}` : `ลำดับที่ ${index + 1}`}</Text>
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
          <Text style={styles.detailButtonText}>ดูรายละเอียด</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DELIVERY V3 · FIRST ACCEPT</Text>
          <Text style={styles.title}>งานใกล้ฉัน</Text>
          <Text style={styles.subtitle}>
            งานแรกที่เข้ามาจะเปิดหน้ารับงานพร้อม alert และงานถัดไปจะเข้าคิวโดยไม่แย่งงานที่กำลังตัดสินใจ
          </Text>
        </View>

        <View style={styles.radiusCard}>
          <Text style={styles.radiusText}>ค้นหาในระยะ {radius} กม. จากตำแหน่งล่าสุด</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!session || radiusIndex >= RADII.length - 1 || loading}
            onPress={expandRadius}
            style={[styles.secondaryButton, loading && styles.disabled]}
          >
            <Text style={styles.secondaryButtonText}>
              {radiusIndex >= RADII.length - 1 ? 'ระยะสูงสุด 5 กม.' : 'ขยายระยะค้นหา'}
            </Text>
          </Pressable>
        </View>

        {loading && <Text style={styles.message}>กำลังค้นหางาน...</Text>}
        {message && <Text style={styles.message}>{message}</Text>}

        {queue.queued.length > 0 && (
          <View style={styles.queueBanner}>
            <Text style={styles.queueBannerTitle}>มีงานรอในคิว {queue.queued.length} งาน</Text>
            <Text style={styles.queueBannerText}>งานเหล่านี้จะไม่ตัดหน้า offer ที่กำลังเปิดอยู่</Text>
          </View>
        )}

        {jobs.map(renderJobCard)}
      </ScrollView>

      <Modal visible={!!activeOffer} animationType="slide" presentationStyle="fullScreen" onRequestClose={rejectActiveOffer}>
        <SafeAreaView style={styles.modalSafeArea}>
          <ScrollView contentContainerStyle={styles.modalContainer}>
            {activeOffer && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalEyebrow}>INCOMING JOB</Text>
                  <Text style={styles.modalTitle}>{activeOffer.shop_name}</Text>
                  <Text style={styles.modalSubtitle}>First Accept จะล็อกงานผ่าน backend เท่านั้น</Text>
                </View>

                <View style={styles.priceCard}>
                  <View>
                    <Text style={styles.priceLabel}>ค่าขนส่ง</Text>
                    <Text style={styles.priceHint}>ร้าน → ลูกค้า</Text>
                  </View>
                  <Text style={styles.priceValue}>{feeText(activeOffer)}</Text>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>คุณ → ร้าน</Text>
                    <Text style={styles.metricValue}>{Number(activeOffer.distance_to_shop_km).toFixed(2)} กม.</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>ร้าน → ลูกค้า</Text>
                    <Text style={styles.metricValue}>{activeOffer.shop_to_customer_km == null ? '—' : `${Number(activeOffer.shop_to_customer_km).toFixed(2)} กม.`}</Text>
                  </View>
                </View>

                <View style={styles.modalCard}>
                  <Text style={styles.modalLabel}>จุดรับสินค้า</Text>
                  <Text style={styles.modalValue}>{activeOffer.shop_address ?? 'ร้านยังไม่ได้ระบุที่อยู่'}</Text>
                </View>

                <View style={styles.modalCard}>
                  <Text style={styles.modalLabel}>ปลายทางก่อนรับงาน</Text>
                  <Text style={styles.modalValue}>{activeOffer.delivery_address ?? 'ยังไม่ได้ระบุที่อยู่ปลายทาง'}</Text>
                  <Text style={styles.privacyNote}>ชื่อและเบอร์โทรลูกค้าจะแสดงหลัง backend ยืนยันว่าคุณชนะงานนี้</Text>
                </View>

                {queue.queued.length > 0 && (
                  <View style={styles.queuePanel}>
                    <Text style={styles.queueBannerTitle}>งานถัดไปในคิว {queue.queued.length} งาน</Text>
                    <Text style={styles.queueBannerText}>แตะเพื่อดูข้อมูลคิว โดยงานแรกยังเป็นเจ้าของ alert และปุ่มรับงาน</Text>
                    {queue.queued.map((job, index) => (
                      <Pressable key={job.sub_id} accessibilityRole="button" onPress={() => setPreviewQueuedOffer(job)} style={styles.queuedPreviewButton}>
                        <Text style={styles.queuedPreviewTitle}>คิวที่ {index + 1}: {job.shop_name}</Text>
                        <Text style={styles.queuedPreviewText}>{feeText(job)} · คุณ → ร้าน {Number(job.distance_to_shop_km).toFixed(2)} กม.</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {previewQueuedOffer && (
                  <View style={styles.queuedPreviewCard}>
                    <Text style={styles.modalLabel}>กำลังดูคิว: {previewQueuedOffer.shop_name}</Text>
                    <Text style={styles.modalValue}>{previewQueuedOffer.delivery_address ?? previewQueuedOffer.shop_address ?? 'ยังไม่มีรายละเอียดที่อยู่'}</Text>
                    <Text style={styles.privacyNote}>นี่เป็น preview เท่านั้น ปุ่มรับงานยังผูกกับ offer แรกด้านบน</Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Pressable accessibilityRole="button" disabled={accepting} onPress={rejectActiveOffer} style={[styles.rejectButton, accepting && styles.disabled]}>
                    <Text style={styles.rejectButtonText}>ปฏิเสธ</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={accepting} onPress={() => void acceptActiveOffer()} style={[styles.acceptButton, accepting && styles.disabled]}>
                    {accepting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.acceptButtonText}>รับงานนี้</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  queueBanner: { gap: 3, padding: 12, borderRadius: 13, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  queuePanel: { gap: 8, padding: 12, borderRadius: 13, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  queueBannerTitle: { fontSize: 14, fontWeight: '800', color: '#93370D' },
  queueBannerText: { fontSize: 12, lineHeight: 18, color: '#854A0E' },
  jobCard: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  activeJobCard: { borderColor: '#246B50', backgroundColor: '#F3FCF7' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitleWrap: { flex: 1, gap: 5 },
  shopName: { fontSize: 18, fontWeight: '800', color: '#1D2939' },
  shopAddress: { fontSize: 13, lineHeight: 19, color: '#667085' },
  queueMeta: { fontSize: 12, fontWeight: '800', color: '#246B50' },
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
  modalSafeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  modalContainer: { flexGrow: 1, padding: 20, paddingBottom: 42, gap: 14 },
  modalHeader: { gap: 6, paddingTop: 8 },
  modalEyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: '#B54708' },
  modalTitle: { fontSize: 31, fontWeight: '900', color: '#112235' },
  modalSubtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  priceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  priceLabel: { fontSize: 13, fontWeight: '800', color: '#027A48' },
  priceHint: { marginTop: 3, fontSize: 11, color: '#039855' },
  priceValue: { fontSize: 24, fontWeight: '900', color: '#027A48' },
  modalCard: { gap: 6, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  modalLabel: { fontSize: 12, fontWeight: '800', color: '#667085' },
  modalValue: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: '#1D2939' },
  privacyNote: { fontSize: 11, lineHeight: 16, color: '#667085' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 'auto' },
  queuedPreviewButton: { gap: 2, padding: 10, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FEDF89' },
  queuedPreviewTitle: { fontSize: 13, fontWeight: '900', color: '#93370D' },
  queuedPreviewText: { fontSize: 12, lineHeight: 17, color: '#854A0E' },
  queuedPreviewCard: { gap: 6, padding: 13, borderRadius: 13, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#D0D5DD' },
  rejectButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD' },
  rejectButtonText: { fontSize: 16, fontWeight: '800', color: '#B42318' },
  acceptButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#067647' },
  acceptButtonText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
});

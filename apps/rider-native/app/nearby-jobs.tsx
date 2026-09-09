import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, AppState, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type RiderSession } from '@/auth/session';
import { acceptDeliveryV3, listNearbyDeliveryJobs, type NearbyDeliveryJob } from '@/data/nearbyJobsRepository';
import {
  dismissActiveIncomingJob,
  focusCurrentIncomingJob,
  reconcileIncomingJobQueue,
  sortIncomingJobs,
  type IncomingJobQueueState,
  viewIncomingQueue,
} from '@/domain/incomingJobQueue';
import { emptyIncomingJobQueue, loadOnlineRiderSession, RIDER_INCOMING_JOB_RADII } from '@/services/incomingOfferHydration';
import { addRiderOfferNotificationListeners, getLastRiderOfferNotificationSubId } from '@/services/notifications';
import { startIncomingJobAlert, stopIncomingJobAlert } from '@/services/jobAlertSound';

function requestTime(job: NearbyDeliveryJob) {
  const raw = job.offer_requested_at ?? job.confirmed_at;
  return raw ? new Date(raw).getTime() : 0;
}

function feeText(job: NearbyDeliveryJob) {
  if (job.delivery_fee == null) return 'รอค่าส่ง';
  return `฿${Number(job.delivery_fee).toFixed(0)}`;
}

function distanceText(value?: number | null) {
  if (value == null) return 'รอข้อมูล';
  return `${Number(value).toFixed(2)} กม.`;
}

function offerAgeText(job: NearbyDeliveryJob) {
  const time = requestTime(job);
  if (!time) return 'เพิ่งเรียก Rider';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds} วินาทีที่แล้ว`;
  return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
}

function JobSummary({ job, compact = false }: { job: NearbyDeliveryJob; compact?: boolean }) {
  return (
    <View style={[styles.jobCard, compact && styles.jobCardCompact]}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.shopName}>{job.shop_name}</Text>
          <Text style={styles.shopAddress} numberOfLines={2}>{job.shop_address ?? 'ร้านยังไม่ได้ระบุที่อยู่'}</Text>
        </View>
        <View style={styles.feeBadge}>
          <Text style={styles.feeLabel}>รายได้</Text>
          <Text style={styles.feeValue}>{feeText(job)}</Text>
        </View>
      </View>
      <View style={styles.metricRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>คุณ → ร้าน</Text>
          <Text style={styles.metricValue}>{distanceText(job.distance_to_shop_km)}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>ร้าน → ลูกค้า</Text>
          <Text style={styles.metricValue}>{distanceText(job.shop_to_customer_km)}</Text>
        </View>
      </View>
      <Text style={styles.destination} numberOfLines={compact ? 1 : 3}>
        ปลายทาง: {job.delivery_address ?? 'รอข้อมูลปลายทาง'}
      </Text>
      <Text style={styles.offerTime}>เรียกเมื่อ {offerAgeText(job)}</Text>
    </View>
  );
}

export default function NearbyJobsScreen() {
  const router = useRouter();
  const { subId } = useLocalSearchParams<{ subId?: string }>();
  const pulse = useRef(new Animated.Value(1)).current;
  const [session, setSession] = useState<RiderSession | null>(null);
  const [jobs, setJobs] = useState<NearbyDeliveryJob[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [previewQueuedOffer, setPreviewQueuedOffer] = useState<NearbyDeliveryJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState<IncomingJobQueueState<NearbyDeliveryJob>>(emptyIncomingJobQueue);

  const radius = RIDER_INCOMING_JOB_RADII[radiusIndex];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.035, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    );
    if (queue.active) animation.start();
    return () => animation.stop();
  }, [pulse, queue.active?.sub_id]);

  useEffect(() => {
    if (queue.active && !accepting) {
      void startIncomingJobAlert().catch(() => undefined);
    } else {
      void stopIncomingJobAlert().catch(() => undefined);
    }
  }, [accepting, queue.active?.sub_id]);

  const loadJobs = useCallback(async (
    activeSession: RiderSession,
    requestedRadius = radius,
    focusSubId?: string | null,
  ) => {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await listNearbyDeliveryJobs(activeSession, requestedRadius);
      const sortedRows = sortIncomingJobs(rows);
      setJobs(sortedRows);
      setQueue((current) => {
        const next = reconcileIncomingJobQueue(current, sortedRows);
        if (!focusSubId || next.active?.sub_id === focusSubId) return next;
        const focusJob = sortedRows.find((job) => job.sub_id === focusSubId);
        if (!focusJob) return next;
        return {
          ...next,
          active: focusJob,
          queued: sortedRows.filter((job) => job.sub_id !== focusJob.sub_id),
        };
      });
      if (!rows.length) setMessage(`ยังไม่มีงานในระยะ ${requestedRadius} กม.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [radius]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => void loadJobs(session), 10000);
    return () => clearInterval(interval);
  }, [loadJobs, session]);

  useEffect(() => {
    if (!session) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void loadJobs(session, radius, subId);
    });
    return () => subscription.remove();
  }, [loadJobs, radius, session, subId]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return undefined;
      void loadJobs(session, radius, subId);
      return undefined;
    }, [loadJobs, radius, session, subId]),
  );

  useEffect(() => {
    if (!session) return;
    return addRiderOfferNotificationListeners({
      onReceived: (offerSubId) => void loadJobs(session, radius, offerSubId),
      onResponse: (offerSubId) => void loadJobs(session, radius, offerSubId),
    });
  }, [loadJobs, radius, session]);

  useEffect(() => () => { void stopIncomingJobAlert(); }, []);

  useEffect(() => {
    setPreviewQueuedOffer(null);
  }, [queue.active?.sub_id]);

  useEffect(() => {
    void (async () => {
      const result = await loadOnlineRiderSession();
      if (!result.session || result.message) {
        setLoading(false);
        setMessage(result.message);
        return;
      }
      setSession(result.session);
      const notificationSubId = subId ?? await getLastRiderOfferNotificationSubId().catch(() => null);
      await loadJobs(result.session, RIDER_INCOMING_JOB_RADII[0], notificationSubId);
    })();
  }, [loadJobs, subId]);

  async function expandRadius() {
    if (!session || radiusIndex >= RIDER_INCOMING_JOB_RADII.length - 1) return;
    const nextIndex = radiusIndex + 1;
    setRadiusIndex(nextIndex);
    await loadJobs(session, RIDER_INCOMING_JOB_RADII[nextIndex]);
  }

  function rejectCurrent() {
    const current = queue.active;
    if (!current) return;
    void stopIncomingJobAlert();
    setJobs((currentJobs) => currentJobs.filter((job) => job.sub_id !== current.sub_id));
    setQueue((currentQueue) => dismissActiveIncomingJob(currentQueue));
    setMessage('ปฏิเสธงานนี้แล้ว งานถัดไปในคิวจะแสดงต่อ');
  }

  async function acceptJob(job: NearbyDeliveryJob) {
    if (!session || accepting) return;
    setAccepting(true);
    setMessage(null);
    void stopIncomingJobAlert();
    try {
      const result = await acceptDeliveryV3(session, job.sub_id);
      if (result.result === 'job_already_taken') {
        setJobs((currentJobs) => currentJobs.filter((item) => item.sub_id !== job.sub_id));
        setQueue((current) => dismissActiveIncomingJob(current));
        setMessage('งานนี้มี Rider คนอื่นรับไปแล้ว ระบบเลื่อนไปงานถัดไป');
        return;
      }
      router.replace('/active-delivery');
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      if (text === 'fresh_rider_location_required') {
        setMessage('ตำแหน่ง Rider เก่าเกินไป กรุณากลับหน้าหลักเพื่ออัปเดตตำแหน่ง');
      } else if (text === 'rider_already_has_active_delivery') {
        setMessage('คุณมีงานปัจจุบันอยู่แล้ว กรุณาจบงานนั้นก่อนรับงานใหม่');
      } else if (text === 'unauthorized_rider_session') {
        setMessage('Rider session หมดอายุหรือถูกออกจากระบบ กรุณาเข้าสู่ระบบใหม่');
      } else {
        setMessage(text);
      }
    } finally {
      setAccepting(false);
    }
  }

  const currentOffer = queue.active;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal visible={Boolean(currentOffer)} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.offerSafeArea}>
          {currentOffer && !queue.isViewingList ? (
            <ScrollView contentContainerStyle={styles.offerContainer}>
              <View style={styles.offerHeader}>
                <Text style={styles.offerEyebrow}>งานเข้าใหม่</Text>
                <Text style={styles.offerTitle}>ร้านเรียก Rider</Text>
                <Text style={styles.offerSubtitle}>ตรวจระยะทางและรายได้ก่อนกดรับงาน</Text>
                {queue.queued.length > 0 && (
                  <Pressable accessibilityRole="button" onPress={() => setQueue((current) => viewIncomingQueue(current))} style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>มีอีก {queue.queued.length} งานรออยู่</Text>
                  </Pressable>
                )}
              </View>
              <Animated.View style={[styles.pulseShell, { transform: [{ scale: pulse }] }]}>
                <JobSummary job={currentOffer} />
              </Animated.View>
              <View style={styles.offerActions}>
                <Pressable accessibilityRole="button" disabled={accepting} onPress={() => void acceptJob(currentOffer)} style={[styles.acceptButton, accepting && styles.disabled]}>
                  <Text style={styles.acceptButtonText}>{accepting ? 'กำลังล็อกงาน...' : 'รับงาน'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={accepting} onPress={rejectCurrent} style={styles.rejectButton}>
                  <Text style={styles.rejectButtonText}>ปฏิเสธ</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={accepting} onPress={() => setQueue((current) => viewIncomingQueue(current))} style={styles.listButton}>
                  <Text style={styles.listButtonText}>ดูรายการงานเข้า</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.offerContainer}>
              <View style={styles.offerHeader}>
                <Text style={styles.offerEyebrow}>รายการงานเข้า</Text>
                <Text style={styles.offerTitle}>เลือกดูทีละงาน</Text>
                <Text style={styles.offerSubtitle}>งานแรกยังเป็นเจ้าของเสียงเตือนจนกว่าจะรับหรือปฏิเสธ</Text>
              </View>
              {[currentOffer, ...queue.queued].filter((job): job is NearbyDeliveryJob => Boolean(job)).map((job, index) => (
                <Pressable key={job.sub_id} accessibilityRole="button" onPress={() => setPreviewQueuedOffer(job)} style={[styles.queueItem, index === 0 && styles.queueItemActive]}>
                  <Text style={styles.queueIndex}>{index === 0 ? 'งานที่กำลังเตือน' : `คิว ${index + 1}`}</Text>
                  <JobSummary job={job} compact />
                </Pressable>
              ))}
              {previewQueuedOffer && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewLabel}>กำลังดูคิว: {previewQueuedOffer.shop_name}</Text>
                  <Text style={styles.previewText}>{previewQueuedOffer.delivery_address ?? previewQueuedOffer.shop_address ?? 'ยังไม่มีรายละเอียดที่อยู่'}</Text>
                  <Text style={styles.previewNote}>งานแรกยังเป็นเจ้าของเสียงเตือนและปุ่มรับงานจนกว่าจะรับหรือปฏิเสธ</Text>
                </View>
              )}
              <Pressable accessibilityRole="button" onPress={() => setQueue((current) => focusCurrentIncomingJob(current))} style={styles.acceptButton}>
                <Text style={styles.acceptButtonText}>กลับไปพิจารณางานแรก</Text>
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>RIDER JOBS</Text>
          <Text style={styles.title}>งานเข้า</Text>
          <Text style={styles.subtitle}>งานร้านเรียก Rider แสดงตามเวลาที่เข้ามา ระบบยังใช้ First Accept จาก backend เป็นตัวล็อกงานจริง</Text>
        </View>
        <View style={styles.radiusCard}>
          <Text style={styles.radiusText}>ค้นหาในระยะ {radius} กม. จากตำแหน่งล่าสุด</Text>
          <Pressable accessibilityRole="button" disabled={!session || radiusIndex >= RIDER_INCOMING_JOB_RADII.length - 1 || loading} onPress={expandRadius} style={[styles.secondaryButton, (!session || radiusIndex >= RIDER_INCOMING_JOB_RADII.length - 1 || loading) && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>{radiusIndex >= RIDER_INCOMING_JOB_RADII.length - 1 ? 'ระยะสูงสุด 5 กม.' : 'ขยายระยะค้นหา'}</Text>
          </Pressable>
        </View>
        {queue.active && (
          <Pressable accessibilityRole="button" onPress={() => setQueue((current) => focusCurrentIncomingJob(current))} style={styles.glowBanner}>
            <Text style={styles.glowTitle}>มีงานเข้าใหม่</Text>
            <Text style={styles.glowText}>{queue.active.shop_name}{queue.queued.length ? ` · อีก ${queue.queued.length} งาน` : ''}</Text>
          </Pressable>
        )}
        {loading && <Text style={styles.message}>กำลังค้นหางาน...</Text>}
        {message && <Text style={styles.message}>{message}</Text>}
        {jobs.map((job) => (
          <View key={job.sub_id} style={styles.jobWrap}>
            <JobSummary job={job} />
            <View style={styles.rowActions}>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/job-detail/[subId]', params: { subId: job.sub_id } })} style={styles.detailButton}>
                <Text style={styles.detailButtonText}>ดูรายละเอียด</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void acceptJob(job)} disabled={accepting} style={[styles.inlineAcceptButton, accepting && styles.disabled]}>
                <Text style={styles.inlineAcceptButtonText}>รับงาน</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F2' },
  offerSafeArea: { flex: 1, backgroundColor: '#102018' },
  container: { padding: 20, paddingBottom: 42, gap: 14 },
  offerContainer: { flexGrow: 1, padding: 20, paddingBottom: 34, gap: 16 },
  header: { gap: 6, marginBottom: 4 },
  offerHeader: { gap: 8, paddingTop: 8 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: '#246B50' },
  offerEyebrow: { fontSize: 12, fontWeight: '900', color: '#8EE6B0' },
  title: { fontSize: 28, fontWeight: '800', color: '#112235' },
  offerTitle: { fontSize: 34, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  offerSubtitle: { fontSize: 15, lineHeight: 22, color: '#D6E8DD' },
  pendingBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFD166' },
  pendingBadgeText: { fontSize: 13, fontWeight: '900', color: '#43290A' },
  pulseShell: { borderRadius: 8, shadowColor: '#51D88A', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  radiusCard: { gap: 10, padding: 14, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5D7' },
  radiusText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  secondaryButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#E9F3E7' },
  secondaryButtonText: { color: '#246B50', fontWeight: '800' },
  glowBanner: { gap: 2, padding: 15, borderRadius: 8, backgroundColor: '#153F2B', borderWidth: 1, borderColor: '#70D69B' },
  glowTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  glowText: { fontSize: 13, color: '#CDEED8' },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  jobWrap: { gap: 10, padding: 14, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5D7' },
  jobCard: { gap: 12, padding: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  jobCardCompact: { padding: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitleWrap: { flex: 1, gap: 5 },
  shopName: { fontSize: 19, fontWeight: '900', color: '#1D2939' },
  shopAddress: { fontSize: 13, lineHeight: 19, color: '#667085' },
  feeBadge: { minWidth: 88, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EAF7EF', alignItems: 'flex-end' },
  feeLabel: { fontSize: 10, fontWeight: '800', color: '#027A48' },
  feeValue: { marginTop: 2, fontSize: 20, fontWeight: '900', color: '#027A48' },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricBox: { flex: 1, padding: 11, borderRadius: 8, backgroundColor: '#F8FAFC' },
  metricLabel: { fontSize: 11, color: '#667085' },
  metricValue: { marginTop: 3, fontSize: 14, fontWeight: '900', color: '#344054' },
  destination: { fontSize: 13, lineHeight: 19, color: '#475467' },
  offerTime: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  offerActions: { gap: 10 },
  acceptButton: { alignItems: 'center', justifyContent: 'center', minHeight: 58, borderRadius: 8, backgroundColor: '#16A34A', shadowColor: '#51D88A', shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  acceptButtonText: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  rejectButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 8, backgroundColor: '#FFFFFF' },
  rejectButtonText: { fontSize: 17, fontWeight: '900', color: '#B42318' },
  listButton: { alignItems: 'center', paddingVertical: 11 },
  listButtonText: { fontSize: 14, fontWeight: '800', color: '#D6E8DD' },
  queueItem: { gap: 8, borderRadius: 8 },
  queueItemActive: { borderWidth: 2, borderColor: '#70D69B' },
  queueIndex: { marginLeft: 4, fontSize: 12, fontWeight: '900', color: '#D6E8DD' },
  previewCard: { gap: 6, padding: 14, borderRadius: 8, backgroundColor: '#173926', borderWidth: 1, borderColor: '#70D69B' },
  previewLabel: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  previewText: { fontSize: 13, lineHeight: 19, color: '#D6E8DD' },
  previewNote: { fontSize: 11, lineHeight: 16, color: '#A6E7BC' },
  rowActions: { flexDirection: 'row', gap: 10 },
  detailButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: '#F2F4F7' },
  detailButtonText: { fontWeight: '800', color: '#344054' },
  inlineAcceptButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: '#246B50' },
  inlineAcceptButtonText: { fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
});

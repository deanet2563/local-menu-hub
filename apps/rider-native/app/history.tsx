import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { listRiderDeliveryHistory, type AssignedDelivery } from '@/data/assignedDeliveryRepository';

function statusLabel(status: string) {
  if (status === 'delivered') return 'ส่งสำเร็จ';
  if (status === 'failed') return 'จัดส่งไม่สำเร็จ';
  if (status === 'cancelled') return 'ยกเลิก / ปล่อยงาน';
  return status;
}

function statusTone(status: string) {
  if (status === 'delivered') return 'done' as const;
  if (status === 'failed') return 'failed' as const;
  return 'cancelled' as const;
}

function dateText(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function RiderHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [jobs, setJobs] = useState<AssignedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (saved: RiderSession) => {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await listRiderDeliveryHistory(saved);
      setJobs(rows);
      if (!rows.length) setMessage('ยังไม่มีประวัติงานจัดส่ง');
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
          setJobs([]);
          setLoading(false);
          setMessage('ต้องเข้าสู่ระบบ Rider ก่อนดูประวัติงาน');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 28, 44) }]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>RIDER HISTORY</Text>
          <Text style={styles.title}>ประวัติงาน</Text>
          <Text style={styles.subtitle}>แสดงงานที่ backend คืนให้ Rider session นี้เท่านั้น งานยกเลิก/ปล่อยงานจะแสดงเมื่อมี event history ที่ Rider อ่านได้</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable accessibilityRole="button" disabled={!session || loading} onPress={() => session && void load(session)} style={[styles.secondaryButton, (!session || loading) && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>{loading ? 'กำลังโหลด...' : 'รีเฟรช'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>กลับ</Text>
          </Pressable>
        </View>

        {message && <Text style={styles.message}>{message}</Text>}

        {jobs.map((job) => {
          const tone = statusTone(job.delivery_status);
          return (
            <View key={job.sub_id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.shopName}>{job.shops?.name ?? job.shop_id}</Text>
                  <Text style={styles.date}>{dateText(job.created_at)}</Text>
                </View>
                <View style={[styles.statusChip, styles[`statusChip_${tone}`]]}>
                  <Text style={[styles.statusChipText, styles[`statusChipText_${tone}`]]}>{statusLabel(job.delivery_status)}</Text>
                </View>
              </View>

              {job.delivery_address && <Text style={styles.address} numberOfLines={2}>ปลายทาง: {job.delivery_address}</Text>}

              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>ยอดสินค้า</Text>
                <Text style={styles.amount}>฿{job.amount}</Text>
              </View>

              {job.delivery_photo_url && <Text style={styles.proofText}>มี Proof of Delivery แล้ว</Text>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, gap: 14 },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 28, fontWeight: '900', color: '#112235' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#667085' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EEF4FF' },
  secondaryButtonText: { fontSize: 14, fontWeight: '800', color: '#163E72' },
  backButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD' },
  backButtonText: { fontSize: 14, fontWeight: '800', color: '#344054' },
  message: { fontSize: 13, lineHeight: 19, color: '#667085' },
  card: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 4 },
  shopName: { fontSize: 17, fontWeight: '900', color: '#1D2939' },
  date: { fontSize: 12, color: '#667085' },
  statusChip: { flexShrink: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusChip_done: { backgroundColor: '#EAF7EF' },
  statusChip_failed: { backgroundColor: '#FEF3F2' },
  statusChip_cancelled: { backgroundColor: '#FFFAEB' },
  statusChipText: { fontSize: 11, fontWeight: '900' },
  statusChipText_done: { color: '#027A48' },
  statusChipText_failed: { color: '#B42318' },
  statusChipText_cancelled: { color: '#B54708' },
  address: { fontSize: 13, lineHeight: 19, color: '#475467' },
  amountRow: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EAECF0', flexDirection: 'row', justifyContent: 'space-between' },
  amountLabel: { fontSize: 13, fontWeight: '700', color: '#667085' },
  amount: { fontSize: 17, fontWeight: '900', color: '#1D2939' },
  proofText: { fontSize: 12, fontWeight: '800', color: '#067647' },
  disabled: { opacity: 0.45 },
});

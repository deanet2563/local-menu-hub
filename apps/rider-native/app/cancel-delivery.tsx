import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { refreshRiderSession } from '@/auth/broker';
import {
  isRefreshSessionFresh,
  isSessionFresh,
  loadRiderSession,
  type RiderSession,
} from '@/auth/session';
import { riderFeatures } from '@/config/features';
import {
  cancelAssignedDeliveryV3,
  type RiderCancelReasonCode,
} from '@/data/assignedDeliveryRepository';

const REASONS: Array<{ code: RiderCancelReasonCode; label: string }> = [
  { code: 'vehicle_problem', label: 'รถมีปัญหา' },
  { code: 'accepted_by_mistake', label: 'กดรับงานผิด' },
  { code: 'cannot_reach_shop', label: 'ไปถึงร้านไม่ได้' },
  { code: 'emergency', label: 'เหตุฉุกเฉิน' },
  { code: 'job_location_issue', label: 'ปัญหางาน / พิกัด' },
  { code: 'other', label: 'อื่น ๆ' },
];

function friendlyError(value: string) {
  if (value === 'unauthorized_rider_session' || value === 'rider_not_authenticated') return 'Rider session หมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (value === 'delivery_not_assigned_to_rider') return 'งานนี้ไม่ได้ assign ให้ Rider session ปัจจุบันแล้ว';
  if (value === 'rider_cancellation_not_allowed_after_pickup') return 'ยกเลิกการรับงานไม่ได้หลังรับสินค้าแล้ว';
  if (value === 'rider_cancellation_transition_conflict') return 'สถานะงานเปลี่ยนไปแล้ว กรุณากลับไปโหลดงานใหม่';
  if (value === 'rider_cancellation_note_required_for_other') return 'กรุณาระบุรายละเอียดเมื่อเลือก “อื่น ๆ”';
  if (value === 'rider_cancellation_note_too_long') return 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร';
  if (value === 'delivery_not_found') return 'ไม่พบงานจัดส่งนี้';
  return value;
}

export default function CancelDeliveryScreen() {
  const router = useRouter();
  const { subId } = useLocalSearchParams<{ subId: string }>();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [reasonCode, setReasonCode] = useState<RiderCancelReasonCode>('vehicle_problem');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!riderFeatures.deliveryV3Accept) {
        setMessage('Delivery V3 ยังไม่เปิดใช้งานใน production build นี้');
        return;
      }

      const saved = await loadRiderSession();
      if (!saved) {
        setMessage('ต้องเข้าสู่ระบบ Rider ก่อนยกเลิกงาน');
        return;
      }

      let activeSession = saved;
      if (!isSessionFresh(activeSession)) {
        if (activeSession.refreshToken && isRefreshSessionFresh(activeSession)) {
          try {
            activeSession = await refreshRiderSession(activeSession.refreshToken);
          } catch {
            setMessage('Rider session ต่ออายุไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่');
            return;
          }
        } else {
          setMessage('Rider session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
          return;
        }
      }

      setSession(activeSession);
    })();
  }, []);

  async function submit() {
    if (!riderFeatures.deliveryV3Accept) {
      setMessage('Delivery V3 ยังไม่เปิดใช้งานใน production build นี้');
      return;
    }
    if (!session || !subId || busy) return;
    if (reasonCode === 'other' && !note.trim()) {
      setMessage('กรุณาระบุรายละเอียดเมื่อเลือก “อื่น ๆ”');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await cancelAssignedDeliveryV3(session, subId, reasonCode, note);
      router.back();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setMessage(friendlyError(text));
    } finally {
      setBusy(false);
    }
  }

  const routeEnabled = riderFeatures.deliveryV3Accept;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>RIDER CANCELLATION</Text>
          <Text style={styles.title}>ปล่อยงานก่อนรับสินค้า</Text>
          <Text style={styles.subtitle}>งาน {subId ?? '-'}</Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>ใช้ได้ก่อน Pickup เท่านั้น</Text>
          <Text style={styles.warningText}>
            เมื่อยืนยัน ระบบจะปล่อยงานจากคุณและแจ้งร้าน ออเดอร์ลูกค้าไม่ถูกยกเลิก ร้านสามารถเปิดหา Rider ใหม่ได้
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>เหตุผล</Text>
          <View style={styles.reasonWrap}>
            {REASONS.map((reason) => (
              <Pressable
                key={reason.code}
                disabled={busy || !routeEnabled}
                onPress={() => setReasonCode(reason.code)}
                style={[styles.reasonChip, reasonCode === reason.code && styles.reasonChipSelected, (busy || !routeEnabled) && styles.disabled]}
              >
                <Text style={[styles.reasonText, reasonCode === reason.code && styles.reasonTextSelected]}>{reason.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            editable={!busy && routeEnabled}
            maxLength={500}
            multiline
            onChangeText={setNote}
            placeholder={reasonCode === 'other' ? 'กรุณาระบุรายละเอียด' : 'รายละเอียดเพิ่มเติม (ถ้ามี)'}
            style={styles.input}
            value={note}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!routeEnabled || !session || busy || (reasonCode === 'other' && !note.trim())}
          onPress={() => void submit()}
          style={[styles.cancelButton, (!routeEnabled || !session || busy || (reasonCode === 'other' && !note.trim())) && styles.disabled]}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.cancelButtonText}>ยืนยันปล่อยงานนี้</Text>}
        </Pressable>

        {message && <Text style={styles.message}>{message}</Text>}

        <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>กลับไปงานปัจจุบัน</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, gap: 14 },
  header: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#B54708' },
  title: { fontSize: 27, fontWeight: '800', color: '#1D2939' },
  subtitle: { fontSize: 13, color: '#667085' },
  warningCard: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  warningTitle: { fontSize: 14, fontWeight: '800', color: '#93370D' },
  warningText: { fontSize: 13, lineHeight: 19, color: '#854A0E' },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#344054' },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { borderRadius: 999, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 8 },
  reasonChipSelected: { borderColor: '#B54708', backgroundColor: '#FFF4ED' },
  reasonText: { fontSize: 12, fontWeight: '700', color: '#475467' },
  reasonTextSelected: { color: '#B54708' },
  input: { minHeight: 84, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 12, textAlignVertical: 'top', color: '#344054' },
  cancelButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#B42318' },
  cancelButtonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  backButton: { alignItems: 'center', paddingVertical: 10 },
  backButtonText: { fontWeight: '700', color: '#475467' },
  disabled: { opacity: 0.45 },
  message: { fontSize: 13, lineHeight: 19, color: '#B42318' },
});

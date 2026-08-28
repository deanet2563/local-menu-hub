import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { refreshRiderSession } from '@/auth/broker';
import {
  isRefreshSessionFresh,
  isSessionFresh,
  loadRiderSession,
  type RiderSession,
} from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { completeDeliveryV3, uploadPrivateDeliveryProof } from '@/data/deliveryProofRepository';

type CapturedPhoto = { uri: string; mimeType?: string | null };

function friendlyError(value: string): string {
  if (value === 'unauthorized_rider_session' || value === 'rider_not_authenticated') return 'Rider session หมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (value === 'delivery_proof_upload_not_authorized') return 'ระบบไม่อนุญาตให้อัปโหลดรูปสำหรับงานนี้ กรุณาตรวจว่างานยัง assign ให้คุณและอยู่หลัง Pickup';
  if (value === 'delivery_proof_file_too_large') return 'รูปมีขนาดใหญ่เกิน 5 MB กรุณาถ่ายใหม่';
  if (value === 'delivery_proof_file_empty' || value === 'delivery_proof_local_file_unavailable') return 'ไม่สามารถอ่านรูปจากเครื่องได้ กรุณาถ่ายใหม่';
  if (value === 'delivery_not_assigned_to_rider') return 'งานนี้ไม่ได้ assign ให้ Rider session ปัจจุบันแล้ว';
  if (value === 'delivery_proof_object_not_found') return 'ระบบยังไม่พบรูปหลักฐานที่อัปโหลด กรุณาลองส่งอีกครั้ง';
  if (value === 'delivery_completion_transition_not_allowed') return 'งานนี้ไม่ได้อยู่ในสถานะพร้อมปิดงานหลัง Pickup';
  if (value === 'delivery_completion_transition_conflict') return 'สถานะงานเปลี่ยนไปแล้ว กรุณากลับไปโหลดงานใหม่';
  if (value === 'invalid_delivery_proof_path') return 'รูปหลักฐานไม่ผูกกับงานนี้ กรุณาถ่ายใหม่';
  return value;
}

async function ensureFreshRiderSession(current?: RiderSession | null): Promise<RiderSession> {
  const saved = current ?? await loadRiderSession();
  if (!saved) throw new Error('unauthorized_rider_session');
  if (isSessionFresh(saved)) return saved;
  if (saved.refreshToken && isRefreshSessionFresh(saved)) {
    return refreshRiderSession(saved.refreshToken);
  }
  throw new Error('unauthorized_rider_session');
}

export default function ProofDeliveryScreen() {
  const router = useRouter();
  const { subId } = useLocalSearchParams<{ subId: string }>();
  const [session, setSession] = useState<RiderSession | null>(null);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [uploadedProofPath, setUploadedProofPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!riderFeatures.deliveryV3Accept) {
        setMessage('Delivery V3 ยังไม่เปิดใช้งานใน production build นี้');
        return;
      }
      try {
        setSession(await ensureFreshRiderSession());
      } catch {
        setMessage('ต้องเข้าสู่ระบบ Rider ก่อนส่ง Proof of Delivery');
      }
    })();
  }, []);

  async function captureProof() {
    if (submitting || !riderFeatures.deliveryV3Accept) return;
    setMessage(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage('ต้องอนุญาต Camera เพื่อถ่ายรูปยืนยันการส่ง');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      quality: 0.7,
      allowsEditing: false,
    });

    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
    setUploadedProofPath(null);
  }

  async function submitProof() {
    if (!subId || !photo || submitting || !riderFeatures.deliveryV3Accept) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const activeSession = await ensureFreshRiderSession(session);
      if (activeSession !== session) setSession(activeSession);

      const proofPath = uploadedProofPath ?? await uploadPrivateDeliveryProof(activeSession, {
        subId,
        uri: photo.uri,
        mimeType: photo.mimeType,
      });
      setUploadedProofPath(proofPath);
      const result = await completeDeliveryV3(activeSession, subId, proofPath);
      if (result.result !== 'delivered' && result.result !== 'already_delivered') {
        throw new Error('unexpected_delivery_completion_result');
      }
      router.back();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setMessage(friendlyError(text));
    } finally {
      setSubmitting(false);
    }
  }

  const routeEnabled = riderFeatures.deliveryV3Accept;
  const enabled = Boolean(routeEnabled && session && subId && photo && !submitting);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PROOF OF DELIVERY</Text>
          <Text style={styles.title}>ถ่ายรูปยืนยันการส่ง</Text>
          <Text style={styles.subtitle}>งาน {subId ?? '-'}</Text>
        </View>

        <View style={styles.preview}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>ยังไม่มีรูป</Text>
              <Text style={styles.placeholderText}>ถ่ายรูปหลังส่งอาหารให้ลูกค้าเรียบร้อยแล้ว</Text>
            </View>
          )}
        </View>

        <Pressable accessibilityRole="button" disabled={submitting || !routeEnabled} style={[styles.cameraButton, (submitting || !routeEnabled) && styles.disabled]} onPress={() => void captureProof()}>
          <Text style={styles.cameraButtonText}>{photo ? 'ถ่ายใหม่' : 'เปิดกล้องถ่ายรูป'}</Text>
        </Pressable>

        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>Private Proof</Text>
          <Text style={styles.securityText}>
            รูปจะอัปโหลดเข้า private Storage ที่ผูกกับงานนี้โดยตรง และ backend จะปิดงานได้เฉพาะ Rider ที่ถูก assign หลัง Pickup เท่านั้น
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!enabled}
          style={[styles.completeButton, !enabled && styles.disabled]}
          onPress={() => void submitProof()}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : (
            <Text style={styles.completeButtonText}>
              {routeEnabled ? 'ส่งรูป + ยืนยันส่งสำเร็จ' : 'Proof รอ Delivery V3 production gate'}
            </Text>
          )}
        </Pressable>

        {uploadedProofPath && submitting === false && message && (
          <Text style={styles.retryHint}>รูปขึ้น private Storage แล้ว หากการปิดงานไม่สำเร็จ ปุ่มเดิมจะ retry โดยไม่อัปโหลดรูปซ้ำ</Text>
        )}
        {message && <Text style={styles.message}>{message}</Text>}

        <Pressable accessibilityRole="button" disabled={submitting} style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>กลับไปงานปัจจุบัน</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, gap: 16 },
  header: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 27, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 13, color: '#667085' },
  preview: { aspectRatio: 4 / 3, overflow: 'hidden', borderRadius: 18, backgroundColor: '#EAECF0', borderWidth: 1, borderColor: '#D0D5DD' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  placeholderTitle: { fontSize: 18, fontWeight: '800', color: '#344054' },
  placeholderText: { textAlign: 'center', fontSize: 13, lineHeight: 19, color: '#667085' },
  cameraButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#163E72' },
  cameraButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  securityCard: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  securityTitle: { fontSize: 14, fontWeight: '800', color: '#067647' },
  securityText: { fontSize: 13, lineHeight: 19, color: '#05603A' },
  completeButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#067647' },
  completeButtonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  retryHint: { fontSize: 12, lineHeight: 18, color: '#475467' },
  message: { fontSize: 13, lineHeight: 19, color: '#B42318' },
  backButton: { alignItems: 'center', paddingVertical: 10 },
  backButtonText: { fontWeight: '700', color: '#475467' },
});

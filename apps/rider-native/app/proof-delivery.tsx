import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function ProofDeliveryScreen() {
  const router = useRouter();
  const { subId } = useLocalSearchParams<{ subId: string }>();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function captureProof() {
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

    if (result.canceled || !result.assets[0]?.uri) return;
    setPhotoUri(result.assets[0].uri);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PROOF OF DELIVERY</Text>
          <Text style={styles.title}>ถ่ายรูปยืนยันการส่ง</Text>
          <Text style={styles.subtitle}>งาน {subId ?? '-'}</Text>
        </View>

        <View style={styles.preview}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>ยังไม่มีรูป</Text>
              <Text style={styles.placeholderText}>ถ่ายรูปหลังส่งอาหารให้ลูกค้าเรียบร้อยแล้ว</Text>
            </View>
          )}
        </View>

        <Pressable accessibilityRole="button" style={styles.cameraButton} onPress={captureProof}>
          <Text style={styles.cameraButtonText}>{photoUri ? 'ถ่ายใหม่' : 'เปิดกล้องถ่ายรูป'}</Text>
        </Pressable>

        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>Server upload ยังถูกล็อกไว้</Text>
          <Text style={styles.securityText}>
            รูปที่ถ่ายตอนนี้อยู่ในเครื่องเท่านั้น จนกว่า MyTree จะยืนยัน private Storage policy สำหรับ Rider ที่ถูก assign งานนี้โดยเฉพาะ
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled
          style={[styles.completeButton, styles.disabled]}
        >
          <Text style={styles.completeButtonText}>ส่งรูป + ปิดงาน (รอ Storage gate)</Text>
        </Pressable>

        {message && <Text style={styles.message}>{message}</Text>}

        <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>กลับไปงานปัจจุบัน</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { flex: 1, padding: 20, gap: 16 },
  header: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#246B50' },
  title: { fontSize: 27, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 13, color: '#667085' },
  preview: {
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#EAECF0',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  placeholderTitle: { fontSize: 18, fontWeight: '800', color: '#344054' },
  placeholderText: { textAlign: 'center', fontSize: 13, lineHeight: 19, color: '#667085' },
  cameraButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#163E72' },
  cameraButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  securityCard: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  securityTitle: { fontSize: 14, fontWeight: '800', color: '#93370D' },
  securityText: { fontSize: 13, lineHeight: 19, color: '#854A0E' },
  completeButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#067647' },
  completeButtonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  message: { fontSize: 13, lineHeight: 19, color: '#B42318' },
  backButton: { alignItems: 'center', paddingVertical: 10 },
  backButtonText: { fontWeight: '700', color: '#475467' },
});

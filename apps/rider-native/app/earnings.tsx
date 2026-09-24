import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RiderEarningsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>รายได้</Text>
        <Text style={styles.title}>สรุปรายได้ Rider</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>รายได้วันนี้อยู่ที่หน้าหลักแล้ว</Text>
          <Text style={styles.cardText}>หน้านี้เตรียมไว้สำหรับสรุปรายวัน รายสัปดาห์ และรายละเอียดค่าส่งต่อเที่ยวเมื่อ backend report พร้อม</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F2' },
  container: { padding: 20, gap: 14 },
  eyebrow: { fontSize: 12, fontWeight: '900', color: '#246B50' },
  title: { fontSize: 28, fontWeight: '900', color: '#112235' },
  card: { gap: 6, padding: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5D7' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: '#1D2939' },
  cardText: { fontSize: 14, lineHeight: 20, color: '#667085' },
});

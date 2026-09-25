import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RiderHistoryScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>ประวัติงาน</Text>
        <Text style={styles.title}>งานที่ผ่านมาของฉัน</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ยังไม่มีรายการแสดง</Text>
          <Text style={styles.cardText}>เมื่อระบบอ่านประวัติงาน Rider จาก backend ได้ครบ รายการงานที่ส่งสำเร็จ ยกเลิก หรือมีเหตุขัดข้องจะแสดงที่นี่</Text>
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

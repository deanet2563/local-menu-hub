import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RiderSettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>ตั้งค่า</Text>
        <Text style={styles.title}>ตั้งค่า Rider</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Push, Location และ Diagnostics</Text>
          <Text style={styles.cardText}>การตรวจ Push และตำแหน่งยังอยู่ที่หน้าหลักแบบย่อ และหน้านี้เป็นที่สำหรับ diagnostics ละเอียดโดยไม่รบกวน dashboard รับงาน</Text>
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

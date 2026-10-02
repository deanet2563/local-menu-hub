import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RiderChatScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>แชท</Text>
        <Text style={styles.title}>ข้อความงานส่ง</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ช่องทางติดต่อระหว่างงาน</Text>
          <Text style={styles.cardText}>ตอนนี้งานปัจจุบันมีปุ่มโทรร้านและโทรลูกค้าเมื่อได้รับอนุญาต หน้านี้เป็นทางเข้าหลักสำหรับแชทเมื่อ backend chat เปิดใช้กับ Rider</Text>
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

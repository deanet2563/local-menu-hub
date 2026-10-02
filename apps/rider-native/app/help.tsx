import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RiderHelpScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>ช่วยเหลือ</Text>
        <Text style={styles.title}>ศูนย์ช่วยเหลือ Rider</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ปัญหาระหว่างรับงาน</Text>
          <Text style={styles.cardText}>หากมีปัญหาก่อนรับสินค้า ให้ใช้ปุ่มปล่อยงานในงานปัจจุบันพร้อมเหตุผล หลังรับสินค้าแล้วให้ติดต่อทีมงานเพื่อไม่ให้ประวัติการส่งเสียหาย</Text>
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

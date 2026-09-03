import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

const items = [
  { icon: '🏪', title: 'ตั้งค่าร้าน / Onboarding', note: 'Logo · Cover · QR · Location · Social · เวลาเปิดร้าน', route: '/settings' },
  { icon: '🗂️', title: 'จัดการหมวดหมู่', note: 'สร้างหมวดเมนูหลักของร้านและเปิด/ปิดการใช้งาน', route: '/categories' },
  { icon: '⚙️', title: 'Customize Options', note: 'คลัง Option กลางของร้าน แบ่งหมวดและใช้ซ้ำกับหลายเมนู', route: '/customize' },
  { icon: '📦', title: 'รายการออเดอร์', note: 'ดูออเดอร์ล่าสุดและเปิดรายละเอียดงาน', route: '/orders' },
] as const;

export default function ManageScreen() {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MERCHANT TOOLS</Text>
    <Text style={styles.title}>จัดการร้าน</Text>
    <Text style={styles.subtitle}>ตั้งค่าร้านและโครงสร้างเมนูทั้งหมดจากจุดเดียว</Text>

    <View style={styles.list}>
      {items.map((item) => <Pressable key={item.route} onPress={() => router.push(item.route)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.icon}><Text style={styles.iconText}>{item.icon}</Text></View>
        <View style={styles.copy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.note}>{item.note}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>)}
    </View>

    <View style={styles.nextCard}>
      <Text style={styles.nextTitle}>Phase 1 กำลังต่อ</Text>
      <Text style={styles.nextText}>ถัดจากนี้จะเชื่อม “เพิ่ม/แก้ไขเมนู” ให้เลือก Category และ All Customize Options จากคลังกลางนี้ จากนั้นต่อ Delivery Settings และ Order Status flow</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 50 },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { marginTop: 5, color: '#12261E', fontSize: 30, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', fontSize: 14 },
  list: { marginTop: 20 }, card: { minHeight: 92, flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 14, borderRadius: 21, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' },
  icon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF5F1' }, iconText: { fontSize: 24 }, copy: { flex: 1, marginLeft: 13 }, cardTitle: { color: '#12261E', fontSize: 15, fontWeight: '900' }, note: { marginTop: 4, color: '#7A8981', fontSize: 12, lineHeight: 17 }, chevron: { color: '#9BA8A1', fontSize: 28, marginLeft: 6 },
  nextCard: { marginTop: 12, padding: 17, borderRadius: 20, backgroundColor: '#12261E' }, nextTitle: { color: '#fff', fontWeight: '900', fontSize: 15 }, nextText: { marginTop: 6, color: '#C7D5CF', fontSize: 12, lineHeight: 19 }, pressed: { opacity: 0.72 },
});

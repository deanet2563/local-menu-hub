import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

type HealthRowProps = {
  label: string;
  value: string;
  ready?: boolean;
};

function HealthRow({ label, value, ready = false }: HealthRowProps) {
  return (
    <View style={styles.healthRow}>
      <View style={[styles.dot, ready ? styles.dotReady : styles.dotPending]} />
      <View style={styles.healthText}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function RiderHomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FOOD DELIVERY ONLY</Text>
          <Text style={styles.title}>พร้อมรับงาน</Text>
          <Text style={styles.subtitle}>
            Phase 1 foundation: notification, location, account eligibility, and nearby jobs.
          </Text>
        </View>

        <View style={styles.card}>
          <HealthRow label="บัญชีไรเดอร์" value="ยังไม่ได้เชื่อม MyTree session" />
          <HealthRow label="การแจ้งเตือน" value="รอขอ permission" />
          <HealthRow label="ตำแหน่ง" value="รอขอ permission" />
          <HealthRow label="สถานะ" value="Offline" />
        </View>

        <Pressable style={styles.primaryButton} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>ตั้งค่าความพร้อมรับงาน</Text>
        </Pressable>

        <Text style={styles.note}>
          งานใหม่จะใช้ native push เป็นหลัก ส่วนข้อมูลขณะเปิดแอปจะ sync กับ MyTree backend/realtime.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#246B50',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#112235',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5B6877',
  },
  card: {
    gap: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotReady: {
    backgroundColor: '#2F855A',
  },
  dotPending: {
    backgroundColor: '#D69E2E',
  },
  healthText: {
    flex: 1,
  },
  healthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  healthValue: {
    marginTop: 2,
    fontSize: 13,
    color: '#667085',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#163E72',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
  },
});

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { registerShop } from '../src/data/shopProfile';

const DAYS = [
  ['mon', 'จ'], ['tue', 'อ'], ['wed', 'พ'], ['thu', 'พฤ'], ['fri', 'ศ'], ['sat', 'ส'], ['sun', 'อา'],
] as const;

export default function ShopSignupScreen() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [openDays, setOpenDays] = useState<string[]>(DAYS.map(([key]) => key));
  const [mapsLink, setMapsLink] = useState('');
  const [deliveryZone, setDeliveryZone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: string) => {
    setOpenDays((current) => current.includes(day) ? current.filter((x) => x !== day) : [...current, day]);
  };

  const submit = async () => {
    if (!name.trim()) return setError('กรอกชื่อร้าน');
    if (!openDays.length) return setError('เลือกวันเปิดร้านอย่างน้อย 1 วัน');
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await registerShop({
        name: name.trim(),
        category: category.trim() || null,
        phone: phone.trim() || null,
        openTime: openTime.trim() || null,
        closeTime: closeTime.trim() || null,
        openDays,
        googleMapsLink: mapsLink.trim() || null,
        deliveryZone: deliveryZone.trim() || null,
      });
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'สมัครร้านไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>MYTREE MERCHANT</Text>
      <Text style={styles.title}>สมัครร้านค้า</Text>
      <Text style={styles.subtitle}>ใช้บัญชี LINE เดิมของคุณ ร้านใหม่จะอยู่ในสถานะรอแอดมินอนุมัติก่อนเปิดขาย</Text>

      <View style={styles.card}>
        <Text style={styles.label}>ชื่อร้าน *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="ชื่อร้าน" />
        <Text style={styles.label}>หมวดร้าน</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="เช่น อาหารตามสั่ง, เบเกอรี่" />
        <Text style={styles.label}>เบอร์โทร</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="เบอร์โทรร้าน" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>วันและเวลาเปิดร้าน</Text>
        <View style={styles.dayRow}>
          {DAYS.map(([key, label]) => {
            const active = openDays.includes(key);
            return (
              <Pressable key={key} onPress={() => toggleDay(key)} style={[styles.day, active && styles.dayActive]}>
                <Text style={[styles.dayText, active && styles.dayTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.timeRow}>
          <View style={styles.timeBox}><Text style={styles.label}>เปิด</Text><TextInput style={styles.input} value={openTime} onChangeText={setOpenTime} placeholder="08:00" /></View>
          <View style={styles.timeBox}><Text style={styles.label}>ปิด</Text><TextInput style={styles.input} value={closeTime} onChangeText={setCloseTime} placeholder="18:00" /></View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Google Maps link</Text>
        <TextInput style={styles.input} value={mapsLink} onChangeText={setMapsLink} autoCapitalize="none" placeholder="https://maps.google.com/..." />
        <Text style={styles.label}>พื้นที่ส่ง</Text>
        <TextInput style={styles.input} value={deliveryZone} onChangeText={setDeliveryZone} placeholder="เช่น หมู่บ้านสัมมากร" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={submitting} onPress={() => void submit()} style={[styles.primary, submitting && styles.disabled]}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>ส่งใบสมัครร้านค้า</Text>}
      </Pressable>
      <Text style={styles.note}>หลังสมัคร คุณยังเตรียมข้อมูลร้านได้ แต่การเปิดขายต้องรอแอดมินอนุมัติ</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, backgroundColor: '#F7FAF7', gap: 14 },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, fontWeight: '800', color: '#52705B' },
  title: { fontSize: 28, fontWeight: '800', color: '#173C2C' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#647168' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4ECE6', borderRadius: 20, padding: 16, gap: 9 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#173C2C' },
  label: { fontSize: 13, fontWeight: '700', color: '#52705B' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#DDE6DF', paddingHorizontal: 12, backgroundColor: '#fff', color: '#173C2C' },
  dayRow: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EEF3EF' },
  dayActive: { backgroundColor: '#173C2C' },
  dayText: { fontSize: 12, fontWeight: '700', color: '#647168' },
  dayTextActive: { color: '#fff' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeBox: { flex: 1, gap: 6 },
  primary: { minHeight: 54, borderRadius: 16, backgroundColor: '#173C2C', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  error: { color: '#A13A36', lineHeight: 20 },
  note: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: '#7B877F' },
});

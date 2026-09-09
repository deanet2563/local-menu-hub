import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { createShopPromotion, deleteShopPromotion, loadOwnedShopPromotions, setShopPromotionActive, type ShopPromotion } from '../src/data/shopPromotions';

export default function PromotionsScreen() {
  const [rows, setRows] = useState<ShopPromotion[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await loadOwnedShopPromotions());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดโปรโมชั่นไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      await createShopPromotion({ title, description });
      setTitle(''); setDescription('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'สร้างโปรโมชั่นไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  async function toggle(row: ShopPromotion, active: boolean) {
    try { await setShopPromotionActive(row.promotion_id, active); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'อัปเดตโปรโมชั่นไม่สำเร็จ'); }
  }

  function remove(row: ShopPromotion) {
    Alert.alert('ลบโปรโมชั่น', `ลบ “${row.title}” ใช่ไหม?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => void (async () => { try { await deleteShopPromotion(row.promotion_id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'ลบโปรโมชั่นไม่สำเร็จ'); } })() },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดโปรโมชั่น…</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>STORE PROMOTION</Text>
    <Text style={styles.title}>โปรโมชั่น</Text>
    <Text style={styles.subtitle}>โปรโมชั่นที่เปิดใช้งานจะแสดงด้านบนสุดของหน้าร้าน ก่อนรายการเมนู</Text>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.card}>
      <Text style={styles.cardTitle}>สร้างโปรโมชั่นใหม่</Text>
      <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="เช่น ซื้อครบ 200 บาท ส่งฟรี" placeholderTextColor="#9AA69F" style={styles.input} />
      <TextInput value={description} onChangeText={setDescription} maxLength={1000} multiline placeholder="รายละเอียดโปรโมชั่น (ไม่บังคับ)" placeholderTextColor="#9AA69F" style={[styles.input, styles.textarea]} />
      <Pressable disabled={saving || !title.trim()} onPress={() => void add()} style={[styles.primary, (saving || !title.trim()) && styles.disabled]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>เพิ่มโปรโมชั่น</Text>}
      </Pressable>
    </View>

    <Text style={styles.sectionTitle}>โปรโมชั่นทั้งหมด</Text>
    {rows.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>ยังไม่มีโปรโมชั่น</Text></View> : rows.map((row) => <View key={row.promotion_id} style={styles.promoCard}>
      <View style={styles.promoTop}><View style={{ flex: 1 }}><Text style={styles.promoTitle}>{row.title}</Text>{row.description ? <Text style={styles.promoDesc}>{row.description}</Text> : null}</View><Switch value={row.is_active} onValueChange={(value) => void toggle(row, value)} /></View>
      <Text style={styles.status}>{row.is_active ? '● แสดงบนหน้าร้าน' : '○ ปิดการแสดงผล'}</Text>
      <Pressable onPress={() => remove(row)} style={styles.deleteButton}><Text style={styles.deleteText}>ลบโปรโมชั่น</Text></Pressable>
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 56 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#F5F7F6' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { marginTop: 5, color: '#12261E', fontSize: 29, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', fontSize: 13, lineHeight: 20 }, muted: { color: '#7B8982', fontSize: 12 },
  card: { marginTop: 18, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, cardTitle: { color: '#12261E', fontSize: 16, fontWeight: '900' },
  input: { marginTop: 10, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FBFCFB', paddingHorizontal: 12, color: '#243B31' }, textarea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }, primary: { marginTop: 12, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, primaryText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: 0.45 },
  sectionTitle: { marginTop: 20, marginBottom: 4, color: '#12261E', fontSize: 17, fontWeight: '900' }, promoCard: { marginTop: 9, padding: 16, borderRadius: 20, backgroundColor: '#FFF7E7', borderWidth: 1, borderColor: '#F3D89F' }, promoTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, promoTitle: { color: '#633F0E', fontSize: 15, fontWeight: '900' }, promoDesc: { marginTop: 5, color: '#826331', fontSize: 12, lineHeight: 18 }, status: { marginTop: 10, color: '#A07120', fontSize: 11, fontWeight: '800' }, deleteButton: { marginTop: 11, minHeight: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }, deleteText: { color: '#A13A36', fontWeight: '800', fontSize: 12 }, empty: { marginTop: 9, padding: 22, borderRadius: 18, alignItems: 'center', backgroundColor: '#fff' }, errorBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' },
});

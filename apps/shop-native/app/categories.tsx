import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import { addShopMenuCategory, loadShopMenuCategories, renameShopMenuCategory, setShopMenuCategoryActive, type ShopMenuCategory } from '../src/data/shopMenuConfig';

export default function CategoriesScreen() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [items, setItems] = useState<ShopMenuCategory[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      setShopId(shop.shop_id);
      setItems(await loadShopMenuCategories(shop.shop_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดหมวดหมู่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!shopId || saving) return;
    setSaving(true);
    try {
      await addShopMenuCategory(shopId, name);
      setName('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มหมวดหมู่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  function rename(item: ShopMenuCategory) {
    Alert.prompt?.('แก้ไขชื่อหมวดหมู่', undefined, async (value) => {
      if (!value?.trim()) return;
      try { await renameShopMenuCategory(item.category_id, value); await load(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'แก้ไขไม่สำเร็จ'); }
    }, 'plain-text', item.name);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดหมวดหมู่…</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MENU STRUCTURE</Text>
    <Text style={styles.title}>จัดการหมวดหมู่</Text>
    <Text style={styles.subtitle}>สร้างหมวดหลักของร้าน เช่น ซาลาเปา · เครื่องดื่ม · ขนมไทย แล้วใช้ซ้ำตอนเพิ่มเมนู</Text>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.addCard}>
      <Text style={styles.cardTitle}>เพิ่มหมวดหมู่ใหม่</Text>
      <TextInput value={name} onChangeText={setName} placeholder="เช่น ซาลาเปา" style={styles.input} />
      <Pressable disabled={saving} onPress={() => void add()} style={({ pressed }) => [styles.primary, pressed && styles.pressed, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>+ เพิ่มหมวดหมู่</Text>}
      </Pressable>
    </View>

    <Text style={styles.sectionTitle}>หมวดหมู่ของร้าน</Text>
    {items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>ยังไม่มีหมวดหมู่</Text><Text style={styles.muted}>เพิ่มหมวดหมู่แรกด้านบนได้เลย</Text></View> : items.map((item, index) => <View key={item.category_id} style={styles.rowCard}>
      <View style={styles.sort}><Text style={styles.sortText}>{index + 1}</Text></View>
      <Pressable onPress={() => rename(item)} style={styles.rowText}>
        <Text style={[styles.name, !item.is_active && styles.inactive]}>{item.name}</Text>
        <Text style={styles.hint}>แตะชื่อเพื่อแก้ไข</Text>
      </Pressable>
      <Switch value={item.is_active} onValueChange={(value) => void setShopMenuCategoryActive(item.category_id, value).then(load).catch((e) => setError(e.message))} trackColor={{ true: '#8ED4BA' }} thumbColor={item.is_active ? '#0F8A5F' : undefined} />
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 7, color: '#718078', lineHeight: 21 },
  addCard: { marginTop: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7', borderRadius: 22, padding: 16 },
  cardTitle: { color: '#12261E', fontWeight: '900', fontSize: 16 }, input: { marginTop: 12, borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#FAFCFB' },
  primary: { marginTop: 10, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, primaryText: { color: '#fff', fontWeight: '900' },
  sectionTitle: { marginTop: 22, marginBottom: 10, color: '#12261E', fontWeight: '900', fontSize: 17 },
  rowCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 9, backgroundColor: '#fff', borderRadius: 18, padding: 13, borderWidth: 1, borderColor: '#E4EBE7' },
  sort: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4F1' }, sortText: { color: '#527064', fontWeight: '900' },
  rowText: { flex: 1, marginLeft: 12 }, name: { color: '#12261E', fontSize: 15, fontWeight: '900' }, inactive: { color: '#98A39D', textDecorationLine: 'line-through' }, hint: { marginTop: 2, color: '#9AA59F', fontSize: 11 },
  errorBox: { marginTop: 14, backgroundColor: '#FFF0EE', borderRadius: 14, padding: 12 }, error: { color: '#A13A36' },
  empty: { backgroundColor: '#fff', borderRadius: 18, padding: 22, alignItems: 'center' }, emptyTitle: { color: '#12261E', fontWeight: '900' }, muted: { color: '#718078', marginTop: 5 },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 },
});

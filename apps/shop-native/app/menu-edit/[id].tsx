import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getOwnedShopProfile } from '../../src/data/shopProfile';
import { loadShopCustomizeGroups, loadShopMenuCategories, type ShopCustomizeGroup, type ShopMenuCategory } from '../../src/data/shopMenuConfig';
import { loadMenuCustomizeAssignments, loadShopMenuItems, replaceMenuCustomizeAssignments, updateShopMenuItem, type ShopMenuItem } from '../../src/data/shopMenuItems';

export default function MenuEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ShopMenuItem | null>(null);
  const [categories, setCategories] = useState<ShopMenuCategory[]>([]);
  const [groups, setGroups] = useState<ShopCustomizeGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      const [items, categoryRows, groupRows, assignments] = await Promise.all([
        loadShopMenuItems(shop.shop_id),
        loadShopMenuCategories(shop.shop_id),
        loadShopCustomizeGroups(shop.shop_id),
        loadMenuCustomizeAssignments(id),
      ]);
      const found = items.find((row) => row.item_id === id) ?? null;
      if (!found) throw new Error('ไม่พบเมนูนี้');
      setItem(found);
      setName(found.name);
      setPrice(String(Number(found.price)));
      setCategory(found.category);
      setAvailable(found.is_available);
      setCategories(categoryRows.filter((row) => row.is_active));
      setGroups(groupRows.filter((row) => row.is_active));
      setSelectedGroups(assignments.map((row) => row.group_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดเมนูไม่สำเร็จ');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  function toggleGroup(groupId: string) {
    setSelectedGroups((old) => old.includes(groupId) ? old.filter((value) => value !== groupId) : [...old, groupId]);
  }

  async function save() {
    if (!id || !item || saving) return;
    const nextPrice = Number(price);
    setSaving(true); setError(null);
    try {
      await updateShopMenuItem(id, { name, price: nextPrice, category, is_available: available });
      await replaceMenuCustomizeAssignments(id, selectedGroups);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกเมนูไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดเมนู…</Text></View>;
  if (!item) return <View style={styles.center}><Text style={styles.error}>{error || 'ไม่พบเมนู'}</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>EDIT MENU</Text>
    <Text style={styles.title}>{item.name}</Text>
    <Text style={styles.subtitle}>แก้ชื่อ ราคา หมวด สถานะขาย และ Customize Options ของเมนูนี้</Text>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.card}>
      <Text style={styles.label}>ชื่อเมนู</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} />
      <Text style={styles.label}>ราคา</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
      <View style={styles.availableRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>เปิดขาย</Text><Text style={styles.rowNote}>ปิดแล้วสินค้ายังแสดงได้ แต่ต้องแสดง Tag สินค้าหมด/สั่งไม่ได้ใน Customer UI</Text></View><Switch value={available} onValueChange={setAvailable} trackColor={{ true: '#8ED4BA' }} thumbColor={available ? '#0F8A5F' : undefined} /></View>
    </View>

    <View style={styles.card}>
      <Text style={styles.cardTitle}>หมวดหมู่</Text>
      <View style={styles.chips}>{categories.map((row) => <Pressable key={row.category_id} onPress={() => setCategory(category === row.name ? null : row.name)} style={[styles.chip, category === row.name && styles.chipSelected]}><Text style={[styles.chipText, category === row.name && styles.chipTextSelected]}>{row.name}</Text></Pressable>)}</View>
      {categories.length === 0 ? <Text style={styles.helper}>ยังไม่มีหมวดหมู่ที่เปิดใช้งาน</Text> : null}
    </View>

    <View style={styles.card}>
      <Text style={styles.cardTitle}>All Customize Options</Text>
      <Text style={styles.helper}>เลือกชุดจากคลังกลางของร้าน เมนูนี้จะใช้เฉพาะชุดที่เลือกไว้</Text>
      <View style={styles.groupList}>{groups.map((group) => {
        const selected = selectedGroups.includes(group.group_id);
        return <Pressable key={group.group_id} onPress={() => toggleGroup(group.group_id)} style={[styles.groupCard, selected && styles.groupSelected]}>
          <View style={styles.checkBox}>{selected ? <Text style={styles.check}>✓</Text> : null}</View>
          <View style={{ flex: 1 }}><Text style={[styles.groupSection, selected && styles.selectedText]}>{group.section_name}</Text><Text style={[styles.groupName, selected && styles.selectedText]}>{group.name}</Text><Text style={[styles.groupOptions, selected && styles.selectedMuted]}>{group.shop_customize_options.filter((o) => o.is_active).map((o) => o.label).join(' · ') || 'ยังไม่มีตัวเลือก'}</Text></View>
        </Pressable>;
      })}</View>
      {groups.length === 0 ? <Text style={styles.helper}>ยังไม่มี Customize Group ที่เปิดใช้งาน</Text> : null}
    </View>

    <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && styles.pressed]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>บันทึกการแก้ไข</Text>}</Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 55 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 20 }, muted: { color: '#718078' },
  card: { marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, cardTitle: { color: '#12261E', fontWeight: '900', fontSize: 17 }, label: { marginTop: 10, color: '#52645C', fontSize: 12, fontWeight: '800' }, input: { marginTop: 7, minHeight: 47, borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, paddingHorizontal: 13, backgroundColor: '#FAFCFB' },
  availableRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EDF1EF', flexDirection: 'row', alignItems: 'center' }, rowTitle: { color: '#344A41', fontWeight: '900' }, rowNote: { marginTop: 3, color: '#87958E', fontSize: 11, lineHeight: 16 },
  chips: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EDF2EF' }, chipSelected: { backgroundColor: '#0F8A5F' }, chipText: { color: '#52645C', fontWeight: '800', fontSize: 12 }, chipTextSelected: { color: '#fff' }, helper: { marginTop: 7, color: '#87958E', fontSize: 11, lineHeight: 17 },
  groupList: { marginTop: 10, gap: 8 }, groupCard: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#F6F9F7', borderWidth: 1, borderColor: '#E2E9E5' }, groupSelected: { backgroundColor: '#123E30', borderColor: '#123E30' }, checkBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: '#A7B5AE', alignItems: 'center', justifyContent: 'center' }, check: { color: '#65D3A9', fontWeight: '900' }, groupSection: { color: '#0F8A5F', fontSize: 10, fontWeight: '900' }, groupName: { marginTop: 2, color: '#12261E', fontWeight: '900' }, groupOptions: { marginTop: 3, color: '#7D8B84', fontSize: 11 }, selectedText: { color: '#fff' }, selectedMuted: { color: '#B9CCC3' },
  saveButton: { marginTop: 18, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, saveText: { color: '#fff', fontWeight: '900', fontSize: 15 }, errorBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.72 },
});

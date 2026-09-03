import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import { loadShopMenuCategories, loadShopCustomizeGroups, type ShopCustomizeGroup, type ShopMenuCategory } from '../src/data/shopMenuConfig';
import { createShopMenuItem, loadShopMenuItems, updateShopMenuItem, type ShopMenuItem } from '../src/data/shopMenuItems';

export default function MenuScreen() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [items, setItems] = useState<ShopMenuItem[]>([]);
  const [categories, setCategories] = useState<ShopMenuCategory[]>([]);
  const [groups, setGroups] = useState<ShopCustomizeGroup[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      setShopId(shop.shop_id);
      const [menuRows, categoryRows, groupRows] = await Promise.all([
        loadShopMenuItems(shop.shop_id),
        loadShopMenuCategories(shop.shop_id),
        loadShopCustomizeGroups(shop.shop_id),
      ]);
      setItems(menuRows);
      setCategories(categoryRows.filter((row) => row.is_active));
      setGroups(groupRows.filter((row) => row.is_active));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดเมนูไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, ShopMenuItem[]>();
    for (const item of items) {
      const key = item.category || 'อื่นๆ';
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return Array.from(map.entries());
  }, [items]);

  function toggleGroup(groupId: string) {
    setSelectedGroups((old) => old.includes(groupId) ? old.filter((id) => id !== groupId) : [...old, groupId]);
  }

  async function add() {
    if (!shopId || saving) return;
    setSaving(true);
    try {
      await createShopMenuItem({
        shopId,
        name,
        price: Number(price),
        category,
        customizeGroupIds: selectedGroups,
      });
      setName('');
      setPrice('');
      setCategory(null);
      setSelectedGroups([]);
      setShowAdd(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มเมนูไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดเมนู…</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.topRow}>
      <View style={{ flex: 1 }}><Text style={styles.eyebrow}>MENU MANAGER</Text><Text style={styles.title}>จัดการเมนู</Text><Text style={styles.subtitle}>{items.length} รายการ</Text></View>
      <Pressable onPress={() => setShowAdd((value) => !value)} style={styles.addButton}><Text style={styles.addButtonText}>{showAdd ? 'ปิด' : '+ เพิ่มเมนู'}</Text></Pressable>
    </View>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    {showAdd ? <View style={styles.formCard}>
      <Text style={styles.cardTitle}>เพิ่มเมนูใหม่</Text>
      <TextInput value={name} onChangeText={setName} placeholder="ชื่อเมนู" style={styles.input} />
      <TextInput value={price} onChangeText={setPrice} placeholder="ราคา" keyboardType="numeric" style={styles.input} />

      <Text style={styles.label}>หมวดหมู่</Text>
      <View style={styles.chips}>{categories.length === 0 ? <Text style={styles.helper}>ยังไม่มีหมวดหมู่ — สร้างจาก “จัดการหมวดหมู่” ก่อน หรือบันทึกเป็น “อื่นๆ”</Text> : categories.map((item) => <Pressable key={item.category_id} onPress={() => setCategory(category === item.name ? null : item.name)} style={[styles.chip, category === item.name && styles.chipSelected]}><Text style={[styles.chipText, category === item.name && styles.chipTextSelected]}>{item.name}</Text></Pressable>)}</View>

      <Text style={styles.label}>Customize Options ของเมนูนี้</Text>
      <Text style={styles.helper}>เลือกจาก All List ของร้าน ไม่ต้องสร้าง Option ซ้ำในแต่ละเมนู</Text>
      <View style={styles.groupList}>{groups.length === 0 ? <Text style={styles.helper}>ยังไม่มี Customize Option กลาง</Text> : groups.map((group) => <Pressable key={group.group_id} onPress={() => toggleGroup(group.group_id)} style={[styles.groupChip, selectedGroups.includes(group.group_id) && styles.groupChipSelected]}>
        <Text style={[styles.groupSection, selectedGroups.includes(group.group_id) && styles.groupTextSelected]}>{group.section_name}</Text>
        <Text style={[styles.groupName, selectedGroups.includes(group.group_id) && styles.groupTextSelected]}>{group.name}</Text>
        <Text style={[styles.groupOptions, selectedGroups.includes(group.group_id) && styles.groupTextSelected]} numberOfLines={1}>{group.shop_customize_options.filter((o) => o.is_active).map((o) => o.label).join(' · ') || 'ยังไม่มี Option'}</Text>
      </Pressable>)}</View>

      <Pressable disabled={saving} onPress={() => void add()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>บันทึกเมนู</Text>}</Pressable>
    </View> : null}

    {groupedItems.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>ยังไม่มีเมนู</Text><Text style={styles.muted}>กด “+ เพิ่มเมนู” เพื่อเริ่มต้น</Text></View> : groupedItems.map(([categoryName, categoryItems]) => <View key={categoryName} style={styles.categoryBlock}>
      <Text style={styles.categoryTitle}>{categoryName}</Text>
      {categoryItems.map((item) => <Pressable key={item.item_id} onPress={() => router.push(`/menu-edit/${item.item_id}`)} style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}>
        <View style={{ flex: 1 }}><Text style={[styles.itemName, !item.is_available && styles.inactive]}>{item.name}</Text><Text style={styles.itemMeta}>฿{Number(item.price).toFixed(0)} · {item.category || 'อื่นๆ'}</Text><Text style={styles.editHint}>แตะเพื่อแก้ไข</Text></View>
        <View style={styles.itemRight}><Switch value={item.is_available} onValueChange={(value) => void updateShopMenuItem(item.item_id, { is_available: value }).then(load).catch((e) => setError(e.message))} trackColor={{ true: '#8ED4BA' }} thumbColor={item.is_available ? '#0F8A5F' : undefined} /><Text style={styles.chevron}>›</Text></View>
      </Pressable>)}
    </View>)}

    <View style={styles.infoCard}><Text style={styles.infoTitle}>Customize reuse</Text><Text style={styles.infoText}>เมนูแต่ละรายการใช้ Option จากคลังกลางของร้านได้แล้ว การแก้ไขเมนูสามารถเพิ่ม/ถอด Customize Group ได้โดยไม่ต้องสร้าง Option ใหม่ซ้ำ</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' },
  topRow: { flexDirection: 'row', alignItems: 'center' }, eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 4, color: '#7A8981' },
  addButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12261E' }, addButtonText: { color: '#fff', fontWeight: '900' },
  formCard: { marginTop: 18, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, cardTitle: { color: '#12261E', fontWeight: '900', fontSize: 17 }, input: { marginTop: 10, minHeight: 47, borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, paddingHorizontal: 13, backgroundColor: '#FAFCFB' },
  label: { marginTop: 16, color: '#344A41', fontWeight: '900', fontSize: 13 }, helper: { marginTop: 4, color: '#8A9891', fontSize: 11, lineHeight: 16 }, chips: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EDF2EF' }, chipSelected: { backgroundColor: '#0F8A5F' }, chipText: { color: '#52645C', fontWeight: '800', fontSize: 12 }, chipTextSelected: { color: '#fff' },
  groupList: { marginTop: 9, gap: 8 }, groupChip: { padding: 12, borderRadius: 16, backgroundColor: '#F5F8F6', borderWidth: 1, borderColor: '#E1E8E4' }, groupChipSelected: { backgroundColor: '#123E30', borderColor: '#123E30' }, groupSection: { color: '#0F8A5F', fontWeight: '900', fontSize: 10 }, groupName: { marginTop: 3, color: '#12261E', fontWeight: '900' }, groupOptions: { marginTop: 3, color: '#7C8A83', fontSize: 11 }, groupTextSelected: { color: '#fff' },
  saveButton: { marginTop: 16, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, saveText: { color: '#fff', fontWeight: '900' },
  categoryBlock: { marginTop: 22 }, categoryTitle: { marginBottom: 9, color: '#12261E', fontWeight: '900', fontSize: 18 }, itemCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, itemName: { color: '#12261E', fontWeight: '900', fontSize: 15 }, itemMeta: { marginTop: 4, color: '#7D8B84', fontSize: 12 }, editHint: { marginTop: 4, color: '#0F8A5F', fontSize: 10, fontWeight: '800' }, itemRight: { marginLeft: 10, alignItems: 'center', gap: 3 }, chevron: { color: '#A0ADA6', fontSize: 22 }, inactive: { color: '#9AA59F', textDecorationLine: 'line-through' },
  empty: { marginTop: 18, alignItems: 'center', padding: 22, borderRadius: 18, backgroundColor: '#fff' }, emptyTitle: { color: '#12261E', fontWeight: '900' }, muted: { color: '#718078', marginTop: 5 },
  infoCard: { marginTop: 20, padding: 15, borderRadius: 18, backgroundColor: '#FFF6DF' }, infoTitle: { color: '#785A10', fontWeight: '900' }, infoText: { marginTop: 5, color: '#8D7132', fontSize: 12, lineHeight: 18 }, errorBox: { marginTop: 14, backgroundColor: '#FFF0EE', borderRadius: 14, padding: 12 }, error: { color: '#A13A36' }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 },
});

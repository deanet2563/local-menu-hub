import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import { addCustomizeGroup, addCustomizeOption, loadShopCustomizeGroups, loadShopMenuCategories, setCustomizeGroupActive, setCustomizeOptionActive, type ShopCustomizeGroup, type ShopMenuCategory } from '../src/data/shopMenuConfig';

export default function CustomizeLibraryScreen() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ShopMenuCategory[]>([]);
  const [groups, setGroups] = useState<ShopCustomizeGroup[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [optionLabels, setOptionLabels] = useState('');
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      setShopId(shop.shop_id);
      const [categoryRows, groupRows] = await Promise.all([
        loadShopMenuCategories(shop.shop_id),
        loadShopCustomizeGroups(shop.shop_id),
      ]);
      const activeCategories = categoryRows.filter((row) => row.is_active);
      setCategories(activeCategories);
      setCategoryId((current) => current && activeCategories.some((row) => row.category_id === current) ? current : activeCategories[0]?.category_id ?? null);
      setGroups(groupRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลด Customize Option ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.category_id, category])), [categories]);
  const groupedByCategory = useMemo(() => {
    return categories.map((category) => ({
      category,
      groups: groups.filter((group) => group.category_id === category.category_id),
    }));
  }, [categories, groups]);
  const legacyGroups = useMemo(() => groups.filter((group) => !group.category_id), [groups]);

  async function addGroup() {
    if (!shopId || saving) return;
    setSaving(true); setError(null); setSaved(null);
    try {
      await addCustomizeGroup(shopId, categoryId ?? '', groupName, optionLabels);
      setGroupName('');
      setOptionLabels('');
      await load();
      setSaved('สร้างชุดตัวเลือกสำเร็จแล้ว');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มชุดตัวเลือกไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  async function addOption(groupId: string) {
    const label = optionDrafts[groupId] ?? '';
    const delta = Number(priceDrafts[groupId] ?? '0');
    try {
      setError(null); setSaved(null);
      await addCustomizeOption(groupId, label, Number.isFinite(delta) ? delta : 0);
      setOptionDrafts((old) => ({ ...old, [groupId]: '' }));
      setPriceDrafts((old) => ({ ...old, [groupId]: '' }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มตัวเลือกไม่สำเร็จ');
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดตัวเลือก...</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>SHOP CUSTOMIZE LIBRARY</Text>
    <Text style={styles.title}>ตัวเลือกกลางของร้าน</Text>
    <Text style={styles.subtitle}>สร้าง Product Categories ก่อน แล้วสร้างชุดตัวเลือกไว้ใต้หมวดหมู่สินค้านั้น</Text>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
    {saved ? <View style={styles.successBox}><Text style={styles.success}>{saved}</Text></View> : null}

    {categories.length === 0 ? <View style={styles.empty}>
      <Text style={styles.emptyTitle}>กรุณาสร้างหมวดหมู่สินค้าก่อนสร้างชุดตัวเลือก</Text>
      <Pressable onPress={() => router.push('/categories')} style={styles.primary}><Text style={styles.primaryText}>ไปสร้างหมวดหมู่</Text></Pressable>
    </View> : <View style={styles.addCard}>
      <Text style={styles.cardTitle}>สร้างชุดตัวเลือก</Text>
      <Text style={styles.label}>หมวดหมู่สินค้า</Text>
      <View style={styles.chips}>{categories.map((category) => <Pressable key={category.category_id} onPress={() => { setCategoryId(category.category_id); setSaved(null); }} style={[styles.chip, categoryId === category.category_id && styles.chipSelected]}><Text style={[styles.chipText, categoryId === category.category_id && styles.chipTextSelected]}>{category.name}</Text></Pressable>)}</View>
      <Text style={styles.label}>ชื่อชุดตัวเลือก</Text>
      <TextInput value={groupName} onChangeText={(value) => { setGroupName(value); setSaved(null); }} placeholder="เช่น ระดับความหวาน" style={styles.input} />
      <Text style={styles.label}>ตัวเลือก</Text>
      <TextInput value={optionLabels} onChangeText={(value) => { setOptionLabels(value); setSaved(null); }} placeholder="หวานมาก, หวานกลาง, หวานน้อย" style={styles.input} />
      <Pressable disabled={saving} onPress={() => void addGroup()} style={({ pressed }) => [styles.primary, pressed && styles.pressed, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>สร้างชุดตัวเลือก</Text>}
      </Pressable>
    </View>}

    {groupedByCategory.map(({ category, groups: categoryGroups }) => <View key={category.category_id} style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{category.name}</Text>
      {categoryGroups.length === 0 ? <Text style={styles.helper}>ยังไม่มีชุดตัวเลือกในหมวดนี้</Text> : categoryGroups.map((group) => <GroupCard key={group.group_id} group={group} categoryName={category.name} optionDrafts={optionDrafts} priceDrafts={priceDrafts} setOptionDrafts={setOptionDrafts} setPriceDrafts={setPriceDrafts} addOption={addOption} load={load} setError={setError} />)}
    </View>)}

    {legacyGroups.length > 0 ? <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>Legacy Customize</Text>
      <Text style={styles.helper}>รายการเดิมที่ยังไม่ผูก category_id จะแสดงเพื่อความเข้ากันได้ แต่การสร้างใหม่ต้องเลือกหมวดหมู่สินค้า</Text>
      {legacyGroups.map((group) => <GroupCard key={group.group_id} group={group} categoryName={categoryById.get(group.category_id ?? '')?.name ?? group.section_name} optionDrafts={optionDrafts} priceDrafts={priceDrafts} setOptionDrafts={setOptionDrafts} setPriceDrafts={setPriceDrafts} addOption={addOption} load={load} setError={setError} />)}
    </View> : null}
  </ScrollView>;
}

function GroupCard({ group, categoryName, optionDrafts, priceDrafts, setOptionDrafts, setPriceDrafts, addOption, load, setError }: {
  group: ShopCustomizeGroup;
  categoryName: string;
  optionDrafts: Record<string, string>;
  priceDrafts: Record<string, string>;
  setOptionDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPriceDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addOption: (groupId: string) => Promise<void>;
  load: () => Promise<void>;
  setError: (value: string) => void;
}) {
  return <View style={styles.groupCard}>
    <View style={styles.groupHeader}>
      <View style={{ flex: 1 }}><Text style={[styles.groupName, !group.is_active && styles.inactive]}>{group.name}</Text><Text style={styles.groupHint}>{categoryName} · {group.shop_customize_options.filter((o) => o.is_active).length} ตัวเลือกที่เปิดใช้</Text></View>
      <Switch value={group.is_active} onValueChange={(value) => void setCustomizeGroupActive(group.group_id, value).then(load).catch((e) => setError(e.message))} trackColor={{ true: '#8ED4BA' }} thumbColor={group.is_active ? '#0F8A5F' : undefined} />
    </View>
    <View style={styles.optionList}>
      {group.shop_customize_options.map((option) => <View key={option.option_id} style={styles.optionRow}>
        <View style={{ flex: 1 }}><Text style={[styles.optionLabel, !option.is_active && styles.inactive]}>{option.label}</Text>{Number(option.price_delta) !== 0 ? <Text style={styles.priceDelta}>{Number(option.price_delta) > 0 ? '+' : ''}฿{Number(option.price_delta).toFixed(0)}</Text> : null}</View>
        <Switch value={option.is_active} onValueChange={(value) => void setCustomizeOptionActive(option.option_id, value).then(load).catch((e) => setError(e.message))} trackColor={{ true: '#9DD9C3' }} />
      </View>)}
    </View>
    <View style={styles.addOptionRow}>
      <TextInput value={optionDrafts[group.group_id] ?? ''} onChangeText={(value) => setOptionDrafts((old) => ({ ...old, [group.group_id]: value }))} placeholder="เพิ่มตัวเลือก" style={[styles.input, styles.optionInput]} />
      <TextInput value={priceDrafts[group.group_id] ?? ''} onChangeText={(value) => setPriceDrafts((old) => ({ ...old, [group.group_id]: value }))} placeholder="+฿" keyboardType="numeric" style={[styles.input, styles.priceInput]} />
    </View>
    <Pressable onPress={() => void addOption(group.group_id)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>เพิ่ม Option ในชุดนี้</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 21 },
  addCard: { marginTop: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7', borderRadius: 22, padding: 16 }, cardTitle: { color: '#12261E', fontWeight: '900', fontSize: 16 },
  label: { marginTop: 13, color: '#344A41', fontWeight: '900', fontSize: 12 }, input: { marginTop: 10, minHeight: 46, borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, paddingHorizontal: 13, backgroundColor: '#FAFCFB' },
  chips: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EDF2EF' }, chipSelected: { backgroundColor: '#0F8A5F' }, chipText: { color: '#52645C', fontWeight: '800', fontSize: 12 }, chipTextSelected: { color: '#fff' },
  primary: { marginTop: 11, minHeight: 48, borderRadius: 15, backgroundColor: '#0F8A5F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }, primaryText: { color: '#fff', fontWeight: '900' },
  sectionBlock: { marginTop: 22 }, sectionTitle: { color: '#12261E', fontWeight: '900', fontSize: 19, marginBottom: 10 }, helper: { marginTop: 4, color: '#8A9891', fontSize: 11, lineHeight: 16 },
  groupCard: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E4EBE7', padding: 15 }, groupHeader: { flexDirection: 'row', alignItems: 'center' }, groupName: { color: '#12261E', fontWeight: '900', fontSize: 16 }, groupHint: { marginTop: 3, color: '#8B9992', fontSize: 11 },
  optionList: { marginTop: 11, borderTopWidth: 1, borderTopColor: '#EDF1EF' }, optionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#EDF1EF' }, optionLabel: { color: '#344A41', fontWeight: '800' }, priceDelta: { color: '#0F8A5F', fontSize: 11, marginTop: 2 }, inactive: { color: '#9AA59F', textDecorationLine: 'line-through' },
  addOptionRow: { flexDirection: 'row', gap: 8, marginTop: 4 }, optionInput: { flex: 1 }, priceInput: { width: 82 }, secondary: { marginTop: 8, minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF5F1' }, secondaryText: { color: '#0F7653', fontWeight: '900', fontSize: 13 },
  errorBox: { marginTop: 14, backgroundColor: '#FFF0EE', borderRadius: 14, padding: 12 }, error: { color: '#A13A36' }, successBox: { marginTop: 14, backgroundColor: '#E8F7F1', borderRadius: 14, padding: 12 }, success: { color: '#0F7A55', fontWeight: '800' }, empty: { marginTop: 18, backgroundColor: '#fff', borderRadius: 18, padding: 22, alignItems: 'center' }, emptyTitle: { color: '#12261E', fontWeight: '900', textAlign: 'center' }, muted: { color: '#718078', marginTop: 5 }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 },
});

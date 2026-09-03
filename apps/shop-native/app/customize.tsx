import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import { addCustomizeGroup, addCustomizeOption, loadShopCustomizeGroups, setCustomizeGroupActive, setCustomizeOptionActive, type ShopCustomizeGroup } from '../src/data/shopMenuConfig';

export default function CustomizeLibraryScreen() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [groups, setGroups] = useState<ShopCustomizeGroup[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      setShopId(shop.shop_id);
      setGroups(await loadShopCustomizeGroups(shop.shop_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลด Customize Option ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sectionNames = useMemo(() => Array.from(new Set(groups.map((g) => g.section_name))), [groups]);

  async function addGroup() {
    if (!shopId || saving) return;
    setSaving(true);
    try {
      await addCustomizeGroup(shopId, sectionName, groupName);
      setSectionName('');
      setGroupName('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มชุดตัวเลือกไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  async function addOption(groupId: string) {
    const label = optionDrafts[groupId] ?? '';
    const delta = Number(priceDrafts[groupId] ?? '0');
    try {
      await addCustomizeOption(groupId, label, Number.isFinite(delta) ? delta : 0);
      setOptionDrafts((old) => ({ ...old, [groupId]: '' }));
      setPriceDrafts((old) => ({ ...old, [groupId]: '' }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มตัวเลือกไม่สำเร็จ');
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดตัวเลือก…</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>SHOP CUSTOMIZE LIBRARY</Text>
    <Text style={styles.title}>ตัวเลือกกลางของร้าน</Text>
    <Text style={styles.subtitle}>สร้างรายการไว้ครั้งเดียว แล้วตอนเพิ่มเมนูค่อยเลือกว่าจะให้เมนูไหนใช้ Option ชุดใด เช่น “ของคาว → ระดับความเผ็ด” หรือ “ซาลาเปา → การอุ่น”</Text>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.addCard}>
      <Text style={styles.cardTitle}>สร้างชุดตัวเลือก</Text>
      <TextInput value={sectionName} onChangeText={setSectionName} placeholder="หมวด เช่น ของคาว / ซาลาเปา" style={styles.input} />
      <TextInput value={groupName} onChangeText={setGroupName} placeholder="ชื่อชุด เช่น ระดับความเผ็ด / การอุ่น" style={styles.input} />
      <Pressable disabled={saving} onPress={() => void addGroup()} style={({ pressed }) => [styles.primary, pressed && styles.pressed, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>+ สร้างชุดตัวเลือก</Text>}
      </Pressable>
    </View>

    {sectionNames.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>ยังไม่มี Customize Option</Text><Text style={styles.muted}>เริ่มจากสร้างหมวดและชุดตัวเลือกด้านบน</Text></View> : sectionNames.map((section) => <View key={section} style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{section}</Text>
      {groups.filter((g) => g.section_name === section).map((group) => <View key={group.group_id} style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <View style={{ flex: 1 }}><Text style={[styles.groupName, !group.is_active && styles.inactive]}>{group.name}</Text><Text style={styles.groupHint}>{group.shop_customize_options.filter((o) => o.is_active).length} ตัวเลือกที่เปิดใช้</Text></View>
          <Switch value={group.is_active} onValueChange={(value) => void setCustomizeGroupActive(group.group_id, value).then(load).catch((e) => setError(e.message))} trackColor={{ true: '#8ED4BA' }} thumbColor={group.is_active ? '#0F8A5F' : undefined} />
        </View>

        <View style={styles.optionList}>
          {group.shop_customize_options.map((option) => <View key={option.option_id} style={styles.optionRow}>
            <View style={{ flex: 1 }}><Text style={[styles.optionLabel, !option.is_active && styles.inactive]}>{option.label}</Text>{Number(option.price_delta) !== 0 ? <Text style={styles.priceDelta}>{Number(option.price_delta) > 0 ? '+' : ''}฿{Number(option.price_delta).toFixed(0)}</Text> : null}</View>
            <Switch value={option.is_active} onValueChange={(value) => void setCustomizeOptionActive(option.option_id, value).then(load).catch((e) => setError(e.message))} trackColor={{ true: '#9DD9C3' }} />
          </View>)}
        </View>

        <View style={styles.addOptionRow}>
          <TextInput value={optionDrafts[group.group_id] ?? ''} onChangeText={(value) => setOptionDrafts((old) => ({ ...old, [group.group_id]: value }))} placeholder="เพิ่มตัวเลือก เช่น เผ็ดน้อย" style={[styles.input, styles.optionInput]} />
          <TextInput value={priceDrafts[group.group_id] ?? ''} onChangeText={(value) => setPriceDrafts((old) => ({ ...old, [group.group_id]: value }))} placeholder="+฿" keyboardType="numeric" style={[styles.input, styles.priceInput]} />
        </View>
        <Pressable onPress={() => void addOption(group.group_id)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>+ เพิ่ม Option ในชุดนี้</Text></Pressable>
      </View>)}
    </View>)}

    <View style={styles.infoCard}><Text style={styles.infoTitle}>ขั้นตอนเวลาเพิ่มเมนู</Text><Text style={styles.infoText}>เมนูใหม่ → เห็น All Customize Options ของร้าน → เลือกเฉพาะชุดที่เมนูนี้ใช้ → กำหนดว่าบังคับเลือกหรือไม่ ระบบจะไม่ให้ร้านพิมพ์ Option ซ้ำใหม่ทุกเมนู</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 21 },
  addCard: { marginTop: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7', borderRadius: 22, padding: 16 }, cardTitle: { color: '#12261E', fontWeight: '900', fontSize: 16 },
  input: { marginTop: 10, minHeight: 46, borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, paddingHorizontal: 13, backgroundColor: '#FAFCFB' },
  primary: { marginTop: 11, minHeight: 48, borderRadius: 15, backgroundColor: '#0F8A5F', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '900' },
  sectionBlock: { marginTop: 22 }, sectionTitle: { color: '#12261E', fontWeight: '900', fontSize: 19, marginBottom: 10 },
  groupCard: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E4EBE7', padding: 15 }, groupHeader: { flexDirection: 'row', alignItems: 'center' }, groupName: { color: '#12261E', fontWeight: '900', fontSize: 16 }, groupHint: { marginTop: 3, color: '#8B9992', fontSize: 11 },
  optionList: { marginTop: 11, borderTopWidth: 1, borderTopColor: '#EDF1EF' }, optionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#EDF1EF' }, optionLabel: { color: '#344A41', fontWeight: '800' }, priceDelta: { color: '#0F8A5F', fontSize: 11, marginTop: 2 }, inactive: { color: '#9AA59F', textDecorationLine: 'line-through' },
  addOptionRow: { flexDirection: 'row', gap: 8, marginTop: 4 }, optionInput: { flex: 1 }, priceInput: { width: 82 }, secondary: { marginTop: 8, minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF5F1' }, secondaryText: { color: '#0F7653', fontWeight: '900', fontSize: 13 },
  infoCard: { marginTop: 20, padding: 16, borderRadius: 20, backgroundColor: '#EAF5FA', borderWidth: 1, borderColor: '#D1E8F1' }, infoTitle: { color: '#184E65', fontWeight: '900' }, infoText: { marginTop: 6, color: '#4F7586', lineHeight: 20, fontSize: 13 },
  errorBox: { marginTop: 14, backgroundColor: '#FFF0EE', borderRadius: 14, padding: 12 }, error: { color: '#A13A36' }, empty: { marginTop: 18, backgroundColor: '#fff', borderRadius: 18, padding: 22, alignItems: 'center' }, emptyTitle: { color: '#12261E', fontWeight: '900' }, muted: { color: '#718078', marginTop: 5 }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 },
});

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import { customerDeliveryFeePreview, getShopDeliverySettings, updateShopDeliverySettings, type DeliveryPricingMode, type ShopDeliverySettings } from '../src/data/shopDeliverySettings';

const MODES: Array<{ value: DeliveryPricingMode; title: string; note: string }> = [
  { value: 'distance', title: 'คิดตามระยะทาง', note: 'ใช้ระบบคำนวณเส้นทางและค่าส่งเดิมของ MyTree' },
  { value: 'flat', title: 'ร้านส่งเอง · ค่าคงที่', note: 'ร้านกำหนดค่าส่งเป็นจำนวนบาท ลูกค้าเห็นก่อนยืนยันออเดอร์' },
  { value: 'free', title: 'ส่งฟรี', note: 'ลูกค้าเห็นค่าส่ง 0 บาทก่อนยืนยันออเดอร์' },
];

export default function DeliverySettingsScreen() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ShopDeliverySettings | null>(null);
  const [flatFee, setFlatFee] = useState('0');
  const [freeMin, setFreeMin] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [previewSubtotal, setPreviewSubtotal] = useState('200');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      setShopId(shop.shop_id);
      const row = await getShopDeliverySettings(shop.shop_id);
      setSettings(row);
      setFlatFee(String(Number(row.delivery_flat_fee) || 0));
      setFreeMin(row.free_delivery_min_order == null ? '' : String(Number(row.free_delivery_min_order)));
      setServiceArea(row.service_area_note ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดตั้งค่าการส่งไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function patch(next: Partial<ShopDeliverySettings>) {
    if (settings?.migration_required) return;
    setSettings((current) => current ? ({ ...current, ...next }) : current);
    setSaved(false);
  }

  async function save() {
    if (!shopId || !settings || saving) return;
    if (settings.migration_required) {
      setError('ต้องอัปเดตฐานข้อมูลค่าส่งลูกค้าก่อนบันทึกหน้านี้');
      return;
    }
    const fee = Number(flatFee || '0');
    const freeMinimum = freeMin.trim() ? Number(freeMin) : null;
    if (!Number.isFinite(fee) || fee < 0) return setError('ค่าส่งไม่ถูกต้อง');
    if (freeMinimum !== null && (!Number.isFinite(freeMinimum) || freeMinimum < 0)) return setError('ยอดขั้นต่ำส่งฟรีไม่ถูกต้อง');
    setSaving(true); setError(null); setSaved(false);
    try {
      await updateShopDeliverySettings(shopId, {
        pickup_enabled: settings.pickup_enabled,
        delivery_enabled: settings.delivery_enabled,
        service_area_note: serviceArea,
        delivery_pricing_mode: settings.delivery_pricing_mode,
        delivery_flat_fee: fee,
        free_delivery_min_order: freeMinimum,
        rider_request_enabled: settings.rider_request_enabled,
      });
      setSaved(true);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  if (loading || !settings) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดการส่ง…</Text></View>;

  const previewSettings: ShopDeliverySettings = {
    ...settings,
    delivery_flat_fee: Number(flatFee || '0') || 0,
    free_delivery_min_order: freeMin.trim() ? Number(freeMin) || 0 : null,
  };
  const subtotal = Number(previewSubtotal || '0') || 0;
  const previewFee = customerDeliveryFeePreview(previewSettings, subtotal, 45);
  const migrationRequired = settings.migration_required === true;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>DELIVERY SETTINGS</Text>
    <Text style={styles.title}>ตั้งค่าการส่ง</Text>
    <Text style={styles.subtitle}>ค่าที่กำหนดตรงนี้ต้องเป็น source of truth เดียวกับ Checkout เพื่อให้ลูกค้าเห็นก่อนกด “ยืนยันออเดอร์”</Text>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
    {saved ? <View style={styles.successBox}><Text style={styles.success}>บันทึกการตั้งค่าการส่งแล้ว</Text></View> : null}
    {migrationRequired ? <View style={styles.warningBox}><Text style={styles.warning}>ต้องอัปเดตฐานข้อมูลค่าส่งลูกค้าก่อนบันทึกหน้านี้</Text></View> : null}

    <View style={styles.card}>
      <Text style={styles.cardTitle}>วิธีรับสินค้า</Text>
      <Row title="ลูกค้ามารับที่ร้าน" note="แสดงตัวเลือก Pickup ใน Checkout" value={settings.pickup_enabled} disabled={migrationRequired} onChange={(value) => patch({ pickup_enabled: value })} />
      <Row title="จัดส่ง" note="เปิดตัวเลือก Delivery ใน Checkout" value={settings.delivery_enabled} disabled={migrationRequired} onChange={(value) => patch({ delivery_enabled: value })} />
    </View>

    <View style={styles.card}>
      <Text style={styles.cardTitle}>ค่าส่งที่ลูกค้าเห็น</Text>
      {MODES.map((mode) => <Pressable key={mode.value} disabled={migrationRequired} onPress={() => patch({ delivery_pricing_mode: mode.value })} style={[styles.modeCard, settings.delivery_pricing_mode === mode.value && styles.modeSelected, migrationRequired && styles.disabled]}>
        <View style={[styles.radio, settings.delivery_pricing_mode === mode.value && styles.radioSelected]} />
        <View style={{ flex: 1 }}><Text style={[styles.modeTitle, settings.delivery_pricing_mode === mode.value && styles.modeTitleSelected]}>{mode.title}</Text><Text style={[styles.modeNote, settings.delivery_pricing_mode === mode.value && styles.modeNoteSelected]}>{mode.note}</Text></View>
      </Pressable>)}

      {settings.delivery_pricing_mode === 'flat' ? <>
        <Text style={styles.label}>ค่าส่งของร้าน (บาท)</Text>
        <TextInput value={flatFee} editable={!migrationRequired} onChangeText={(value) => { setFlatFee(value); setSaved(false); }} keyboardType="numeric" style={styles.input} placeholder="เช่น 30" />
      </> : null}

      {settings.delivery_pricing_mode !== 'free' ? <>
        <Text style={styles.label}>ส่งฟรีเมื่อยอดถึง (ไม่บังคับ)</Text>
        <TextInput value={freeMin} editable={!migrationRequired} onChangeText={(value) => { setFreeMin(value); setSaved(false); }} keyboardType="numeric" style={styles.input} placeholder="เช่น 300 · เว้นว่างถ้าไม่ใช้" />
      </> : null}
    </View>

    <View style={styles.card}>
      <Text style={styles.cardTitle}>พื้นที่และ Rider</Text>
      <Text style={styles.label}>รายละเอียดพื้นที่ส่ง</Text>
      <TextInput value={serviceArea} editable={!migrationRequired} onChangeText={(value) => { setServiceArea(value); setSaved(false); }} style={[styles.input, styles.multiline]} multiline placeholder="เช่น ภายในหมู่บ้านสัมมากรและพื้นที่ใกล้เคียง" />
      <Row title="อนุญาตเรียก MyTree Rider" note="หลังร้านยืนยันยอด + ออเดอร์เสร็จ จึงส่งคำขอ Rider ได้" value={settings.rider_request_enabled} disabled={migrationRequired} onChange={(value) => patch({ rider_request_enabled: value })} />

      <View style={styles.tabs}><View style={[styles.tab, styles.tabActive]}><Text style={styles.tabActiveText}>Rider ที่ร้านติดต่อเอง</Text></View><View style={styles.tab}><Text style={styles.tabText}>Rider Directory</Text></View></View>
      <Text style={styles.tabHint}>โครงแท็บเก็บไว้ตาม Shop flow เดิม ส่วนการเรียกงานจริงจะใช้ Rider flow กลาง: Shop Request → First Accept → Auto Lock → Shop Notified</Text>
    </View>

    <View style={styles.previewCard}>
      <Text style={styles.previewEyebrow}>CUSTOMER CHECKOUT PREVIEW</Text>
      <Text style={styles.previewTitle}>ก่อนยืนยันออเดอร์</Text>
      <Text style={styles.labelDark}>ทดลองยอดสินค้า</Text>
      <TextInput value={previewSubtotal} onChangeText={setPreviewSubtotal} keyboardType="numeric" style={styles.previewInput} />
      <View style={styles.totalRow}><Text style={styles.previewLabel}>สินค้า</Text><Text style={styles.previewValue}>฿{subtotal.toFixed(0)}</Text></View>
      <View style={styles.totalRow}><Text style={styles.previewLabel}>ค่าส่ง</Text><Text style={styles.previewValue}>{previewFee === 0 ? 'ฟรี' : `฿${previewFee.toFixed(0)}`}</Text></View>
      <View style={[styles.totalRow, styles.grandRow]}><Text style={styles.grandLabel}>ยอดรวม</Text><Text style={styles.grandValue}>฿{(subtotal + previewFee).toFixed(0)}</Text></View>
      <View style={styles.confirmMock}><Text style={styles.confirmMockText}>ยืนยันออเดอร์</Text></View>
      {settings.delivery_pricing_mode === 'distance' ? <Text style={styles.distanceNote}>ตัวอย่าง Preview ใช้ค่าส่งระยะทาง 45 บาท; Checkout จริงจะใช้ quote จากเส้นทางจริง</Text> : null}
    </View>

    <Pressable disabled={saving || migrationRequired} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (saving || migrationRequired) && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>บันทึกการตั้งค่าการส่ง</Text>}</Pressable>
  </ScrollView>;
}

function Row({ title, note, value, disabled, onChange }: { title: string; note: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowNote}>{note}</Text></View><Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: '#8ED4BA' }} thumbColor={value ? '#0F8A5F' : undefined} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 21 }, muted: { color: '#718078' },
  card: { marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, cardTitle: { color: '#12261E', fontWeight: '900', fontSize: 17 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF1EF' }, rowTitle: { color: '#344A41', fontWeight: '900', fontSize: 14 }, rowNote: { marginTop: 3, color: '#87958E', fontSize: 11, lineHeight: 16 },
  modeCard: { marginTop: 10, flexDirection: 'row', gap: 11, padding: 13, borderRadius: 17, backgroundColor: '#F5F8F6', borderWidth: 1, borderColor: '#E1E8E4' }, modeSelected: { backgroundColor: '#123E30', borderColor: '#123E30' }, radio: { marginTop: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#9AA9A1' }, radioSelected: { borderColor: '#8ED4BA', borderWidth: 5 }, modeTitle: { color: '#344A41', fontWeight: '900' }, modeTitleSelected: { color: '#fff' }, modeNote: { marginTop: 3, color: '#7D8B84', fontSize: 11, lineHeight: 16 }, modeNoteSelected: { color: '#C7D8D1' },
  label: { marginTop: 14, color: '#52645C', fontSize: 12, fontWeight: '800' }, input: { marginTop: 7, minHeight: 46, borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, paddingHorizontal: 13, backgroundColor: '#FAFCFB' }, multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  tabs: { marginTop: 14, flexDirection: 'row', gap: 8 }, tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EFF3F1' }, tabActive: { backgroundColor: '#0F8A5F' }, tabText: { color: '#617169', fontSize: 11, fontWeight: '800' }, tabActiveText: { color: '#fff', fontSize: 11, fontWeight: '900' }, tabHint: { marginTop: 8, color: '#84928B', fontSize: 11, lineHeight: 17 },
  previewCard: { marginTop: 16, padding: 17, borderRadius: 22, backgroundColor: '#12261E' }, previewEyebrow: { color: '#65D3A9', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, previewTitle: { marginTop: 4, color: '#fff', fontSize: 20, fontWeight: '900' }, labelDark: { marginTop: 13, color: '#B7C8C0', fontSize: 11, fontWeight: '800' }, previewInput: { marginTop: 6, minHeight: 43, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fff', color: '#12261E' }, totalRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' }, previewLabel: { color: '#BFCFC8' }, previewValue: { color: '#fff', fontWeight: '800' }, grandRow: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#345447' }, grandLabel: { color: '#fff', fontWeight: '900', fontSize: 16 }, grandValue: { color: '#fff', fontWeight: '900', fontSize: 20 }, confirmMock: { marginTop: 16, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, confirmMockText: { color: '#fff', fontWeight: '900' }, distanceNote: { marginTop: 9, color: '#94AFA3', fontSize: 10, lineHeight: 15 },
  saveButton: { marginTop: 18, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, saveText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  errorBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' }, successBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#EAF7F1' }, success: { color: '#0F7653' }, warningBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FFF8E6' }, warning: { color: '#8A5A00', fontWeight: '800' }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 },
});

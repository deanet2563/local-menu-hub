import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getOwnedShopSettings, updateShopSettings, type ShopHours, type ShopSettings } from '../src/data/shopSettings';

const DAYS = [
  ['mon', 'จันทร์'], ['tue', 'อังคาร'], ['wed', 'พุธ'], ['thu', 'พฤหัสบดี'],
  ['fri', 'ศุกร์'], ['sat', 'เสาร์'], ['sun', 'อาทิตย์'],
] as const;

type Form = {
  name: string; phone: string; email: string; address: string; description: string;
  google_maps_url: string; website_url: string; facebook_url: string; instagram_url: string;
  tiktok_url: string; line_url: string; village: string; zone: string; soi: string;
  pickup_enabled: boolean; delivery_enabled: boolean; service_area_note: string;
  payment_cash_enabled: boolean; payment_qr_enabled: boolean;
  business_hours: Record<string, { open: string; close: string; closed: boolean }>;
};

function makeForm(shop: ShopSettings): Form {
  const hours: Form['business_hours'] = {};
  for (const [key] of DAYS) {
    hours[key] = {
      open: shop.business_hours?.[key]?.open ?? '06:00',
      close: shop.business_hours?.[key]?.close ?? '18:00',
      closed: !!shop.business_hours?.[key]?.closed,
    };
  }
  return {
    name: shop.name ?? '', phone: shop.phone ?? '', email: shop.email ?? '', address: shop.address ?? '',
    description: shop.description ?? '', google_maps_url: shop.google_maps_url ?? '', website_url: shop.website_url ?? '',
    facebook_url: shop.facebook_url ?? '', instagram_url: shop.instagram_url ?? '', tiktok_url: shop.tiktok_url ?? '',
    line_url: shop.line_url ?? '', village: shop.village ?? '', zone: shop.zone ?? '', soi: shop.soi ?? '',
    pickup_enabled: shop.pickup_enabled ?? true, delivery_enabled: shop.delivery_enabled ?? true,
    service_area_note: shop.service_area_note ?? '', payment_cash_enabled: shop.payment_cash_enabled ?? true,
    payment_qr_enabled: shop.payment_qr_enabled ?? false, business_hours: hours,
  };
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A4AEA9" multiline={multiline} style={[styles.input, multiline && styles.textarea]} /></View>;
}

export default function ShopSettingsScreen() {
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getOwnedShopSettings();
      setShop(data);
      setForm(data ? makeForm(data) : null);
      setLocationConfirmed(!!data?.google_maps_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลร้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => current ? { ...current, [key]: value } : current);

  const qrReady = !!shop?.qr_code_url && !!form?.payment_qr_enabled;
  const contactPreview = useMemo(() => [form?.line_url, form?.facebook_url, form?.instagram_url, form?.tiktok_url].filter(Boolean).length, [form]);

  async function save() {
    if (!shop || !form || saving) return;
    if (!form.name.trim()) return setError('กรุณากรอกชื่อร้าน');
    if (!form.address.trim()) return setError('กรุณากรอกที่อยู่ร้าน');
    setSaving(true); setError(null); setSaved(false);
    try {
      const hours: ShopHours = {};
      for (const [key] of DAYS) hours[key] = form.business_hours[key];
      await updateShopSettings(shop.shop_id, {
        name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
        address: form.address.trim() || null, description: form.description.trim() || null,
        google_maps_url: form.google_maps_url.trim() || null, website_url: form.website_url.trim() || null,
        facebook_url: form.facebook_url.trim() || null, instagram_url: form.instagram_url.trim() || null,
        tiktok_url: form.tiktok_url.trim() || null, line_url: form.line_url.trim() || null,
        village: form.village.trim() || null, zone: form.zone.trim() || null, soi: form.soi.trim() || null,
        lat: shop.lat, lng: shop.lng, pickup_enabled: form.pickup_enabled, delivery_enabled: form.delivery_enabled,
        service_area_note: form.service_area_note.trim() || null, payment_cash_enabled: form.payment_cash_enabled,
        payment_qr_enabled: form.payment_qr_enabled, business_hours: hours,
      });
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกข้อมูลร้านไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  function confirmLocation() {
    if (!form?.google_maps_url.trim()) return setError('ใส่ Google Maps link ก่อนยืนยัน Location');
    setLocationConfirmed(true); setError(null);
    Alert.alert('ยืนยัน Location แล้ว', 'ระบบจะบันทึก Google Maps link นี้เป็นตำแหน่งอ้างอิงของร้าน');
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดข้อมูลร้าน…</Text></View>;
  if (!shop || !form) return <View style={styles.center}><Text style={styles.error}>{error || 'ไม่พบร้านของคุณ'}</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><Text style={styles.eyebrow}>SHOP PROFILE</Text><Text style={styles.title}>ตั้งค่าร้าน / Onboarding</Text><Text style={styles.muted}>ข้อมูลชุดนี้ใช้ทั้งใน Shop App และหน้าร้านฝั่งลูกค้า</Text></View>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
    {saved ? <View style={styles.successBox}><Text style={styles.success}>บันทึกข้อมูลร้านเรียบร้อยแล้ว</Text></View> : null}

    <View style={styles.card}>
      <Text style={styles.cardTitle}>รูปหน้าร้าน</Text>
      {shop.cover_url ? <Image source={{ uri: shop.cover_url }} style={styles.cover} /> : <View style={styles.coverEmpty}><Text style={styles.muted}>ยังไม่มี Cover ร้าน</Text></View>}
      <View style={styles.logoRow}>{shop.logo_url ? <Image source={{ uri: shop.logo_url }} style={styles.logo} /> : <View style={styles.logoEmpty}><Text>🌳</Text></View>}<View style={{ flex: 1 }}><Text style={styles.logoTitle}>Logo ร้าน</Text><Text style={styles.small}>Preview จากไฟล์ที่ร้านอัปโหลดไว้</Text></View></View>
      <View style={styles.noteBox}><Text style={styles.small}>Native media picker ยังไม่ได้ติดตั้งใน build นี้ จึงแสดง Preview ของ Cover / Logo ที่มีอยู่ก่อน โดยปุ่มอัปโหลดจากมือถือจะต่อใน commit media upload ถัดไป</Text></View>
    </View>

    <View style={styles.card}><Text style={styles.cardTitle}>ข้อมูลพื้นฐาน</Text>
      <Field label="ชื่อร้าน *" value={form.name} onChangeText={(v) => set('name', v)} />
      <Field label="คำอธิบายร้าน" value={form.description} onChangeText={(v) => set('description', v)} multiline placeholder="แนะนำร้าน จุดเด่น หรือเรื่องราวของร้าน" />
      <Field label="เบอร์โทร" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="08x-xxx-xxxx" />
      <Field label="อีเมล" value={form.email} onChangeText={(v) => set('email', v)} placeholder="shop@example.com" />
    </View>

    <View style={styles.card}><Text style={styles.cardTitle}>Location</Text>
      <Field label="ที่อยู่ *" value={form.address} onChangeText={(v) => set('address', v)} />
      <View style={styles.row}><View style={styles.half}><Field label="หมู่บ้าน" value={form.village} onChangeText={(v) => set('village', v)} /></View><View style={styles.half}><Field label="โซน / ซอย" value={[form.zone, form.soi].filter(Boolean).join(' / ')} onChangeText={(v) => set('zone', v)} /></View></View>
      <Field label="Google Maps link" value={form.google_maps_url} onChangeText={(v) => { set('google_maps_url', v); setLocationConfirmed(false); }} placeholder="https://maps.app.goo.gl/..." />
      <View style={styles.row}><Pressable onPress={confirmLocation} style={[styles.secondaryButton, locationConfirmed && styles.confirmedButton]}><Text style={[styles.secondaryText, locationConfirmed && styles.confirmedText]}>{locationConfirmed ? '✓ ยืนยัน Location แล้ว' : '📍 ยืนยัน Location'}</Text></Pressable>{form.google_maps_url ? <Pressable onPress={() => void Linking.openURL(form.google_maps_url)} style={styles.secondaryButton}><Text style={styles.secondaryText}>เปิดแผนที่</Text></Pressable> : null}</View>
    </View>

    <View style={styles.card}><Text style={styles.cardTitle}>วันและเวลาเปิดร้าน</Text>
      {DAYS.map(([key, label]) => { const h = form.business_hours[key]; return <View key={key} style={styles.dayRow}><View style={styles.dayName}><Text style={styles.dayLabel}>{label}</Text><Switch value={!h.closed} onValueChange={(open) => set('business_hours', { ...form.business_hours, [key]: { ...h, closed: !open } })} trackColor={{ true: '#7AD2B2' }} /></View><View style={styles.timeRow}><TextInput editable={!h.closed} value={h.open} onChangeText={(v) => set('business_hours', { ...form.business_hours, [key]: { ...h, open: v } })} style={[styles.timeInput, h.closed && styles.disabledInput]} /><Text style={styles.to}>ถึง</Text><TextInput editable={!h.closed} value={h.close} onChangeText={(v) => set('business_hours', { ...form.business_hours, [key]: { ...h, close: v } })} style={[styles.timeInput, h.closed && styles.disabledInput]} /></View></View>; })}
    </View>

    <View style={styles.card}><Text style={styles.cardTitle}>LINE & Social Media</Text>
      <Field label="LINE" value={form.line_url} onChangeText={(v) => set('line_url', v)} placeholder="https://line.me/... หรือ LINE OA" />
      <Field label="Facebook" value={form.facebook_url} onChangeText={(v) => set('facebook_url', v)} />
      <Field label="Instagram" value={form.instagram_url} onChangeText={(v) => set('instagram_url', v)} />
      <Field label="TikTok" value={form.tiktok_url} onChangeText={(v) => set('tiktok_url', v)} />
      <Field label="Website" value={form.website_url} onChangeText={(v) => set('website_url', v)} />
      <View style={styles.previewBox}><Text style={styles.previewTitle}>Customer storefront preview</Text><Text style={styles.small}>{contactPreview ? `${contactPreview} ช่องทางจะถูกนำไปแสดงใน About us / Contact us` : 'ยังไม่มี Social/LINE ที่จะแสดงในหน้าร้าน'}</Text></View>
    </View>

    <View style={styles.card}><Text style={styles.cardTitle}>รับสินค้า & การชำระเงิน</Text>
      <View style={styles.settingRow}><View><Text style={styles.settingTitle}>ลูกค้ามารับที่ร้าน</Text><Text style={styles.small}>แสดงเป็นตัวเลือกตอน Checkout</Text></View><Switch value={form.pickup_enabled} onValueChange={(v) => set('pickup_enabled', v)} /></View>
      <View style={styles.settingRow}><View><Text style={styles.settingTitle}>ร้านรองรับ Delivery</Text><Text style={styles.small}>รายละเอียดค่าส่งตั้งในหน้าการส่ง</Text></View><Switch value={form.delivery_enabled} onValueChange={(v) => set('delivery_enabled', v)} /></View>
      <View style={styles.settingRow}><View><Text style={styles.settingTitle}>รับเงินสด</Text></View><Switch value={form.payment_cash_enabled} onValueChange={(v) => set('payment_cash_enabled', v)} /></View>
      <View style={styles.settingRow}><View><Text style={styles.settingTitle}>รับ QR Transfer</Text></View><Switch value={form.payment_qr_enabled} onValueChange={(v) => set('payment_qr_enabled', v)} /></View>
      {shop.qr_code_url ? <View style={styles.qrWrap}><Image source={{ uri: shop.qr_code_url }} style={styles.qr} /><Text style={styles.qrLabel}>{qrReady ? '✓ QR นี้จะแสดงให้ลูกค้าตอนชำระเงิน' : 'QR Preview — เปิด QR Transfer เพื่อใช้งาน'}</Text></View> : <View style={styles.coverEmpty}><Text style={styles.muted}>ยังไม่มี QR รับเงิน</Text></View>}
    </View>

    <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && { opacity: 0.5 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>บันทึกข้อมูลร้าน</Text>}</Pressable>
    <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>กลับ Dashboard</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 16, paddingBottom: 48 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F7F6' },
  hero: { paddingVertical: 8, marginBottom: 8 }, eyebrow: { color: '#0F8A5F', fontWeight: '900', fontSize: 11, letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 26, fontWeight: '900' }, muted: { marginTop: 6, color: '#718078', fontSize: 13, lineHeight: 19 }, small: { color: '#718078', fontSize: 11, lineHeight: 16 },
  card: { marginTop: 12, backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#E7ECE9' }, cardTitle: { color: '#12261E', fontSize: 17, fontWeight: '900', marginBottom: 12 },
  field: { marginBottom: 12 }, label: { color: '#52645C', fontSize: 11, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#DDE5E0', backgroundColor: '#FAFBFA', paddingHorizontal: 12, color: '#12261E', fontSize: 14 }, textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' },
  cover: { width: '100%', height: 150, borderRadius: 18, backgroundColor: '#EEF2EF' }, coverEmpty: { minHeight: 90, borderRadius: 18, backgroundColor: '#F0F3F1', alignItems: 'center', justifyContent: 'center', padding: 16 }, logoRow: { marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }, logo: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#EEF2EF' }, logoEmpty: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#EEF2EF', alignItems: 'center', justifyContent: 'center' }, logoTitle: { color: '#12261E', fontWeight: '900' }, noteBox: { marginTop: 12, borderRadius: 14, padding: 12, backgroundColor: '#FFF8E7' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' }, half: { flex: 1 }, secondaryButton: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: '#EEF4F1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, secondaryText: { color: '#31594A', fontWeight: '800', fontSize: 12 }, confirmedButton: { backgroundColor: '#DFF5EC' }, confirmedText: { color: '#0F8A5F' },
  dayRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7ECE9' }, dayName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dayLabel: { color: '#12261E', fontWeight: '900' }, timeRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, timeInput: { flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: '#F4F7F5', textAlign: 'center', color: '#12261E', fontWeight: '800' }, disabledInput: { opacity: 0.35 }, to: { color: '#718078', fontSize: 12 },
  previewBox: { borderRadius: 14, padding: 12, backgroundColor: '#F4F8F6' }, previewTitle: { color: '#31594A', fontWeight: '900', fontSize: 12, marginBottom: 4 }, settingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7ECE9' }, settingTitle: { color: '#12261E', fontWeight: '800', fontSize: 13 }, qrWrap: { marginTop: 14, alignItems: 'center' }, qr: { width: 210, height: 210, borderRadius: 18, backgroundColor: '#F0F3F1' }, qrLabel: { marginTop: 10, color: '#52645C', fontSize: 12, textAlign: 'center' },
  saveButton: { marginTop: 18, minHeight: 54, borderRadius: 18, backgroundColor: '#0F8A5F', alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#fff', fontWeight: '900', fontSize: 15 }, backButton: { marginTop: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, backText: { color: '#52645C', fontWeight: '800' },
  errorBox: { borderRadius: 14, padding: 12, backgroundColor: '#FFF0EE' }, successBox: { borderRadius: 14, padding: 12, backgroundColor: '#E8F7F1' }, error: { color: '#A13A36', fontSize: 13 }, success: { color: '#0F7A55', fontSize: 13, fontWeight: '800' },
});

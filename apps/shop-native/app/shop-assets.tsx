import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getOwnedShopSettings, type ShopSettings } from '../src/data/shopSettings';
import { uploadShopAsset, type ShopAssetKind } from '../src/data/shopAssets';

const ASSETS: Array<{ kind: ShopAssetKind; title: string; note: string; aspect: [number, number] }> = [
  { kind: 'cover', title: 'Cover ร้าน', note: 'แสดงด้านบนหน้าร้านฝั่งลูกค้า', aspect: [16, 7] },
  { kind: 'logo', title: 'Logo ร้าน', note: 'ใช้ใน Dashboard และหน้าร้าน', aspect: [1, 1] },
  { kind: 'qr', title: 'QR รับเงิน', note: 'ลูกค้าเห็นตอนเลือกชำระผ่าน QR Transfer', aspect: [1, 1] },
];

function assetUrl(shop: ShopSettings, kind: ShopAssetKind) {
  return kind === 'cover' ? shop.cover_url : kind === 'logo' ? shop.logo_url : shop.qr_code_url;
}

export default function ShopAssetsScreen() {
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<ShopAssetKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setShop(await getOwnedShopSettings());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรูปของร้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function chooseAndUpload(kind: ShopAssetKind, aspect: [number, number]) {
    if (!shop || uploading) return;
    setError(null); setMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError('กรุณาอนุญาตให้ MyTree Shop เข้าถึงรูปภาพก่อน');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const selected = result.assets[0];
    setUploading(kind);
    try {
      await uploadShopAsset({
        shopId: shop.shop_id,
        kind,
        uri: selected.uri,
        mimeType: selected.mimeType,
        fileName: selected.fileName,
      });
      setMessage(kind === 'cover' ? 'เปลี่ยน Cover ร้านแล้ว' : kind === 'logo' ? 'เปลี่ยน Logo ร้านแล้ว' : 'เปลี่ยน QR รับเงินแล้ว');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploading(null);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดรูป…</Text></View>;
  if (!shop) return <View style={styles.center}><Text style={styles.error}>{error || 'ไม่พบร้าน'}</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>SHOP MEDIA</Text>
    <Text style={styles.title}>รูปและ QR ร้าน</Text>
    <Text style={styles.subtitle}>รูปที่อัปโหลดจะเปลี่ยน Preview และข้อมูลหน้าร้านทันที</Text>

    {message ? <View style={styles.successBox}><Text style={styles.success}>✓ {message}</Text></View> : null}
    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    {ASSETS.map((asset) => {
      const uri = assetUrl(shop, asset.kind);
      const busy = uploading === asset.kind;
      return <View key={asset.kind} style={styles.card}>
        <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>{asset.title}</Text><Text style={styles.note}>{asset.note}</Text></View>{uri ? <Text style={styles.ready}>มีรูปแล้ว</Text> : <Text style={styles.missing}>ยังไม่มี</Text>}</View>
        {uri ? <Image source={{ uri }} style={asset.kind === 'cover' ? styles.cover : styles.square} resizeMode="cover" /> : <View style={asset.kind === 'cover' ? styles.coverEmpty : styles.squareEmpty}><Text style={styles.emptyText}>{asset.kind === 'qr' ? 'QR' : asset.kind === 'logo' ? 'Logo' : 'Cover'}</Text></View>}
        <Pressable disabled={Boolean(uploading)} onPress={() => void chooseAndUpload(asset.kind, asset.aspect)} style={({ pressed }) => [styles.uploadButton, (busy || Boolean(uploading)) && styles.disabled, pressed && styles.pressed]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadText}>{uri ? `เปลี่ยน ${asset.title}` : `อัปโหลด ${asset.title}`}</Text>}
        </Pressable>
      </View>;
    })}

    <View style={styles.tip}><Text style={styles.tipTitle}>การแสดงผล</Text><Text style={styles.note}>Logo และ Cover จะแสดงในหน้าร้านฝั่งลูกค้า ส่วน QR จะแสดงเฉพาะเมื่อร้านเปิดการชำระแบบ QR Transfer</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 29, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 20 }, muted: { color: '#718078' },
  successBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#E7F7F0' }, success: { color: '#0F7653', fontWeight: '800' }, errorBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' },
  card: { marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3EAE6' }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, cardTitle: { color: '#12261E', fontSize: 17, fontWeight: '900' }, note: { marginTop: 4, color: '#7D8B84', fontSize: 11, lineHeight: 17 }, ready: { color: '#0F7653', fontSize: 11, fontWeight: '900' }, missing: { color: '#A17021', fontSize: 11, fontWeight: '900' },
  cover: { width: '100%', height: 155, marginTop: 13, borderRadius: 17, backgroundColor: '#EEF2F0' }, square: { width: 180, height: 180, alignSelf: 'center', marginTop: 13, borderRadius: 20, backgroundColor: '#EEF2F0' }, coverEmpty: { height: 130, marginTop: 13, borderRadius: 17, backgroundColor: '#EEF2F0', alignItems: 'center', justifyContent: 'center' }, squareEmpty: { width: 160, height: 160, alignSelf: 'center', marginTop: 13, borderRadius: 20, backgroundColor: '#EEF2F0', alignItems: 'center', justifyContent: 'center' }, emptyText: { color: '#98A49E', fontWeight: '900' },
  uploadButton: { marginTop: 13, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, uploadText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 },
  tip: { marginTop: 15, padding: 16, borderRadius: 20, backgroundColor: '#12261E' }, tipTitle: { color: '#fff', fontWeight: '900' },
});

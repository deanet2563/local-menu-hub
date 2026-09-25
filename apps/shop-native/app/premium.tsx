import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import { hasActivePremium, hasMyTreeVerified, loadShopPremiumState, requestMyTreeVerification, type ShopBadge, type ShopMembership, type ShopVerificationRequest } from '../src/data/shopPremium';

const BADGE_IDEAS = [
  ['✓', 'MyTree Verified', 'ผ่านการตรวจสอบโดย MyTree Team — ซื้อไม่ได้โดยตรง'],
  ['★', 'MyTree Recommend', 'ได้รับจากเกณฑ์คุณภาพ/ความน่าเชื่อถือของแพลตฟอร์ม'],
  ['🏆', 'Years in Business', 'Badge อายุธุรกิจ เช่น 5+ / 10+ / 20+ ปี'],
  ['🔥', 'Popular Local', 'สัญญาณความนิยมในพื้นที่'],
  ['⚡', 'Fast Response', 'ตอบรับออเดอร์/ลูกค้าได้รวดเร็วตามเกณฑ์'],
  ['💚', 'Community Favorite', 'คะแนนและ engagement จากชุมชน'],
  ['G', 'Google Review', 'CTA / External review identity สำหรับร้าน Premium'],
  ['▣', 'Media / Review Channel', 'โลโก้สื่อหรือช่องรีวิวที่ได้รับการยืนยัน'],
] as const;

export default function PremiumScreen() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [membership, setMembership] = useState<ShopMembership | null>(null);
  const [badges, setBadges] = useState<ShopBadge[]>([]);
  const [requests, setRequests] = useState<ShopVerificationRequest[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      setShopId(shop.shop_id);
      const state = await loadShopPremiumState(shop.shop_id);
      setMembership(state.membership);
      setBadges(state.badges);
      setRequests(state.verificationRequests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูล Premium ไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const premium = useMemo(() => hasActivePremium(membership), [membership]);
  const verified = useMemo(() => hasMyTreeVerified(badges), [badges]);
  const activeRequest = useMemo(() => requests.find((request) => ['pending', 'in_review'].includes(request.status)) ?? null, [requests]);

  async function requestVerification() {
    if (!shopId || requesting) return;
    setRequesting(true); setError(null); setMessage(null);
    try {
      await requestMyTreeVerification(shopId, note);
      setMessage('ส่งคำขอ MyTree Verified แล้ว ทีม MyTree จะเริ่มกระบวนการตรวจสอบตามเงื่อนไข');
      setNote('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ส่งคำขอไม่สำเร็จ');
    } finally { setRequesting(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลด Premium…</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>PREMIUM & TRUST</Text>
    <Text style={styles.title}>Premium / Badge</Text>
    <Text style={styles.subtitle}>Premium เพิ่มสิทธิ์ด้าน discovery และเครื่องมือร้าน แต่ Trust Badge ต้องผ่านเงื่อนไขจริง — จ่าย Premium แล้วไม่ได้ Badge อัตโนมัติ</Text>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
    {message ? <View style={styles.successBox}><Text style={styles.success}>{message}</Text></View> : null}

    <View style={[styles.planCard, premium && styles.planPremium]}>
      <Text style={styles.planEyebrow}>CURRENT PLAN</Text>
      <Text style={[styles.planTitle, premium && styles.planTitlePremium]}>{premium ? 'MyTree Premium' : 'Free'}</Text>
      <Text style={[styles.planNote, premium && styles.planNotePremium]}>{premium ? 'บัญชี Premium active — มีสิทธิ์เข้าสู่ Verification Process' : 'ยังไม่ใช่ Premium · MyTree Verified ยังสมัครไม่ได้'}</Text>
      <Text style={styles.planMeta}>{membership ? `สถานะ: ${membership.status}` : 'ยังไม่มี membership record'}</Text>
    </View>

    <View style={styles.card}>
      <View style={styles.verifiedHeader}><View style={[styles.verifiedMark, verified && styles.verifiedMarkOn]}><Text style={styles.verifiedEmoji}>✓</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>MyTree Verified</Text><Text style={styles.cardNote}>Premium → ขอ Verify → MyTree Team ตรวจ → ผ่านเกณฑ์จึงได้รับ Badge</Text></View></View>
      {verified ? <View style={styles.goodBanner}><Text style={styles.goodText}>✓ ร้านนี้ได้รับ MyTree Verified แล้ว</Text></View> : activeRequest ? <View style={styles.pendingBanner}><Text style={styles.pendingText}>คำขออยู่ในสถานะ: {activeRequest.status === 'in_review' ? 'กำลังตรวจสอบ' : 'รอตรวจสอบ'}</Text></View> : premium ? <>
        <Text style={styles.label}>หมายเหตุถึงทีมตรวจสอบ (ไม่บังคับ)</Text>
        <TextInput value={note} onChangeText={setNote} multiline style={styles.input} placeholder="เช่น ประเภทธุรกิจ เอกสาร/ข้อมูลที่ต้องการแจ้งเพิ่มเติม" />
        <Pressable disabled={requesting} onPress={() => void requestVerification()} style={({ pressed }) => [styles.requestButton, requesting && styles.disabled, pressed && styles.pressed]}>{requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.requestText}>ขอเข้าสู่ Verification Process</Text>}</Pressable>
      </> : <View style={styles.lockedBanner}><Text style={styles.lockedText}>🔒 ต้องมี Premium active ก่อน จึงจะส่งคำขอ MyTree Verified ได้</Text></View>}
      <Text style={styles.policy}>MyTree Verified “ซื้อไม่ได้” และ Premium ไม่รับประกันว่าจะผ่าน Verification</Text>
    </View>

    {badges.length > 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Badge ที่ร้านได้รับ</Text><View style={styles.badgeWrap}>{badges.filter((b) => b.is_active).map((badge) => <View key={badge.badge_id} style={styles.earnedBadge}><Text style={styles.earnedBadgeText}>{badge.label}</Text></View>)}</View></View> : null}

    <Text style={styles.sectionTitle}>Badge Library / แนวทางในอนาคต</Text>
    {BADGE_IDEAS.map(([icon, title, noteText]) => <View key={title} style={styles.badgeCard}><View style={styles.badgeIcon}><Text style={styles.badgeIconText}>{icon}</Text></View><View style={{ flex: 1 }}><Text style={styles.badgeTitle}>{title}</Text><Text style={styles.badgeNote}>{noteText}</Text></View></View>)}

    <View style={styles.infoCard}><Text style={styles.infoTitle}>หลักการ Ranking</Text><Text style={styles.infoText}>Premium เป็น commercial layer ส่วน Rating, Verified Reviews, Repeat Customers และ Trust Badges เป็น reputation signals แยกกัน เพื่อไม่ให้ระบบ Recommendation กลายเป็น “จ่ายแล้วน่าเชื่อถือ”</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' }, muted: { marginTop: 5, color: '#7A8981' },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 21 },
  planCard: { marginTop: 18, padding: 18, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, planPremium: { backgroundColor: '#12261E', borderColor: '#12261E' }, planEyebrow: { color: '#0F8A5F', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, planTitle: { marginTop: 5, color: '#12261E', fontSize: 25, fontWeight: '900' }, planTitlePremium: { color: '#fff' }, planNote: { marginTop: 6, color: '#718078', lineHeight: 19 }, planNotePremium: { color: '#C1D0C9' }, planMeta: { marginTop: 8, color: '#8FA097', fontSize: 10 },
  card: { marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, verifiedHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' }, verifiedMark: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F0' }, verifiedMarkOn: { backgroundColor: '#0F8A5F' }, verifiedEmoji: { color: '#fff', fontSize: 22, fontWeight: '900' }, cardTitle: { color: '#12261E', fontWeight: '900', fontSize: 17 }, cardNote: { marginTop: 4, color: '#7A8981', fontSize: 11, lineHeight: 16 },
  label: { marginTop: 15, color: '#52645C', fontSize: 12, fontWeight: '800' }, input: { marginTop: 7, minHeight: 82, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#DCE5E0', textAlignVertical: 'top', backgroundColor: '#FAFCFB' }, requestButton: { marginTop: 10, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, requestText: { color: '#fff', fontWeight: '900' }, policy: { marginTop: 12, color: '#8A9891', fontSize: 10, lineHeight: 15 },
  goodBanner: { marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: '#E8F7F0' }, goodText: { color: '#0F7653', fontWeight: '900', fontSize: 12 }, pendingBanner: { marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: '#FFF3D7' }, pendingText: { color: '#806018', fontWeight: '800', fontSize: 12 }, lockedBanner: { marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: '#F1F3F2' }, lockedText: { color: '#66756E', fontSize: 12, lineHeight: 17 },
  badgeWrap: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, earnedBadge: { borderRadius: 999, backgroundColor: '#123E30', paddingHorizontal: 11, paddingVertical: 7 }, earnedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' }, sectionTitle: { marginTop: 20, marginBottom: 8, color: '#12261E', fontSize: 17, fontWeight: '900' }, badgeCard: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8, padding: 13, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, badgeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDF5F1', alignItems: 'center', justifyContent: 'center' }, badgeIconText: { fontSize: 20, color: '#0F7653', fontWeight: '900' }, badgeTitle: { color: '#12261E', fontWeight: '900', fontSize: 14 }, badgeNote: { marginTop: 3, color: '#829088', fontSize: 10, lineHeight: 15 },
  infoCard: { marginTop: 12, padding: 16, borderRadius: 20, backgroundColor: '#EAF5FA' }, infoTitle: { color: '#184E65', fontWeight: '900' }, infoText: { marginTop: 6, color: '#517889', fontSize: 12, lineHeight: 19 }, errorBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' }, successBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#E8F7F0' }, success: { color: '#0F7653' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getOwnedShopProfile } from '../src/data/shopProfile';
import { loadShopReviews, reviewSummary, saveShopReviewReply, type ShopReview } from '../src/data/shopReviews';

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const shop = await getOwnedShopProfile();
      if (!shop) throw new Error('ไม่พบร้านของบัญชีนี้');
      const rows = await loadShopReviews(shop.shop_id);
      setReviews(rows);
      setDrafts((old) => {
        const next = { ...old };
        for (const review of rows) {
          if (!(review.review_id in next)) next[review.review_id] = review.shop_review_replies?.[0]?.reply_text ?? '';
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรีวิวไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => reviewSummary(reviews), [reviews]);

  async function saveReply(review: ShopReview) {
    setSavingId(review.review_id); setError(null);
    try {
      await saveShopReviewReply(review, drafts[review.review_id] ?? '');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกคำตอบไม่สำเร็จ');
    } finally { setSavingId(null); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังโหลดรีวิว…</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>REPUTATION</Text>
    <Text style={styles.title}>รีวิวร้าน</Text>
    <Text style={styles.subtitle}>รีวิวผูกกับออเดอร์จริง ร้านตอบได้ แต่ไม่สามารถแก้คะแนนหรือข้อความของลูกค้า</Text>

    <View style={styles.summaryGrid}>
      <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Rating</Text><Text style={styles.summaryValue}>{summary.rating ? summary.rating.toFixed(1) : '—'}</Text><Text style={styles.stars}>★★★★★</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryLabel}>จำนวนรีวิว</Text><Text style={styles.summaryValue}>{summary.count}</Text><Text style={styles.summaryFoot}>{summary.verified} Verified Order</Text></View>
    </View>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    {reviews.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>ยังไม่มีรีวิว</Text><Text style={styles.muted}>เมื่อลูกค้ารีวิวหลังออเดอร์สำเร็จ รีวิวจะปรากฏที่นี่</Text></View> : reviews.map((review) => {
      const reply = review.shop_review_replies?.[0];
      return <View key={review.review_id} style={styles.reviewCard}>
        <View style={styles.reviewTop}>
          <View><Text style={styles.rating}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text><Text style={styles.orderId}>ORDER #{review.sub_id.slice(0, 6).toUpperCase()}</Text></View>
          {review.is_verified_order ? <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ Verified Order</Text></View> : null}
        </View>
        <Text style={styles.reviewText}>{review.review_text?.trim() || 'ลูกค้าให้คะแนนโดยไม่ได้เขียนข้อความ'}</Text>
        <Text style={styles.date}>{new Date(review.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</Text>

        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>{reply ? 'คำตอบจากร้าน' : 'ตอบรีวิวนี้'}</Text>
          <TextInput
            value={drafts[review.review_id] ?? ''}
            onChangeText={(value) => setDrafts((old) => ({ ...old, [review.review_id]: value }))}
            multiline
            maxLength={3000}
            placeholder="ขอบคุณสำหรับรีวิว…"
            style={styles.input}
          />
          <Pressable disabled={savingId === review.review_id} onPress={() => void saveReply(review)} style={({ pressed }) => [styles.replyButton, savingId === review.review_id && styles.disabled, pressed && styles.pressed]}>
            {savingId === review.review_id ? <ActivityIndicator color="#fff" /> : <Text style={styles.replyButtonText}>{reply ? 'บันทึกคำตอบใหม่' : 'ส่งคำตอบ'}</Text>}
          </Pressable>
        </View>
      </View>;
    })}

    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Reputation & Ranking Layer</Text>
      <Text style={styles.infoText}>⭐ Rating · จำนวนรีวิว · Repeat Customer · Verified Review จะเป็นสัญญาณสำหรับ Ranking และ Recommendation ในอนาคต โดย Verified Review มาจากออเดอร์จริง ไม่ใช่รีวิวที่ร้านสร้างเอง</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, content: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' }, muted: { marginTop: 5, color: '#7A8981', fontSize: 12, lineHeight: 18 },
  eyebrow: { color: '#0F8A5F', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, subtitle: { marginTop: 7, color: '#718078', lineHeight: 21 },
  summaryGrid: { marginTop: 18, flexDirection: 'row', gap: 10 }, summaryCard: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, summaryLabel: { color: '#7B8982', fontSize: 11, fontWeight: '800' }, summaryValue: { marginTop: 5, color: '#12261E', fontSize: 28, fontWeight: '900' }, stars: { marginTop: 3, color: '#ECA72C', letterSpacing: 1 }, summaryFoot: { marginTop: 5, color: '#0F7653', fontSize: 10, fontWeight: '800' },
  reviewCard: { marginTop: 13, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, rating: { color: '#ECA72C', fontSize: 17, letterSpacing: 1 }, orderId: { marginTop: 4, color: '#87958E', fontSize: 9, fontWeight: '800' }, verifiedBadge: { borderRadius: 999, backgroundColor: '#E8F7F0', paddingHorizontal: 9, paddingVertical: 5 }, verifiedText: { color: '#0F7653', fontSize: 9, fontWeight: '900' }, reviewText: { marginTop: 13, color: '#344A41', fontSize: 14, lineHeight: 21 }, date: { marginTop: 7, color: '#9AA59F', fontSize: 10 },
  replyBox: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EDF1EF' }, replyLabel: { color: '#52645C', fontWeight: '900', fontSize: 12 }, input: { marginTop: 8, minHeight: 82, borderRadius: 14, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FAFCFB', padding: 12, textAlignVertical: 'top' }, replyButton: { marginTop: 8, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#123E30' }, replyButtonText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  infoCard: { marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#EAF5FA', borderWidth: 1, borderColor: '#CDE5F0' }, infoTitle: { color: '#184E65', fontWeight: '900' }, infoText: { marginTop: 6, color: '#517889', fontSize: 12, lineHeight: 19 }, empty: { marginTop: 18, padding: 24, alignItems: 'center', borderRadius: 20, backgroundColor: '#fff' }, emptyTitle: { color: '#12261E', fontWeight: '900' }, errorBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
});

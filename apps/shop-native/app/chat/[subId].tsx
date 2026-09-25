import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { loadShopOrderById } from '../../src/data/shopOrders';
import { loadOrderChat, sendShopOrderChatMessage, type OrderChatMessage } from '../../src/data/orderChat';
import type { ShopOrder } from '../../src/domain/orders';

const ORDER_LABEL: Record<string, string> = {
  pending: 'ออเดอร์ใหม่',
  confirmed: 'รับออเดอร์แล้ว',
  preparing: 'กำลังทำ',
  completed: 'อาหารเสร็จแล้ว',
  cancelled: 'ยกเลิก',
};

function deliveryLabel(order: ShopOrder): string | null {
  if (order.delivery_status === 'delivered') return 'ส่งสำเร็จ';
  if (order.delivery_status === 'picked_up') return 'ไรเดอร์รับสินค้าแล้ว';
  if (order.delivery_status === 'rider_called' && order.assigned_rider_id) return 'ไรเดอร์รับงานแล้ว';
  if (order.delivery_status === 'rider_called') return 'เรียกไรเดอร์แล้ว';
  if (order.delivery_status === 'failed') return 'การจัดส่งมีปัญหา';
  return null;
}

export default function OrderChatScreen() {
  const { subId } = useLocalSearchParams<{ subId: string }>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!subId) return;
    if (!silent) setLoading(true);
    try {
      const [orderRow, chatRows] = await Promise.all([
        loadShopOrderById(subId),
        loadOrderChat(subId),
      ]);
      setOrder(orderRow);
      setMessages(chatRows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดแชทไม่สำเร็จ');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [subId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 4_000);
    return () => clearInterval(timer);
  }, [load]);

  const statusText = useMemo(() => {
    if (!order) return '';
    return [ORDER_LABEL[order.order_status] ?? order.order_status, deliveryLabel(order)].filter(Boolean).join(' · ');
  }, [order]);

  async function send() {
    if (!subId || sending || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendShopOrderChatMessage(subId, draft);
      setDraft('');
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ส่งข้อความไม่สำเร็จ');
    } finally { setSending(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0F8A5F" /><Text style={styles.muted}>กำลังเปิดแชท…</Text></View>;

  const customer = order?.hub_orders?.customers;

  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <View style={styles.activeCustomerCard}>
      <View style={styles.activeLine} />
      <View style={{ flex: 1 }}>
        <Text style={styles.customerName}>{customer?.name?.trim() || 'ลูกค้า MyTree'}</Text>
        <Text style={styles.orderId}>ORDER #{subId?.slice(0, 6).toUpperCase()}</Text>
        <View style={styles.statusPill}><Text style={styles.statusText}>{statusText || 'กำลังโหลดสถานะ'}</Text></View>
      </View>
    </View>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <FlatList
      data={messages}
      keyExtractor={(item) => item.message_id}
      contentContainerStyle={styles.messages}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>เริ่มแชทกับลูกค้า</Text><Text style={styles.muted}>ข้อความทั้งหมดผูกกับออเดอร์นี้โดยตรง</Text></View>}
      renderItem={({ item }) => {
        const mine = item.sender_role === 'shop';
        const admin = item.sender_role === 'admin';
        return <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
          <View style={[styles.bubble, mine && styles.bubbleMine, admin && styles.bubbleAdmin]}>
            <Text style={[styles.role, mine && styles.roleMine]}>{mine ? 'ร้านค้า' : admin ? 'MyTree Admin' : 'ลูกค้า'}</Text>
            <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
            <Text style={[styles.time, mine && styles.timeMine]}>{new Date(item.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>;
      }}
    />

    <View style={styles.composer}>
      <TextInput value={draft} onChangeText={setDraft} placeholder="พิมพ์ข้อความถึงลูกค้า…" multiline maxLength={2000} style={styles.input} />
      <Pressable disabled={sending || !draft.trim()} onPress={() => void send()} style={({ pressed }) => [styles.sendButton, (sending || !draft.trim()) && styles.disabled, pressed && styles.pressed]}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>ส่ง</Text>}
      </Pressable>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F7F6' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F7F6' }, muted: { marginTop: 5, color: '#7B8982', fontSize: 12 },
  activeCustomerCard: { margin: 14, marginBottom: 4, minHeight: 96, flexDirection: 'row', overflow: 'hidden', borderRadius: 20, borderWidth: 2, borderColor: '#0F8A5F', backgroundColor: '#fff', padding: 15 }, activeLine: { width: 6, alignSelf: 'stretch', marginRight: 12, borderRadius: 999, backgroundColor: '#0F8A5F' }, customerName: { color: '#12261E', fontSize: 18, fontWeight: '900' }, orderId: { marginTop: 3, color: '#819088', fontSize: 10, fontWeight: '800' }, statusPill: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, backgroundColor: '#E8F7F0', paddingHorizontal: 10, paddingVertical: 5 }, statusText: { color: '#0F7653', fontSize: 11, fontWeight: '900' },
  errorBox: { marginHorizontal: 14, marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: '#FFF0EE' }, error: { color: '#A13A36' }, messages: { padding: 14, paddingBottom: 20, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }, emptyTitle: { color: '#12261E', fontWeight: '900' }, bubbleRow: { alignItems: 'flex-start', marginBottom: 9 }, bubbleRowMine: { alignItems: 'flex-end' }, bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17, borderTopLeftRadius: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EBE7' }, bubbleMine: { borderTopLeftRadius: 17, borderTopRightRadius: 5, backgroundColor: '#123E30', borderColor: '#123E30' }, bubbleAdmin: { backgroundColor: '#E8F3FA', borderColor: '#CDE5F0' }, role: { color: '#0F8A5F', fontSize: 9, fontWeight: '900' }, roleMine: { color: '#65D3A9' }, body: { marginTop: 3, color: '#344A41', fontSize: 14, lineHeight: 20 }, bodyMine: { color: '#fff' }, time: { marginTop: 5, color: '#9AA59F', fontSize: 9 }, timeMine: { color: '#AFC6BC' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#DCE5E0', backgroundColor: '#fff' }, input: { flex: 1, maxHeight: 120, minHeight: 46, borderRadius: 16, backgroundColor: '#F2F5F3', paddingHorizontal: 13, paddingTop: 12, paddingBottom: 12, color: '#12261E' }, sendButton: { width: 62, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A5F' }, sendText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
});

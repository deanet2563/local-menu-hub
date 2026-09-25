import { supabase } from '../lib/supabase';

export type OrderChatMessage = {
  message_id: string;
  sub_id: string;
  sender_role: 'customer' | 'shop' | 'admin';
  body: string;
  created_at: string;
};

export async function loadOrderChat(subId: string): Promise<OrderChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('message_id,sub_id,sender_role,body,created_at')
    .eq('sub_id', subId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as OrderChatMessage[] | null) ?? [];
}

export async function sendShopOrderChatMessage(subId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('กรุณาพิมพ์ข้อความ');
  if (text.length > 2000) throw new Error('ข้อความยาวเกิน 2,000 ตัวอักษร');
  const { error } = await supabase.from('chat_messages').insert({
    sub_id: subId,
    sender_role: 'shop',
    body: text,
  });
  if (error) throw error;
}

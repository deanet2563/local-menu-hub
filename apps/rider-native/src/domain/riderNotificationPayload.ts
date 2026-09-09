export function extractRiderOfferSubId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const direct =
    record.subId ??
    record.sub_id ??
    record.subOrderId ??
    record.sub_order_id ??
    record.deliverySubId ??
    record.delivery_sub_id;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (typeof direct === 'number' && Number.isFinite(direct)) return String(direct);

  const url = typeof record.url === 'string' ? record.url : typeof record.deepLink === 'string' ? record.deepLink : null;
  const match = url?.match(/(?:subId|sub_id|subOrderId|sub_order_id)=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export type FulfillmentType = 'pickup' | 'delivery';
export type PaymentMethod = 'cash' | 'qr_transfer';
export type DeliveryFeePayer = 'customer' | 'shop';

export type ShopOrderItem = {
  item_name_snapshot: string;
  qty: number;
  line_total: number;
};

export type ShopOrder = {
  sub_id: string;
  order_id: string;
  fulfillment_type: FulfillmentType;
  order_status: string;
  payment_status: string;
  delivery_status: string;
  payment_method: PaymentMethod;
  payment_slip_url: string | null;
  customer_note: string | null;
  delivery_address: string | null;
  amount: number;
  assigned_rider_id: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  requested_for: string | null;
  delivery_fee: number;
  delivery_fee_payer: DeliveryFeePayer;
  delivery_distance_km: number | null;
  order_items: ShopOrderItem[];
  hub_orders: {
    customers: { name: string | null; phone: string | null } | null;
  } | null;
};

export type ShopOrderSummary = {
  id: string;
  shortId: string;
  customerName: string;
  fulfillmentLabel: string;
  amount: number;
  status: string;
  createdAt: string;
};

export function toOrderSummary(order: ShopOrder): ShopOrderSummary {
  return {
    id: order.sub_id,
    shortId: order.sub_id.slice(0, 6).toUpperCase(),
    customerName: order.hub_orders?.customers?.name?.trim() || 'ลูกค้า MyTree',
    fulfillmentLabel: order.fulfillment_type === 'delivery' ? 'จัดส่ง' : 'รับเอง',
    amount: Number(order.amount) || 0,
    status: order.order_status,
    createdAt: order.created_at,
  };
}

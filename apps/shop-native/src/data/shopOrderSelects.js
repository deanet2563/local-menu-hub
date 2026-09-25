const DASHBOARD_ORDER_SELECT = [
  'sub_id',
  'fulfillment_type',
  'order_status',
  'amount',
  'created_at',
  'hub_orders(customers(name))',
].join(',');

const DETAIL_ORDER_SELECT = [
  'sub_id',
  'order_id',
  'fulfillment_type',
  'order_status',
  'payment_status',
  'delivery_status',
  'payment_method',
  'payment_slip_url',
  'customer_note',
  'delivery_address',
  'amount',
  'customer_delivery_charge',
  'assigned_rider_id',
  'picked_up_at',
  'delivered_at',
  'cancelled_reason',
  'created_at',
  'requested_for',
  'delivery_fee',
  'delivery_fee_payer',
  'delivery_distance_km',
  'order_items(item_name_snapshot,qty,line_total)',
  'hub_orders(customers(name,phone))',
].join(',');

const LEGACY_DETAIL_ORDER_SELECT = DETAIL_ORDER_SELECT
  .split(',')
  .filter((column) => column !== 'customer_delivery_charge')
  .join(',');

module.exports = {
  DASHBOARD_ORDER_SELECT,
  DETAIL_ORDER_SELECT,
  LEGACY_DETAIL_ORDER_SELECT,
};

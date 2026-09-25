export function isCustomerDeliveryPricingSchemaMissing(error) {
  if (error?.code !== '42703') return false;
  const message = String(error.message ?? '');
  return [
    'customer_delivery_pricing_mode',
    'customer_delivery_flat_fee',
    'customer_free_delivery_min_order',
    'rider_request_enabled',
  ].some((column) => message.includes(column));
}

export function migrationRequiredShopDeliverySettings(shopId, legacyRow) {
  return {
    shop_id: shopId,
    pickup_enabled: legacyRow?.pickup_enabled ?? true,
    delivery_enabled: legacyRow?.delivery_enabled ?? false,
    service_area_note: legacyRow?.service_area_note ?? null,
    delivery_pricing_mode: 'distance',
    delivery_flat_fee: 0,
    free_delivery_min_order: null,
    rider_request_enabled: false,
    migration_required: true,
  };
}

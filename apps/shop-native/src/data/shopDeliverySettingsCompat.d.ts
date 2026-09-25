import type { ShopDeliverySettings } from './shopDeliverySettings';

export function isCustomerDeliveryPricingSchemaMissing(error: unknown): boolean;
export function migrationRequiredShopDeliverySettings(
  shopId: string,
  legacyRow?: Partial<Pick<ShopDeliverySettings, 'pickup_enabled' | 'delivery_enabled' | 'service_area_note'>> | null,
): ShopDeliverySettings;

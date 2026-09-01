import {
  formatDeliveryAddressSummary,
  makeDeliveryAddressKey,
  type CustomerDeliveryAddress,
} from "@/lib/deliveryAddressBook";

const sampleAddress: CustomerDeliveryAddress = {
  id: "local_1",
  kind: "saved",
  label: "บ้าน",
  recipientName: "สมชาย",
  recipientPhone: "0812345678",
  premises: "99/123 หมู่บ้านสัมมากร",
  locality: "ซอย G14 แขวงสะพานสูง กรุงเทพฯ 10240",
  riderNote: "รั้วสีขาว",
  placeId: "places/abc",
  placeDisplayName: "Baan Somtum",
  formattedAddress: "2/4 ถนนกรุงเทพกรีฑา",
  deliveryPinLat: 13.749716,
  deliveryPinLng: 100.670959,
  locationSource: "google_maps_url",
  submittedMapUrl: "https://maps.app.goo.gl/example",
  locationAccuracyM: null,
  isDefault: true,
  usageCount: 2,
  lastUsedAt: "2026-09-01T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

export const deliveryAddressBookCompileChecks = {
  summary: formatDeliveryAddressSummary(sampleAddress),
  key: makeDeliveryAddressKey(sampleAddress),
};

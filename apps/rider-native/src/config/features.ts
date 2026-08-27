export const riderFeatures = {
  deliveryV3Accept: process.env.EXPO_PUBLIC_ENABLE_RIDER_DELIVERY_V3 === 'true',
  pushDeviceRegistry: process.env.EXPO_PUBLIC_ENABLE_RIDER_PUSH_REGISTRY === 'true',
} as const;

export const riderFeatures = {
  candidateFlow: process.env.EXPO_PUBLIC_ENABLE_RIDER_CANDIDATE_FLOW === 'true',
  pushDeviceRegistry: process.env.EXPO_PUBLIC_ENABLE_RIDER_PUSH_REGISTRY === 'true',
} as const;

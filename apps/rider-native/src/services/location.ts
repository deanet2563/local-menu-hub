import * as Location from 'expo-location';

export type RiderLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  capturedAt: string;
};

export type LocationReadiness = {
  ready: boolean;
  permission: Location.PermissionStatus;
  location: RiderLocation | null;
  reason: string | null;
};

export async function ensureForegroundLocation(): Promise<LocationReadiness> {
  const current = await Location.getForegroundPermissionsAsync();
  let permission = current.status;

  if (permission !== Location.PermissionStatus.GRANTED) {
    const requested = await Location.requestForegroundPermissionsAsync();
    permission = requested.status;
  }

  if (permission !== Location.PermissionStatus.GRANTED) {
    return {
      ready: false,
      permission,
      location: null,
      reason: 'ยังไม่ได้อนุญาตตำแหน่ง',
    };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    ready: true,
    permission,
    location: {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt: new Date(position.timestamp).toISOString(),
    },
    reason: null,
  };
}

export function isLocationFresh(capturedAt: string, maxAgeMinutes = 10) {
  const captured = new Date(capturedAt).getTime();
  if (!Number.isFinite(captured)) return false;
  return Date.now() - captured <= maxAgeMinutes * 60_000;
}

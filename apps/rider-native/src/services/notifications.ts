import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushReadiness = {
  ready: boolean;
  permission: Notifications.PermissionStatus;
  token: string | null;
  reason: string | null;
};

export async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('rider-jobs', {
    name: 'Rider jobs',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

export async function ensurePushReadiness(): Promise<PushReadiness> {
  await configureNotificationChannel();

  if (!Device.isDevice) {
    return {
      ready: false,
      permission: Notifications.PermissionStatus.UNDETERMINED,
      token: null,
      reason: 'Push notification ต้องทดสอบบนอุปกรณ์จริง',
    };
  }

  const current = await Notifications.getPermissionsAsync();
  let permission = current.status;

  if (permission !== Notifications.PermissionStatus.GRANTED) {
    const requested = await Notifications.requestPermissionsAsync();
    permission = requested.status;
  }

  if (permission !== Notifications.PermissionStatus.GRANTED) {
    return {
      ready: false,
      permission,
      token: null,
      reason: 'ยังไม่ได้อนุญาตการแจ้งเตือน',
    };
  }

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);

  if (!projectId) {
    return {
      ready: false,
      permission,
      token: null,
      reason: 'ยังไม่ได้ตั้งค่า EAS projectId สำหรับ Push',
    };
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  return {
    ready: true,
    permission,
    token,
    reason: null,
  };
}
